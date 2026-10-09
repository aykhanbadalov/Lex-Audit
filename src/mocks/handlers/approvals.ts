import { http, HttpResponse } from "msw";
import { decideRequest, findApproval, listApprovals, runEffect } from "../fixtures/approvals";
import { wireApproval } from "../wire";
import { syncToolApproval } from "../fixtures/assistant";
import { auditCsv, queryAudit, recordAudit } from "../fixtures/audit";
import { addUploadedFile, toRecord } from "../fixtures/files";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

function page<T>(request: Request, rows: T[]) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
  const offset = Number(params.get("cursor") ?? 0) || 0;
  const next = offset + limit;
  return { items: rows.slice(offset, next), nextCursor: next < rows.length ? String(next) : null };
}

const filtersFrom = (params: URLSearchParams) => ({
  q: params.get("q"),
  action: params.get("action"),
  resourceType: params.get("resourceType"),
  outcome: params.get("outcome"),
  from: params.get("from"),
  to: params.get("to"),
});

export const approvalsHandlers = [
  // A plain array, newest first; the backend has no filters or paging here.
  http.get(apiPath("/approvals"), ({ request }) => {
    const auth = authorize(request, "approvals:read");
    if ("response" in auth) return auth.response;
    const items = listApprovals({}).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return HttpResponse.json(items.map(wireApproval));
  }),

  http.get(apiPath("/approvals/:id"), ({ request, params }) => {
    const auth = authorize(request, "approvals:read");
    if ("response" in auth) return auth.response;
    const item = findApproval(String(params.id));
    return item ? HttpResponse.json(wireApproval(item)) : apiError(404, "NOT_FOUND", "Approval not found");
  }),

  http.post(apiPath("/approvals/:id/decide"), async ({ request, params }) => {
    const auth = authorize(request, "approvals:decide");
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as { decision?: string; comment?: string };
    if (body.decision !== "approve" && body.decision !== "reject")
      return apiError(422, "VALIDATION_FAILED", "Invalid decision");
    const decision = body.decision === "approve" ? "approved" : "denied";
    const id = String(params.id);
    const result = decideRequest(id, decision, body.comment, auth.user);
    const label = findApproval(id)?.title ?? id;
    const audit = (outcome: "success" | "denied" | "failed") =>
      recordAudit(auth.user, {
        action: "approval.decide",
        resourceType: "approval",
        resourceId: id,
        resourceLabel: label,
        outcome,
      });

    if (result.ok) {
      audit("success");
      runEffect(id, decision);
      syncToolApproval(id, decision, result.approval.comment);
      return HttpResponse.json(wireApproval(result.approval));
    }
    if (result.reason === "not-found") return apiError(404, "NOT_FOUND", "Approval not found");
    if (result.reason === "own-request") {
      audit("denied");
      return apiError(403, "FORBIDDEN", "You cannot decide your own request");
    }
    return apiError(409, "CONFLICT", "Already decided or expired");
  }),

  http.get(apiPath("/audit-events"), ({ request }) => {
    const auth = authorize(request, "audit:read");
    if ("response" in auth) return auth.response;
    const rows = queryAudit(filtersFrom(new URL(request.url).searchParams));
    return HttpResponse.json(page(request, rows));
  }),

  http.post(apiPath("/audit-events/export"), async ({ request }) => {
    const auth = authorize(request, "audit:read");
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as Record<string, string | undefined>;
    const rows = queryAudit(body);
    const csv = auditCsv(rows);
    recordAudit(auth.user, {
      action: "audit.export",
      resourceType: "file",
      resourceId: "audit-export",
      resourceLabel: `Audit jurnalı ixracı (${rows.length} hadisə)`,
      outcome: "success",
    });
    const file = addUploadedFile({
      name: `audit-jurnali-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: "text/csv",
      sizeBytes: new TextEncoder().encode(csv).length,
      folder: "/Audit",
      tags: ["audit", "ixrac"],
    });
    return HttpResponse.json(toRecord(file), { status: 201 });
  }),
];
