import { delay, http, HttpResponse } from "msw";
import { toBase } from "../fixtures/fx";
import { addUploadedFile } from "../fixtures/files";
import { allInvoices, compute, validate, type StoredInvoice } from "../fixtures/invoices";
import { parseDec, formatDec } from "../decimal";
import { addDepositRows, depositBalance, findPeriod, periods, summaryFor } from "../fixtures/vat";
import { realInvoiceStatus } from "../wire";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(200));
const PERIOD = /^\d{4}-\d{2}$/;

const versions = new Map<string, number>();
export const resetVatVersions = (): void => versions.clear();

const INCLUDED = ["validated", "posted"];
const NOT_YET = ["uploaded", "extracting", "extracted"];
const inPeriod = (invoice: StoredInvoice, period: string) => invoice.issueDate?.slice(0, 7) === period;

function lastDay(period: string): string {
  const [year, month] = period.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** The backend's summary: figures from the (mock) accounting engine, plus what was left out and why. */
function wireSummary(period: string) {
  const base = summaryFor(period);
  const all = allInvoices().filter((invoice) => inPeriod(invoice, period));
  const included = all.filter((invoice) => INCLUDED.includes(invoice.status));
  const left = all.filter((invoice) => NOT_YET.includes(invoice.status));

  const rows = new Map<string, { sn: bigint; sv: bigint; pn: bigint; pv: bigint }>();
  for (const invoice of included) {
    for (const line of compute(invoice).lines) {
      const row = rows.get(line.vatRateCode) ?? { sn: 0n, sv: 0n, pn: 0n, pv: 0n };
      const net = parseDec(toBase(line.net, invoice.currency));
      const vat = parseDec(toBase(line.vat, invoice.currency));
      if (invoice.direction === "sales") {
        row.sn += net;
        row.sv += vat;
      } else {
        row.pn += net;
        row.pv += vat;
      }
      rows.set(line.vatRateCode, row);
    }
  }
  const percent: Record<string, string> = { AZ_VAT_STANDARD: "18.00", AZ_VAT_ZERO: "0.00", AZ_VAT_EXEMPT: "0.00" };
  const treatment: Record<string, string> = {
    AZ_VAT_STANDARD: "taxable",
    AZ_VAT_ZERO: "zero_rated",
    AZ_VAT_EXEMPT: "exempt",
  };

  const signed = base.resultKind === "refundable" ? `-${base.result}` : base.result;
  return {
    period,
    from: `${period}-01`,
    to: lastDay(period),
    outputVat: base.outputVat,
    inputVat: base.inputVat,
    payable: signed,
    taxableTurnover: base.taxableTurnover,
    exemptTurnover: base.exemptTurnover,
    zeroRatedTurnover: base.zeroRatedTurnover,
    depositBalance: depositBalance(period),
    byRate: [...rows.entries()].map(([code, row]) => ({
      code,
      ratePercent: percent[code] ?? "0.00",
      treatment: treatment[code] ?? "taxable",
      salesNet: formatDec(row.sn),
      salesVat: formatDec(row.sv),
      purchaseNet: formatDec(row.pn),
      purchaseVat: formatDec(row.pv),
    })),
    included: {
      sales: included.filter((invoice) => invoice.direction === "sales").length,
      purchases: included.filter((invoice) => invoice.direction === "purchase").length,
    },
    excluded: left.map((invoice) => ({
      id: invoice.id,
      number: invoice.number ?? "",
      status: realInvoiceStatus(invoice.status, 1),
    })),
    blockers: left.flatMap((invoice) => {
      const error = validate(invoice, allInvoices()).find((issue) => issue.severity === "error");
      return error ? [{ invoiceId: invoice.id, number: invoice.number ?? "", reason: error.message }] : [];
    }),
    complete: left.length === 0,
    explanation: [
      "ƏDV yalnız yoxlanılmış və uçota alınmış qaimələrdən hesablanıb.",
      "Xarici valyuta qaimələri rəsmi məzənnə ilə manata çevrilib.",
    ],
  };
}

export const vatHandlers = [
  http.get(apiPath("/vat/periods"), ({ request }) => {
    const auth = authorize(request, "vat:read");
    if ("response" in auth) return auth.response;
    return HttpResponse.json(
      periods.map((period) => ({
        period: period.id,
        status: period.status,
        latestDraftVersion: versions.get(period.id) ?? 0,
        invoices: allInvoices().filter((invoice) => inPeriod(invoice, period.id)).length,
      })),
    );
  }),

  http.get(apiPath("/vat/periods/:p/summary"), async ({ request, params }) => {
    const auth = authorize(request, "vat:read");
    if ("response" in auth) return auth.response;
    await latency();
    const id = String(params.p);
    return PERIOD.test(id) && findPeriod(id)
      ? HttpResponse.json(wireSummary(id))
      : apiError(404, "NOT_FOUND", "Period not found");
  }),

  http.post(apiPath("/vat/periods/:p/draft-return"), async ({ request, params }) => {
    const auth = authorize(request, "vat:write");
    if ("response" in auth) return auth.response;
    await latency();
    const id = String(params.p);
    const period = findPeriod(id);
    if (!period) return apiError(404, "NOT_FOUND", "Period not found");
    if (period.status === "filed") return apiError(409, "CONFLICT", "The period is already filed");
    const version = (versions.get(id) ?? 0) + 1;
    versions.set(id, version);
    const summary = wireSummary(id);
    const file = addUploadedFile({
      name: `vat-draft-${id}-v${version}.csv`,
      mimeType: "text/csv",
      sizeBytes: 300,
      folder: "/ƏDV",
      tags: ["ədv", "qaralama"],
    });
    return HttpResponse.json(
      { returnId: `ret-${id}-${version}`, version, draftFileId: file.id, summary },
      { status: 201 },
    );
  }),

  http.post(apiPath("/vat/deposit-statements"), async ({ request }) => {
    const auth = authorize(request, "vat:write");
    if ("response" in auth) return auth.response;
    await latency();
    const body = (await request.json()) as {
      period?: string;
      lines?: { date: string; operation: string; amount: string; reference?: string }[];
    };
    if (!body.period || !PERIOD.test(body.period) || !findPeriod(body.period))
      return apiError(422, "VALIDATION_FAILED", "Unknown period");
    if (!body.lines?.length || body.lines.some((row) => !/^-?\d+(\.\d+)?$/.test(row.amount)))
      return apiError(422, "VALIDATION_FAILED", "A row has an invalid amount");
    const count = addDepositRows(body.period, body.lines);
    return HttpResponse.json({ statementId: `stmt-${body.period}-${count}`, lines: count }, { status: 201 });
  }),
];
