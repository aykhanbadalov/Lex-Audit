import { delay, http, HttpResponse } from "msw";
import type { components } from "@/api/schema";
import { ALLOWED_EXTENSIONS, extensionOf, MAX_UPLOAD_BYTES } from "@/shared/upload/limits";
import {
  allWorkbooks,
  createJob,
  createWorkbook,
  findJob,
  findWorkbook,
  toDetail as workbookDetail,
} from "../fixtures/excel";
import { findFile } from "../fixtures/files";
import {
  commit,
  allImports,
  createImport,
  exportToOneC,
  findImport,
  saveMapping,
  toDetail as importDetail,
} from "../fixtures/imports";
import {
  allReconciliations,
  createReconciliation,
  decide,
  findReconciliation,
  reconciliationOf,
  rowsOf,
} from "../fixtures/reconciliation";
import { toRecord } from "../fixtures/files";
import { parseMultipart } from "../multipart";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

type JobRequest = components["schemas"]["ExcelJobRequest"];
type ReconRequest = components["schemas"]["ReconciliationRequest"];

const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(200));
const SPREADSHEETS = ["xlsx", "xls", "csv"];
const CONFLICT = () => apiError(409, "CONFLICT", "The item is not in a state that allows this");

/** Uploads already accepted under an Idempotency-Key are returned as they were, not created twice. */
const accepted = new Map<string, string>();
export function resetWorkUploadKeys(): void {
  accepted.clear();
}

async function readUpload(request: Request, allowed: readonly string[]) {
  const form = await parseMultipart(request);
  const upload = form?.file;
  if (!upload) return { response: apiError(422, "VALIDATION_FAILED", "A file is required") };
  if (upload.size > MAX_UPLOAD_BYTES) return { response: apiError(413, "VALIDATION_FAILED", "File is too large") };
  if (!allowed.includes(extensionOf(upload.name)))
    return { response: apiError(415, "VALIDATION_FAILED", "File type is not allowed") };
  return { upload, fields: form.fields };
}

