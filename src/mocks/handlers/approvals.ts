import { http, HttpResponse } from "msw";
import { decideRequest, findApproval, listApprovals, runEffect } from "../fixtures/approvals";
import { wireApproval } from "../wire";
import { queryAudit, recordAudit } from "../fixtures/audit";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

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
    const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50, 200);
    return HttpResponse.json(
      queryAudit({})
        .slice(0, limit)
        .map((event) => ({
          id: event.id,
          actorId: event.actor.id,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          before: null,
          after:
            event.outcome === "success"
              ? { label: event.resourceLabel }
              : { label: event.resourceLabel, outcome: event.outcome },
          requestId: event.requestId,
          createdAt: event.at,
        })),
    );
  }),
];
