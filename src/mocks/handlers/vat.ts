import { delay, http, HttpResponse } from "msw";
import type { components } from "@/api/schema";
import { demoPdf } from "../fixtures/pdf";
import {
  createDraft,
  findDraft,
  findPeriod,
  matchDepositLine,
  periods,
  reconciliationFor,
  summaryFor,
} from "../fixtures/vat";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

type VatReturnDraft = components["schemas"]["VatReturnDraft"];

const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(200));
const PERIOD = /^\d{4}-\d{2}$/;

function exportBody(
  draft: VatReturnDraft,
  format: string,
): { body: ConstructorParameters<typeof HttpResponse>[0]; type: string } {
  if (format === "pdf") return { body: demoPdf(`VAT return draft ${draft.periodId}`), type: "application/pdf" };
  if (format === "xml") {
    const rows = draft.lines.map((entry) => `  <line code="${entry.code}" amount="${entry.amount}"/>`).join("\n");
    return {
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<vatReturnDraft period="${draft.periodId}">\n${rows}\n</vatReturnDraft>\n`,
      type: "application/xml",
    };
  }
  const rows = draft.lines.map((entry) => `${entry.code},${entry.amount}`).join("\n");
  return { body: `code,amount\n${rows}\n`, type: "application/octet-stream" };
}

export const vatHandlers = [
  http.get(apiPath("/vat/periods"), ({ request }) => {
    const auth = authorize(request, "vat:read");
    if ("response" in auth) return auth.response;
    return HttpResponse.json(periods);
  }),

  http.get(apiPath("/vat/periods/:periodId/summary"), async ({ request, params }) => {
    const auth = authorize(request, "vat:read");
    if ("response" in auth) return auth.response;
    await latency();
    const id = String(params.periodId);
    return PERIOD.test(id) && findPeriod(id)
      ? HttpResponse.json(summaryFor(id))
      : apiError(404, "NOT_FOUND", "Period not found");
  }),

  http.get(apiPath("/vat/periods/:periodId/deposit"), async ({ request, params }) => {
    const auth = authorize(request, "vat:read");
    if ("response" in auth) return auth.response;
    await latency();
    const found = reconciliationFor(String(params.periodId));
    return found ? HttpResponse.json(found) : apiError(404, "NOT_FOUND", "Period not found");
  }),

  http.post(apiPath("/vat/deposit-lines/:lineId/match"), async ({ request, params }) => {
    const auth = authorize(request, "vat:write");
    if ("response" in auth) return auth.response;
    await latency();
    const body = (await request.json()) as { invoiceId?: string };
    if (!body.invoiceId) return apiError(422, "VALIDATION_FAILED", "invoiceId is required");
    const result = matchDepositLine(String(params.lineId), body.invoiceId);
    if (!result.ok) {
      return result.reason === "not-found"
        ? apiError(404, "NOT_FOUND", "Line or invoice not found")
        : apiError(409, "CONFLICT", "Already matched");
    }
    return HttpResponse.json(reconciliationFor(result.periodId));
  }),

  http.get(apiPath("/vat/periods/:periodId/draft-return/export"), ({ request, params }) => {
    const auth = authorize(request, "vat:read");
    if ("response" in auth) return auth.response;
    const draft = findDraft(String(params.periodId));
    if (!draft) return apiError(404, "NOT_FOUND", "No draft for this period");
    const format = new URL(request.url).searchParams.get("format") ?? "";
    if (!["pdf", "xlsx", "xml"].includes(format)) return apiError(422, "VALIDATION_FAILED", "Unknown format");
    const { body, type } = exportBody(draft, format);
    return new HttpResponse(body, { headers: { "Content-Type": type } });
  }),

  http.get(apiPath("/vat/periods/:periodId/draft-return"), ({ request, params }) => {
    const auth = authorize(request, "vat:read");
    if ("response" in auth) return auth.response;
    const draft = findDraft(String(params.periodId));
    return draft ? HttpResponse.json(draft) : apiError(404, "NOT_FOUND", "No draft for this period");
  }),

  http.post(apiPath("/vat/periods/:periodId/draft-return"), async ({ request, params }) => {
    const auth = authorize(request, "vat:write");
    if ("response" in auth) return auth.response;
    await latency();
    const id = String(params.periodId);
    if (!findPeriod(id)) return apiError(404, "NOT_FOUND", "Period not found");
    const draft = createDraft(id, auth.user.name);
    return draft === "conflict"
      ? apiError(409, "CONFLICT", "The period is already filed")
      : HttpResponse.json(draft, { status: 201 });
  }),
];
