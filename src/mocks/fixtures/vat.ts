// DEMO CONTENT. Periods, due dates and deposit account movements are invented. The calculation below stands in for
// backend/crates/accounting: the server decides what is included, converts currencies and works out the result.
import type { components } from "../draft/schema";
import { formatDec, parseDec } from "../decimal";
import { BASE_CURRENCY, toBase } from "./fx";
import { allInvoices, compute, findInvoice, taxRates, type StoredInvoice } from "./invoices";

type VatPeriod = components["schemas"]["VatPeriod"];
type VatSummary = components["schemas"]["VatSummary"];
type VatBucket = components["schemas"]["VatBucket"];
type DepositLine = components["schemas"]["DepositLine"];
type DepositReconciliation = components["schemas"]["DepositReconciliation"];
type VatReturnDraft = components["schemas"]["VatReturnDraft"];

const PERIOD_IDS = ["2026-10", "2026-09", "2026-08", "2026-07", "2026-06", "2026-05"];

function lastDay(periodId: string): string {
  const [year, month] = periodId.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function nextMonth(periodId: string): string {
  const [year, month] = periodId.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

export const periods: VatPeriod[] = PERIOD_IDS.map((id) => ({
  id,
  from: `${id}-01`,
  to: lastDay(id),
  status: id >= "2026-09" ? "open" : "filed",
  // In the real system this comes from the tax calendar table.
  dueDate: `${nextMonth(id)}-20`,
}));

export const findPeriod = (id: string): VatPeriod | undefined => periods.find((period) => period.id === id);

// ---------- summary ----------

const INCLUDED = ["validated", "posted"];
const NOT_YET = ["uploaded", "extracting", "extracted"];

const inPeriod = (invoice: StoredInvoice, periodId: string) => invoice.issueDate?.slice(0, 7) === periodId;
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);
const base = (amount: string, invoice: StoredInvoice) => parseDec(toBase(amount, invoice.currency));

interface Figures {
  output: bigint;
  input: bigint;
  taxable: bigint;
  zero: bigint;
  exempt: bigint;
  buckets: Record<VatBucket, StoredInvoice[]>;
}

function figures(periodId: string): Figures {
  const included = allInvoices().filter((invoice) => INCLUDED.includes(invoice.status) && inPeriod(invoice, periodId));
  const sales = included.filter((invoice) => invoice.direction === "sales");
  const purchases = included.filter((invoice) => invoice.direction === "purchase");
  const lines = (invoice: StoredInvoice) => compute(invoice).lines;
  const vatOf = (invoice: StoredInvoice) => sum(lines(invoice).map((line) => base(line.vat, invoice)));
  const netWhere = (code: string) =>
    sum(
      sales.flatMap((invoice) =>
        lines(invoice)
          .filter((line) => line.vatRateCode === code)
          .map((line) => base(line.net, invoice)),
      ),
    );
  const hasRate = (invoice: StoredInvoice, code: string) => lines(invoice).some((line) => line.vatRateCode === code);

  return {
    output: sum(sales.map(vatOf)),
    input: sum(purchases.map(vatOf)),
    taxable: netWhere("AZ_VAT_STANDARD"),
    zero: netWhere("AZ_VAT_ZERO"),
    exempt: netWhere("AZ_VAT_EXEMPT"),
    buckets: {
      output: sales.filter((invoice) => vatOf(invoice) > 0n),
      input: purchases.filter((invoice) => vatOf(invoice) > 0n),
      zeroRated: sales.filter((invoice) => hasRate(invoice, "AZ_VAT_ZERO")),
      exempt: sales.filter((invoice) => hasRate(invoice, "AZ_VAT_EXEMPT")),
    },
  };
}

/** The invoices behind one line of the summary, for the drill-down. */
export function invoicesInBucket(periodId: string, bucket: VatBucket): StoredInvoice[] {
  return figures(periodId).buckets[bucket];
}

export function summaryFor(periodId: string): VatSummary {
  const f = figures(periodId);
  const periodInvoices = allInvoices().filter((invoice) => inPeriod(invoice, periodId));
  const result = f.output - f.input;
  return {
    periodId,
    currency: BASE_CURRENCY,
    outputVat: formatDec(f.output),
    inputVat: formatDec(f.input),
    result: formatDec(result < 0n ? -result : result),
    resultKind: result > 0n ? "payable" : result < 0n ? "refundable" : "zero",
    taxableTurnover: formatDec(f.taxable),
    zeroRatedTurnover: formatDec(f.zero),
    exemptTurnover: formatDec(f.exempt),
    breakdown: (["output", "input", "zeroRated", "exempt"] as const).map((bucket) => ({
      bucket,
      amount: formatDec({ output: f.output, input: f.input, zeroRated: f.zero, exempt: f.exempt }[bucket]),
      invoiceCount: f.buckets[bucket].length,
    })),
    excludedInvoiceCount: periodInvoices.filter((invoice) => NOT_YET.includes(invoice.status)).length,
    convertedInvoiceCount: periodInvoices.filter(
      (invoice) => INCLUDED.includes(invoice.status) && invoice.currency !== BASE_CURRENCY,
    ).length,
  };
}

// ---------- deposit account ----------

interface StoredDeposit {
  opening: string;
  lines: DepositLine[];
}

const numberOf = (invoiceId: string | null): string | null =>
  invoiceId ? (findInvoice(invoiceId)?.number ?? null) : null;

const line = (
  id: string,
  date: string,
  description: string,
  direction: "in" | "out",
  amount: string,
  matched: string | null,
  suggested: string | null = null,
): DepositLine => ({
  id,
  date,
  description,
  direction,
  amount,
  matchStatus: matched ? "matched" : "unmatched",
  matchedInvoiceId: matched,
  matchedInvoiceNumber: numberOf(matched),
  suggestedInvoiceId: matched ? null : suggested,
  suggestedInvoiceNumber: matched ? null : numberOf(suggested),
});

const depositSeeds = (): Record<string, StoredDeposit> => ({
  "2026-09": {
    opening: "1000.00",
    lines: [
      line("dep-1", "2026-09-18", "Eta Logistika · ET-902 · ƏDV", "out", "16.20", "inv-1012"),
      line("dep-2", "2026-09-20", "Naməlum ödəniş", "out", "120.00", null),
      line("dep-3", "2026-09-22", "Delta Tədarük · DL-7 · ƏDV", "out", "54.00", null, "inv-1005"),
      line("dep-4", "2026-09-29", "Alfa MMC · AF-0457 · ƏDV", "out", "58.50", "inv-1001"),
      line("dep-5", "2026-09-30", "Qamma LTD · SF-2026-044 · ƏDV", "in", "837.00", "inv-1003"),
    ],
  },
  "2026-10": {
    opening: "1588.30",
    lines: [
      line("dep-6", "2026-10-03", "Beta ASC · BT-118 · ƏDV", "out", "270.00", null, "inv-1002"),
      line("dep-7", "2026-10-07", "Epsilon Servis · EP-31 · ƏDV", "out", "162.00", null, "inv-1009"),
    ],
  },
});

let deposits = depositSeeds();
let drafts = new Map<string, VatReturnDraft>();

export function resetVat(): void {
  deposits = depositSeeds();
  drafts = new Map();
}

export function reconciliationFor(periodId: string): DepositReconciliation | undefined {
  const stored = deposits[periodId] ?? (findPeriod(periodId) ? { opening: "0.00", lines: [] } : undefined);
  if (!stored) return undefined;
  const signed = (entry: DepositLine) => (entry.direction === "in" ? parseDec(entry.amount) : -parseDec(entry.amount));
  const opening = parseDec(stored.opening);
  const closing = opening + sum(stored.lines.map(signed));
  // The books explain only the movements that have been matched to an invoice.
  const ledger = opening + sum(stored.lines.filter((entry) => entry.matchStatus === "matched").map(signed));
  return {
    periodId,
    currency: BASE_CURRENCY,
    openingBalance: stored.opening,
    closingBalance: formatDec(closing),
    ledgerBalance: formatDec(ledger),
    difference: formatDec(closing - ledger),
    lines: stored.lines,
    unmatchedCount: stored.lines.filter((entry) => entry.matchStatus === "unmatched").length,
  };
}

export type MatchResult = { ok: true; periodId: string } | { ok: false; reason: "not-found" | "conflict" };

export function matchDepositLine(lineId: string, invoiceId: string): MatchResult {
  for (const [periodId, stored] of Object.entries(deposits)) {
    const target = stored.lines.find((entry) => entry.id === lineId);
    if (!target) continue;
    if (!findInvoice(invoiceId)) return { ok: false, reason: "not-found" };
    const alreadyUsed = Object.values(deposits).some((other) =>
      other.lines.some((entry) => entry.matchedInvoiceId === invoiceId),
    );
    if (target.matchStatus === "matched" || alreadyUsed) return { ok: false, reason: "conflict" };
    target.matchStatus = "matched";
    target.matchedInvoiceId = invoiceId;
    target.matchedInvoiceNumber = numberOf(invoiceId);
    target.suggestedInvoiceId = null;
    target.suggestedInvoiceNumber = null;
    return { ok: true, periodId };
  }
  return { ok: false, reason: "not-found" };
}

// ---------- draft return ----------

export const findDraft = (periodId: string): VatReturnDraft | undefined => drafts.get(periodId);

export function createDraft(periodId: string, generatedByName: string): VatReturnDraft | "conflict" {
  const period = findPeriod(periodId);
  if (!period || period.status === "filed") return "conflict"; // a filed period is closed
  const summary = summaryFor(periodId);
  const draft: VatReturnDraft = {
    id: `draft-${periodId}-${(drafts.size + 1).toString().padStart(2, "0")}`,
    periodId,
    currency: BASE_CURRENCY,
    generatedAt: new Date().toISOString(),
    generatedByName,
    lines: [
      { code: "TURNOVER_TAXABLE", amount: summary.taxableTurnover },
      { code: "TURNOVER_ZERO_RATED", amount: summary.zeroRatedTurnover },
      { code: "TURNOVER_EXEMPT", amount: summary.exemptTurnover },
      { code: "OUTPUT_VAT", amount: summary.outputVat },
      { code: "INPUT_VAT", amount: summary.inputVat },
      { code: summary.resultKind === "refundable" ? "VAT_REFUNDABLE" : "VAT_PAYABLE", amount: summary.result },
    ],
    excludedInvoiceCount: summary.excludedInvoiceCount,
  };
  drafts.set(periodId, draft);
  return draft;
}

export { taxRates };

/** Rows of an uploaded statement join the period's deposit account as movements not yet matched to an invoice. */
export function addDepositRows(
  periodId: string,
  rows: { date: string; operation: string; amount: string; reference?: string }[],
): number {
  const stored = (deposits[periodId] ??= { opening: "0.00", lines: [] });
  for (const row of rows) {
    stored.lines.push(
      line(
        `dep-up-${stored.lines.length + 1}-${row.date}`,
        row.date,
        row.reference ?? row.operation,
        row.operation === "top_up" || row.operation === "refund" ? "in" : "out",
        row.amount.replace("-", ""),
        null,
      ),
    );
  }
  return rows.length;
}

export function depositBalance(periodId: string): string {
  return reconciliationFor(periodId)?.closingBalance ?? "0.00";
}

export const draftCount = (periodId: string): number => (drafts.has(periodId) ? 1 : 0);
