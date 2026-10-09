import { delay, http, HttpResponse } from "msw";
import { ALLOWED_EXTENSIONS, extensionOf, MAX_UPLOAD_BYTES } from "@/shared/upload/limits";
import type { components } from "../draft/schema";
import {
  isVisibleInvoice,
  wireAccounts,
  wireInvoice,
  wireInvoiceDetail,
  wireJournalDetail,
  wireJournalSummary,
  wireTaxRates,
} from "../wire";
import {
  allInvoices,
  allJournalEntries,
  createFromUpload,
  findInvoice,
  findJournalEntry,
  proposeEntries,
  revalidate,
  updateInvoice,
} from "../fixtures/invoices";
import { ensureJournalApproval } from "../fixtures/approvals";
import { demoPdf } from "../fixtures/pdf";
import { parseMultipart } from "../multipart";
import { apiError, authorize, authorizeAny } from "./auth";
import { apiPath } from "./base";

type DraftUpdate = components["schemas"]["InvoiceUpdate"];

const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(200));

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
    const status = params.get("status");
    const direction = params.get("direction");
    const from = params.get("from");
    const to = params.get("to");
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const offset = Number(params.get("cursor") ?? 0) || 0;

    const filtered = allInvoices()
      .filter(isVisibleInvoice)
      .map(wireInvoice)
      .filter(
        (item) =>
          (!status || item.status === status) &&
          (!direction || item.direction === direction) &&
          (!from || item.issueDate >= from) &&
          (!to || item.issueDate <= to),
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
    if (known?.[0])
      return HttpResponse.json({ fileId: `file-${known[0]}`, fileVersionId: `ver-${known[0]}` }, { status: 202 });

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
    return HttpResponse.json(
      { fileId: `file-${created[0]!.id}`, fileVersionId: `ver-${created[0]!.id}` },
      { status: 202 },
    );
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
    return HttpResponse.json(wireInvoiceDetail(found));
  }),

  http.post(apiPath("/invoices/:id/propose-entries"), async ({ request, params }) => {
    const auth = authorize(request, "invoices:write");
    if ("response" in auth) return auth.response;
    await latency();
    const found = findInvoice(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "Invoice not found");
    const entry = proposeEntries(found);
    if (entry === "conflict") return CONFLICT();
    return HttpResponse.json({
      ...wireJournalDetail(entry),
      status: "proposed",
      explanation: ["Qaimənin sətirlərindən və ƏDV-dən qurulub."],
    });
  }),

  http.get(apiPath("/invoices/:id"), async ({ request, params }) => {
    const auth = authorize(request, "invoices:read");
    if ("response" in auth) return auth.response;
    await latency();
    const found = findInvoice(String(params.id));
    return found && isVisibleInvoice(found)
      ? HttpResponse.json(wireInvoiceDetail(found))
      : apiError(404, "NOT_FOUND", "Invoice not found");
  }),

  http.patch(apiPath("/invoices/:id"), async ({ request, params }) => {
    const auth = authorize(request, "invoices:write");
    if ("response" in auth) return auth.response;
    await latency();
    const found = findInvoice(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "Invoice not found");

    const body = (await request.json()) as {
      number?: string;
      issueDate?: string;
      currency?: string;
      net?: string;
      vat?: string;
      gross?: string;
      lines?: {
        id: string;
        description?: string;
        qty?: string;
        unitPrice?: string;
        vatRateCode?: string;
        accountFinal?: string | null;
      }[];
    };
    const decimal = /^-?\d+(\.\d+)?$/;
    const amounts = [
      body.net,
      body.vat,
      body.gross,
      ...(body.lines ?? []).flatMap((line) => [line.qty, line.unitPrice]),
    ];
    if (amounts.some((value) => value !== undefined && !decimal.test(value)))
      return apiError(422, "VALIDATION_FAILED", "An amount is not a decimal string");
    if (body.lines?.some((line) => line.description !== undefined && !line.description.trim()))
      return apiError(422, "VALIDATION_FAILED", "A line has no description");

    // The backend stores what it is given and only reports mismatches when the invoice is validated again.
    const existing = new Map(found.lines.map((line) => [line.id, line]));
    const patch: DraftUpdate = {
      number: body.number,
      issueDate: body.issueDate,
      currency: body.currency as DraftUpdate["currency"],
      lines: body.lines
        ? found.lines.map((line) => {
            const edit = body.lines!.find((candidate) => candidate.id === line.id);
            return {
              id: line.id,
              description: edit?.description ?? line.description,
              quantity: edit?.qty ?? line.quantity,
              unitPrice: edit?.unitPrice ?? line.unitPrice,
              vatRateCode: edit?.vatRateCode ?? line.vatRateCode,
              accountFinal: edit && edit.accountFinal !== undefined ? edit.accountFinal : line.accountFinal,
            };
          })
        : undefined,
    };
    if (body.lines?.some((line) => !existing.has(line.id)))
      return apiError(422, "VALIDATION_FAILED", "A line does not belong to this invoice");
    const result = updateInvoice(found, patch);
    if (!result.ok)
      return result.reason === "conflict" ? CONFLICT() : apiError(422, "VALIDATION_FAILED", "Invalid invoice data");
    if (body.net !== undefined || body.vat !== undefined || body.gross !== undefined) {
      const current = wireInvoice(found);
      found.declared = {
        net: body.net ?? current.net,
        vat: body.vat ?? current.vat,
        gross: body.gross ?? current.gross,
      };
    }
    return HttpResponse.json(wireInvoiceDetail(found));
  }),

  http.get(apiPath("/journal"), ({ request }) => {
    const auth = authorize(request, "journal:read");
    if ("response" in auth) return auth.response;
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const from = params.get("from");
    const to = params.get("to");
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const offset = Number(params.get("cursor") ?? 0) || 0;

    const filtered = allJournalEntries()
      .map(wireJournalSummary)
      .filter(
        (entry) => (!status || entry.status === status) && (!from || entry.date >= from) && (!to || entry.date <= to),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const next = offset + limit;
    return HttpResponse.json({
      items: filtered.slice(offset, next),
      nextCursor: next < filtered.length ? String(next) : null,
    });
  }),

  http.get(apiPath("/journal/:id"), ({ request, params }) => {
    // The invoice screen shows the entry too, so a person who may read either module may open it.
    const auth = authorizeAny(request, ["journal:read", "invoices:read"]);
    if ("response" in auth) return auth.response;
    const entry = findJournalEntry(String(params.id));
    return entry ? HttpResponse.json(wireJournalDetail(entry)) : apiError(404, "NOT_FOUND", "Journal entry not found");
  }),

  http.post(apiPath("/journal/:id/submit"), ({ request, params }) => {
    const auth = authorize(request, "journal:write");
    if ("response" in auth) return auth.response;
    const entry = findJournalEntry(String(params.id));
    if (!entry) return apiError(404, "NOT_FOUND", "Journal entry not found");
    if (!entry.balanced) return apiError(422, "VALIDATION_FAILED", "The entry does not balance");
    // Asking twice returns the approval that is already waiting instead of opening a second one.
    const reused = entry.status === "pending_approval";
    if (!reused && entry.status !== "proposed") return CONFLICT();
    entry.status = "pending_approval";
    const approvalId = `appr-${entry.id}`;
    ensureJournalApproval(approvalId, entry.id, entry.description, auth.user);
    return HttpResponse.json({ entryId: entry.id, approvalId, status: "approval_required", reused }, { status: 202 });
  }),

  http.get(apiPath("/accounts"), ({ request }) => {
    const auth = authorize(request, "invoices:read");
    if ("response" in auth) return auth.response;
    return HttpResponse.json(wireAccounts());
  }),

  http.get(apiPath("/tax-rates"), ({ request }) => {
    const auth = authorize(request, "invoices:read");
    if ("response" in auth) return auth.response;
    return HttpResponse.json(wireTaxRates());
  }),
];
