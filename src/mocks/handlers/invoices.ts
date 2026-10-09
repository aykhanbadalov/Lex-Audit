import { delay, http, HttpResponse } from "msw";
import { ALLOWED_EXTENSIONS, extensionOf, MAX_UPLOAD_BYTES } from "@/shared/upload/limits";
import type { components } from "@/api/schema";
import {
  accounts,
  allInvoices,
  createFromUpload,
  findInvoice,
  findJournalEntry,
  proposeEntries,
  revalidate,
  taxRates,
  toDetail,
  toInvoice,
  updateInvoice,
} from "../fixtures/invoices";
import { demoPdf } from "../fixtures/pdf";
import { parseMultipart } from "../multipart";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

type InvoiceUpdate = components["schemas"]["InvoiceUpdate"];

const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(200));

function matches(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase("az").includes(needle.toLocaleLowerCase("az"));
}

const uploadsByKey = new Map<string, string[]>();
export function resetInvoiceUploadKeys(): void {
  uploadsByKey.clear();
}

/** Writing is allowed only while a person can still change the invoice; the server decides, not the UI. */
const CONFLICT = () => apiError(409, "CONFLICT", "The invoice can no longer be changed in its current state");

export const invoicesHandlers = [
  http.get(apiPath("/invoices"), async ({ request }) => {
    const auth = authorize(request, "invoices:read");
    if ("response" in auth) return auth.response;
    await latency();

    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status");
    const direction = params.get("direction");
    const hasIssues = params.get("hasIssues");
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const offset = Number(params.get("cursor") ?? 0) || 0;

    const filtered = allInvoices()
      .map(toInvoice)
      .filter(
        (item) =>
          (!q || matches(`${item.number ?? ""} ${item.counterpartyName ?? ""} ${item.counterpartyVoen ?? ""}`, q)) &&
          (!status || item.status === status) &&
          (!direction || item.direction === direction) &&
          (hasIssues === null || (hasIssues === "true" ? item.issueCount > 0 : item.issueCount === 0)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const next = offset + limit;
    return HttpResponse.json({
      items: filtered.slice(offset, next),
      nextCursor: next < filtered.length ? String(next) : null,
    });
  }),

  http.post(apiPath("/invoices/upload"), async ({ request }) => {
    const auth = authorize(request, "invoices:write");
    if ("response" in auth) return auth.response;
    await latency();

    const key = request.headers.get("Idempotency-Key");
    if (!key) return apiError(422, "VALIDATION_FAILED", "Idempotency-Key header is required");
    const known = uploadsByKey.get(key);
    if (known) {
      return HttpResponse.json({ items: known.flatMap((id) => findInvoice(id) ?? []).map(toInvoice) }, { status: 202 });
    }

    const form = await parseMultipart(request);
    const upload = form?.file;
    if (!upload) return apiError(422, "VALIDATION_FAILED", "A file is required");
    if (upload.size > MAX_UPLOAD_BYTES) return apiError(413, "VALIDATION_FAILED", "File is too large");
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(upload.name))) {
      return apiError(415, "VALIDATION_FAILED", "File type is not allowed");
    }

    const created = createFromUpload(upload.name);
    uploadsByKey.set(
      key,
      created.map((item) => item.id),
    );
    return HttpResponse.json({ items: created.map(toInvoice) }, { status: 202 });
  }),

  http.get(apiPath("/invoices/:id/source"), ({ request, params }) => {
    const auth = authorize(request, "invoices:read");
    if ("response" in auth) return auth.response;
    const found = findInvoice(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "Invoice not found");
    return new HttpResponse(demoPdf(`Invoice ${found.number ?? found.id}`), {
      headers: { "Content-Type": "application/pdf" },
    });
  }),

  http.post(apiPath("/invoices/:id/validate"), async ({ request, params }) => {
    const auth = authorize(request, "invoices:write");
    if ("response" in auth) return auth.response;
    await latency();
    const found = findInvoice(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "Invoice not found");
    revalidate(found);
    return HttpResponse.json(toDetail(found));
  }),

  http.post(apiPath("/invoices/:id/propose-entries"), async ({ request, params }) => {
    const auth = authorize(request, "invoices:write");
    if ("response" in auth) return auth.response;
    await latency();
    const found = findInvoice(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "Invoice not found");
    const entry = proposeEntries(found);
    return entry === "conflict" ? CONFLICT() : HttpResponse.json(entry, { status: 201 });
  }),

  http.get(apiPath("/invoices/:id"), async ({ request, params }) => {
    const auth = authorize(request, "invoices:read");
    if ("response" in auth) return auth.response;
    await latency();
    const found = findInvoice(String(params.id));
    return found ? HttpResponse.json(toDetail(found)) : apiError(404, "NOT_FOUND", "Invoice not found");
  }),

  http.patch(apiPath("/invoices/:id"), async ({ request, params }) => {
    const auth = authorize(request, "invoices:write");
    if ("response" in auth) return auth.response;
    await latency();
    const found = findInvoice(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "Invoice not found");

    const patch = (await request.json()) as InvoiceUpdate;
    const decimal = /^-?\d+(\.\d+)?$/;
    if (
      patch.lines?.some(
        (entry) => !decimal.test(entry.quantity) || !decimal.test(entry.unitPrice) || !entry.description.trim(),
      )
    ) {
      return apiError(422, "VALIDATION_FAILED", "A line has an invalid amount or description");
    }
    if (patch.counterpartyVoen !== undefined && patch.counterpartyVoen.length > 10)
      return apiError(422, "VALIDATION_FAILED", "VÖEN is too long");

    const result = updateInvoice(found, patch);
    if (!result.ok)
      return result.reason === "conflict" ? CONFLICT() : apiError(422, "VALIDATION_FAILED", "Invalid invoice data");
    return HttpResponse.json(toDetail(found));
  }),

  http.get(apiPath("/journal/:id"), ({ request, params }) => {
    const auth = authorize(request, "invoices:read");
    if ("response" in auth) return auth.response;
    const entry = findJournalEntry(String(params.id));
    return entry ? HttpResponse.json(entry) : apiError(404, "NOT_FOUND", "Journal entry not found");
  }),

  http.post(apiPath("/journal/:id/submit"), ({ request, params }) => {
    const auth = authorize(request, "invoices:write");
    if ("response" in auth) return auth.response;
    const entry = findJournalEntry(String(params.id));
    if (!entry) return apiError(404, "NOT_FOUND", "Journal entry not found");
    if (entry.status !== "proposed") return CONFLICT();
    if (!entry.balanced) return apiError(422, "VALIDATION_FAILED", "The entry does not balance");
    entry.status = "pending_approval";
    return HttpResponse.json(entry);
  }),

  http.get(apiPath("/accounts"), ({ request }) => {
    const auth = authorize(request, "invoices:read");
    if ("response" in auth) return auth.response;
    return HttpResponse.json(accounts);
  }),

  http.get(apiPath("/tax-rates"), ({ request }) => {
    const auth = authorize(request, "invoices:read");
    if ("response" in auth) return auth.response;
    return HttpResponse.json(taxRates);
  }),
];