export const workHandlers = [
  // ----- Excel -----
  http.get(apiPath("/excel/workbooks"), async ({ request }) => {
    const auth = authorize(request, "excel:read");
    if ("response" in auth) return auth.response;
    await latency();
    return HttpResponse.json(allWorkbooks());
  }),
  http.post(apiPath("/excel/workbooks"), async ({ request }) => {
    const auth = authorize(request, "excel:write");
    if ("response" in auth) return auth.response;
    const key = request.headers.get("Idempotency-Key");
    if (!key) return apiError(422, "VALIDATION_FAILED", "Idempotency-Key header is required");
    const known = accepted.get(key);
    if (known)
      return HttpResponse.json(
        allWorkbooks().find((workbook) => workbook.id === known),
        { status: 202 },
      );
    const read = await readUpload(request, SPREADSHEETS);
    if ("response" in read) return read.response;
    const created = createWorkbook(read.upload.name);
    accepted.set(key, created.id);
    return HttpResponse.json(
      allWorkbooks().find((workbook) => workbook.id === created.id),
      { status: 202 },
    );
  }),
  http.post(apiPath("/excel/workbooks/:id/jobs"), async ({ request, params }) => {
    const auth = authorize(request, "excel:write");
    if ("response" in auth) return auth.response;
    const workbook = findWorkbook(String(params.id));
    if (!workbook) return apiError(404, "NOT_FOUND", "Workbook not found");
    const result = createJob(workbook, (await request.json()) as JobRequest);
    if (result.ok) return HttpResponse.json(result.job, { status: 202 });
    return result.reason === "conflict"
      ? CONFLICT()
      : apiError(422, "VALIDATION_FAILED", "Invalid operation or columns");
  }),
  http.get(apiPath("/excel/workbooks/:id"), async ({ request, params }) => {
    const auth = authorize(request, "excel:read");
    if ("response" in auth) return auth.response;
    await latency();
    const workbook = findWorkbook(String(params.id));
    return workbook ? HttpResponse.json(workbookDetail(workbook)) : apiError(404, "NOT_FOUND", "Workbook not found");
  }),
  http.get(apiPath("/excel/jobs/:id"), ({ request, params }) => {
    const auth = authorize(request, "excel:read");
    if ("response" in auth) return auth.response;
    const job = findJob(String(params.id));
    return job ? HttpResponse.json(job) : apiError(404, "NOT_FOUND", "Job not found");
  }),

  // ----- Reconciliation -----
  http.get(apiPath("/reconciliations"), async ({ request }) => {
    const auth = authorize(request, "reconciliation:read");
    if ("response" in auth) return auth.response;
    await latency();
    return HttpResponse.json(allReconciliations());
  }),
  http.post(apiPath("/reconciliations"), async ({ request }) => {
    const auth = authorize(request, "reconciliation:write");
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as ReconRequest;
    const file = findFile(body.fileId);
    if (!file) return apiError(404, "NOT_FOUND", "File not found");
    // Comparing a file that has not finished processing would silently compare nothing.
    if (file.status !== "ready" || !["csv", "xlsx", "xls", "xml"].includes(extensionOf(file.name))) {
      return apiError(422, "VALIDATION_FAILED", "The file is not ready or is not a statement");
    }
    if (!/^\d{4}-\d{2}$/.test(body.periodId)) return apiError(422, "VALIDATION_FAILED", "Invalid period");
    return HttpResponse.json(reconciliationOf(createReconciliation(body.kind, file.name, body.periodId)), {
      status: 202,
    });
  }),
  http.get(apiPath("/reconciliations/:id/rows"), async ({ request, params }) => {
    const auth = authorize(request, "reconciliation:read");
    if ("response" in auth) return auth.response;
    await latency();
    const stored = findReconciliation(String(params.id));
    if (!stored) return apiError(404, "NOT_FOUND", "Reconciliation not found");
    const search = new URL(request.url).searchParams;
    const limit = Math.min(Number(search.get("limit") ?? 20) || 20, 100);
    const offset = Number(search.get("cursor") ?? 0) || 0;
    const all = rowsOf(stored, (search.get("status") as never) ?? null);
    const next = offset + limit;
    return HttpResponse.json({ items: all.slice(offset, next), nextCursor: next < all.length ? String(next) : null });
  }),
  http.post(apiPath("/reconciliations/:id/rows/:rowId/:decision"), ({ request, params }) => {
    const auth = authorize(request, "reconciliation:write");
    if ("response" in auth) return auth.response;
    const decision = String(params.decision);
    if (decision !== "confirm" && decision !== "reject") return apiError(404, "NOT_FOUND", "Not found");
    const stored = findReconciliation(String(params.id));
    if (!stored) return apiError(404, "NOT_FOUND", "Reconciliation not found");
    const result = decide(stored, String(params.rowId), decision === "confirm" ? "confirmed" : "rejected");
    if (result.ok) return HttpResponse.json(result.row);
    return result.reason === "not-found" ? apiError(404, "NOT_FOUND", "Row not found") : CONFLICT();
  }),
  http.get(apiPath("/reconciliations/:id"), ({ request, params }) => {
    const auth = authorize(request, "reconciliation:read");
    if ("response" in auth) return auth.response;
    const stored = findReconciliation(String(params.id));
    return stored
      ? HttpResponse.json(reconciliationOf(stored))
      : apiError(404, "NOT_FOUND", "Reconciliation not found");
  }),

  // ----- Imports -----
  http.get(apiPath("/imports"), async ({ request }) => {
    const auth = authorize(request, "integrations:read");
    if ("response" in auth) return auth.response;
    await latency();
    return HttpResponse.json(allImports());
  }),
  http.post(apiPath("/imports"), async ({ request }) => {
    const auth = authorize(request, "integrations:write");
    if ("response" in auth) return auth.response;
    const key = request.headers.get("Idempotency-Key");
    if (!key) return apiError(422, "VALIDATION_FAILED", "Idempotency-Key header is required");
    const known = accepted.get(key);
    if (known)
      return HttpResponse.json(
        allImports().find((entry) => entry.id === known),
        { status: 202 },
      );
    const read = await readUpload(request, ALLOWED_EXTENSIONS);
    if ("response" in read) return read.response;
    const source = read.fields.get("source")?.[0];
    if (source !== "onec" && source !== "etaxes" && source !== "bank")
      return apiError(422, "VALIDATION_FAILED", "Unknown source");
    const created = createImport(source, read.upload.name);
    accepted.set(key, created.id);
    return HttpResponse.json(
      allImports().find((entry) => entry.id === created.id),
      { status: 202 },
    );
  }),
  http.put(apiPath("/imports/:id/mapping"), async ({ request, params }) => {
    const auth = authorize(request, "integrations:write");
    if ("response" in auth) return auth.response;
    const stored = findImport(String(params.id));
    if (!stored) return apiError(404, "NOT_FOUND", "Import not found");
    const body = (await request.json()) as { mapping: Record<string, string | null> };
    const result = saveMapping(stored, body.mapping);
    if (result.ok) return HttpResponse.json(importDetail(stored));
    return result.reason === "conflict" ? CONFLICT() : apiError(422, "VALIDATION_FAILED", "Invalid mapping");
  }),
  http.post(apiPath("/imports/:id/commit"), ({ request, params }) => {
    const auth = authorize(request, "integrations:write");
    if ("response" in auth) return auth.response;
    const stored = findImport(String(params.id));
    if (!stored) return apiError(404, "NOT_FOUND", "Import not found");
    return commit(stored) === "ok" ? HttpResponse.json(importDetail(stored), { status: 202 }) : CONFLICT();
  }),
  http.get(apiPath("/imports/:id"), async ({ request, params }) => {
    const auth = authorize(request, "integrations:read");
    if ("response" in auth) return auth.response;
    await latency();
    const stored = findImport(String(params.id));
    return stored ? HttpResponse.json(importDetail(stored)) : apiError(404, "NOT_FOUND", "Import not found");
  }),
  http.post(apiPath("/exports/onec"), async ({ request }) => {
    const auth = authorize(request, "integrations:write");
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as { periodId?: string };
    if (!body.periodId || !/^\d{4}-\d{2}$/.test(body.periodId))
      return apiError(422, "VALIDATION_FAILED", "Invalid period");
    return HttpResponse.json(toRecord(exportToOneC(body.periodId)), { status: 201 });
  }),
];
