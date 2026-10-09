// DEMO CONTENT. Invoices, companies, VÖEN numbers and account names are invented.
// This module stands in for backend/crates/accounting: it recalculates and validates the way the real backend must.
import type { components } from "../draft/schema";
import { formatDec, mulDec, parseDec, roundCents } from "../decimal";
import { processingMs } from "./files";
import { BASE_CURRENCY, rateFor, toBase } from "./fx";

type Invoice = components["schemas"]["Invoice"];
type InvoiceDetail = components["schemas"]["InvoiceDetail"];
type InvoiceIssue = components["schemas"]["InvoiceIssue"];
type InvoiceLine = components["schemas"]["InvoiceLine"];
type InvoiceStatus = components["schemas"]["InvoiceStatus"];
type InvoiceUpdate = components["schemas"]["InvoiceUpdate"];
type JournalEntry = components["schemas"]["JournalEntry"];
type TaxRate = components["schemas"]["TaxRate"];
type Account = components["schemas"]["Account"];

export const taxRates: TaxRate[] = [
  {
    code: "AZ_VAT_STANDARD",
    label: "ƏDV 18%",
    rate: "0.18",
    validFrom: "2016-01-01",
    validTo: null,
    legalSource: { id: "leg-tax-code", title: "Vergi Məcəlləsi", articleRef: null },
  },
  {
    code: "AZ_VAT_ZERO",
    label: "ƏDV 0%",
    rate: "0",
    validFrom: "2016-01-01",
    validTo: null,
    legalSource: { id: "leg-tax-code", title: "Vergi Məcəlləsi", articleRef: null },
  },
  {
    code: "AZ_VAT_EXEMPT",
    label: "ƏDV-dən azad",
    rate: "0",
    validFrom: "2016-01-01",
    validTo: null,
    legalSource: { id: "leg-tax-code", title: "Vergi Məcəlləsi", articleRef: null },
  },
];

// Codes and names are placeholders for the demo, not the official chart of accounts.
export const accounts: Account[] = [
  { code: "201", name: "Material ehtiyatları", type: "asset", parentCode: null },
  { code: "211", name: "Alıcıların borcları", type: "asset", parentCode: null },
  { code: "221", name: "Kassa", type: "asset", parentCode: null },
  { code: "223", name: "Bank hesabı", type: "asset", parentCode: null },
  { code: "241", name: "Əvəzləşdirilən ƏDV", type: "asset", parentCode: null },
  { code: "521", name: "Təchizatçılara borclar", type: "liability", parentCode: null },
  { code: "531", name: "Hesablanmış ƏDV", type: "liability", parentCode: null },
  { code: "601", name: "Satışdan gəlir", type: "income", parentCode: null },
  { code: "711", name: "Satılmış məhsulun maya dəyəri", type: "expense", parentCode: null },
  { code: "721", name: "İnzibati xərclər", type: "expense", parentCode: null },
  { code: "731", name: "Kommersiya xərcləri", type: "expense", parentCode: null },
];

const accountName = (code: string) => accounts.find((account) => account.code === code)?.name ?? code;
const rateOf = (code: string) => parseDec(taxRates.find((rate) => rate.code === code)?.rate ?? "0");

export interface StoredLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRateCode: string;
  accountSuggestion: InvoiceLine["accountSuggestion"];
  accountFinal: string | null;
}

export interface StoredInvoice {
  id: string;
  direction: Invoice["direction"];
  number: string | null;
  issueDate: string | null;
  counterpartyName: string | null;
  counterpartyVoen: string | null;
  currency: Invoice["currency"];
  status: InvoiceStatus;
  statusDetail: string | null;
  extractionConfidence: number | null;
  sourceFileName: string;
  createdAt: string;
  updatedAt: string;
  lines: StoredLine[];
  /** Totals as printed on the document. Compared with the recalculated ones. */
  declared: { net: string; vat: string; gross: string } | null;
  fieldConfidence: Record<string, number>;
  journalEntryId: string | null;
  /** Uploaded invoices move on by themselves: pending → extracting → reviewed. */
  readyAt?: number;
  createdAtMs?: number;
}

// Module-level constants must come before `db` is initialised below, which already calls code that reads them.
const REVIEWED: InvoiceStatus[] = ["extracted", "validated"];
const PROCESSING: InvoiceStatus[] = ["uploaded", "extracting"];
const FUTURE = "2099-01-01";
const LOW_CONFIDENCE_BELOW = 0.85;

function line(
  id: string,
  description: string,
  quantity: string,
  unitPrice: string,
  vatRateCode = "AZ_VAT_STANDARD",
  account?: [string, number],
): StoredLine {
  return {
    id,
    description,
    quantity,
    unitPrice,
    vatRateCode,
    accountSuggestion: account ? { code: account[0], name: accountName(account[0]), confidence: account[1] } : null,
    accountFinal: null,
  };
}

function invoice(partial: Partial<StoredInvoice> & Pick<StoredInvoice, "id" | "createdAt">): StoredInvoice {
  return {
    direction: "purchase",
    number: null,
    issueDate: null,
    counterpartyName: null,
    counterpartyVoen: null,
    currency: "AZN",
    status: "extracted",
    statusDetail: null,
    extractionConfidence: 0.95,
    sourceFileName: `${partial.id}.pdf`,
    updatedAt: partial.createdAt,
    lines: [],
    declared: null,
    fieldConfidence: { number: 0.98, issueDate: 0.97, counterpartyName: 0.96, counterpartyVoen: 0.95, currency: 0.99 },
    journalEntryId: null,
    ...partial,
  };
}

const seeds = (): StoredInvoice[] => [
  invoice({
    id: "inv-1001",
    number: "AF-0457",
    issueDate: "2026-09-28",
    counterpartyName: "Alfa MMC",
    counterpartyVoen: "1234567891",
    createdAt: "2026-09-29T08:00:00Z",
    lines: [
      line("l1", "Ofis kağızı A4", "10", "8.50", "AZ_VAT_STANDARD", ["201", 0.91]),
      line("l2", "Printer tonerləri", "2", "120.00", "AZ_VAT_STANDARD", ["201", 0.88]),
    ],
    declared: { net: "325.00", vat: "58.50", gross: "383.50" },
  }),
  invoice({
    id: "inv-1002",
    number: "BT-118",
    issueDate: "2026-10-02",
    counterpartyName: "Beta ASC",
    counterpartyVoen: "2345678912",
    createdAt: "2026-10-03T09:30:00Z",
    extractionConfidence: 0.93,
    lines: [line("l1", "Xidmət haqqı", "1", "1500.00", "AZ_VAT_STANDARD", ["721", 0.84])],
    declared: { net: "1500.00", vat: "270.00", gross: "1750.00" }, // printed total does not add up
  }),
  invoice({
    id: "inv-1003",
    direction: "sales",
    number: "SF-2026-044",
    issueDate: "2026-09-30",
    counterpartyName: "Qamma LTD",
    counterpartyVoen: "3456789123",
    createdAt: "2026-10-01T10:00:00Z",
    status: "posted",
    journalEntryId: "je-1003",
    lines: [
      line("l1", "Proqram təminatı lisenziyası", "1", "4200.00", "AZ_VAT_STANDARD", ["601", 0.96]),
      line("l2", "Quraşdırma xidməti", "3", "150.00", "AZ_VAT_STANDARD", ["601", 0.9]),
    ],
    declared: { net: "4650.00", vat: "837.00", gross: "5487.00" },
  }),
  invoice({
    id: "inv-1004",
    number: "AF-0457",
    issueDate: "2026-09-28",
    counterpartyName: "Alfa MMC",
    counterpartyVoen: "1234567891",
    createdAt: "2026-10-04T11:15:00Z",
    sourceFileName: "alfa-təkrar.pdf",
    lines: [
      line("l1", "Ofis kağızı A4", "10", "8.50", "AZ_VAT_STANDARD", ["201", 0.9]),
      line("l2", "Printer tonerləri", "2", "120.00", "AZ_VAT_STANDARD", ["201", 0.87]),
    ],
    declared: { net: "325.00", vat: "58.50", gross: "383.50" },
  }),
  invoice({
    id: "inv-1005",
    number: "DL-7",
    issueDate: "2026-10-05",
    counterpartyName: "Delta Tədarük",
    counterpartyVoen: "12345",
    createdAt: "2026-10-06T07:45:00Z",
    extractionConfidence: 0.71,
    fieldConfidence: { number: 0.62, issueDate: 0.9, counterpartyName: 0.8, counterpartyVoen: 0.55, currency: 0.99 },
    lines: [line("l1", "Nəqliyyat xidməti", "4", "75.00", "AZ_VAT_STANDARD", ["731", 0.7])],
    declared: { net: "300.00", vat: "54.00", gross: "354.00" },
  }),
  invoice({
    id: "inv-1006",
    number: null,
    createdAt: "2026-10-09T05:50:00Z",
    status: "extracting",
    extractionConfidence: null,
    sourceFileName: "gələn-qaimə.pdf",
    fieldConfidence: {},
  }),
  invoice({
    id: "inv-1007",
    createdAt: "2026-10-08T12:00:00Z",
    status: "failed",
    statusDetail: "Sənədi oxumaq mümkün olmadı: səhifə çox tutqundur.",
    extractionConfidence: null,
    sourceFileName: "skan-qaimə.jpg",
    fieldConfidence: {},
  }),
  invoice({
    id: "inv-1008",
    direction: "sales",
    number: "SF-2026-051",
    issueDate: "2026-10-06",
    counterpartyName: "Sigma Trade",
    counterpartyVoen: "4567891234",
    currency: "USD",
    createdAt: "2026-10-07T13:20:00Z",
    lines: [
      line("l1", "Konsaltinq xidməti", "8", "250.00", "AZ_VAT_ZERO", ["601", 0.93]),
      line("l2", "Hesabat hazırlanması", "1", "400.00", "AZ_VAT_ZERO", ["601", 0.9]),
    ],
    declared: { net: "2400.00", vat: "0.00", gross: "2400.00" },
  }),
  invoice({
    id: "inv-1009",
    number: "EP-31",
    issueDate: FUTURE,
    counterpartyName: "Epsilon Servis",
    counterpartyVoen: "5678912345",
    createdAt: "2026-10-08T15:10:00Z",
    lines: [line("l1", "Təmir işləri", "1", "900.00", "AZ_VAT_STANDARD", ["721", 0.8])],
    declared: { net: "900.00", vat: "162.00", gross: "1062.00" },
  }),
  invoice({
    id: "inv-1010",
    createdAt: "2026-10-08T16:00:00Z",
    extractionConfidence: 0.52,
    sourceFileName: "oxunmaz-qaimə.png",
    fieldConfidence: { number: 0.3, issueDate: 0.7, counterpartyName: 0.4, counterpartyVoen: 0.2, currency: 0.9 },
    issueDate: "2026-10-07",
    lines: [line("l1", "Naməlum xidmət", "1", "250.00", "AZ_VAT_STANDARD")],
    declared: { net: "250.00", vat: "45.00", gross: "295.00" },
  }),
  invoice({
    id: "inv-1011",
    number: "ZT-5",
    issueDate: "2026-08-12",
    counterpartyName: "Zeta Servis",
    counterpartyVoen: "6789123456",
    createdAt: "2026-08-13T08:00:00Z",
    status: "rejected",
    lines: [line("l1", "Abunə haqqı", "1", "60.00", "AZ_VAT_STANDARD")],
    declared: { net: "60.00", vat: "10.80", gross: "70.80" },
  }),
  invoice({
    id: "inv-1012",
    number: "ET-902",
    issueDate: "2026-09-18",
    counterpartyName: "Eta Logistika",
    counterpartyVoen: "7891234567",
    createdAt: "2026-09-19T09:00:00Z",
    lines: [
      line("l1", "Beynəlxalq daşıma", "1", "2200.00", "AZ_VAT_ZERO", ["731", 0.92]),
      line("l2", "Yerli çatdırılma", "2", "45.00", "AZ_VAT_STANDARD", ["731", 0.9]),
    ],
    declared: { net: "2290.00", vat: "16.20", gross: "2306.20" },
  }),
];

/** Seeds are judged against each other (duplicates), so the whole list is passed in rather than read from `db`. */
function loadSeeds(): StoredInvoice[] {
  const list = seeds();
  list.forEach((item) => withDerivedStatus(item, list));
  return list;
}

const journal = new Map<string, JournalEntry>();
let db: StoredInvoice[] = loadSeeds();
let counter = 2000;
seedPostedEntries();

export function resetInvoicesDb(): void {
  db = loadSeeds();
  journal.clear();
  counter = 2000;
  seedPostedEntries();
}

// ---------- calculation ----------

interface Computed {
  lines: InvoiceLine[];
  net: string;
  vat: string;
  gross: string;
}

export function compute(stored: StoredInvoice): Computed {
  let net = 0n;
  let vat = 0n;
  const lines = stored.lines.map((source, index): InvoiceLine => {
    const lineNet = roundCents(mulDec(parseDec(source.quantity), parseDec(source.unitPrice)));
    const lineVat = roundCents(mulDec(lineNet, rateOf(source.vatRateCode)));
    net += lineNet;
    vat += lineVat;
    return {
      id: source.id,
      position: index + 1,
      description: source.description,
      quantity: source.quantity,
      unitPrice: source.unitPrice,
      vatRateCode: source.vatRateCode,
      net: formatDec(lineNet),
      vat: formatDec(lineVat),
      gross: formatDec(lineNet + lineVat),
      accountSuggestion: source.accountSuggestion,
      accountFinal: source.accountFinal,
    };
  });
  return { lines, net: formatDec(net), vat: formatDec(vat), gross: formatDec(net + vat) };
}

// ---------- validation ----------

export function validate(stored: StoredInvoice, all: StoredInvoice[]): InvoiceIssue[] {
  const issues: InvoiceIssue[] = [];
  const add = (
    code: InvoiceIssue["code"],
    severity: InvoiceIssue["severity"],
    fieldPath: string | null,
    params: Record<string, string>,
    message: string,
  ) =>
    issues.push({
      id: `${stored.id}:${code}:${fieldPath ?? "-"}`,
      code,
      severity,
      fieldPath,
      params,
      message,
      resolved: false,
    });

  for (const field of ["number", "issueDate", "counterpartyName", "counterpartyVoen"] as const) {
    if (!stored[field]?.trim()) add("MISSING_FIELD", "error", field, { field }, `Missing ${field}`);
  }
  if (stored.counterpartyVoen && !/^\d{10}$/.test(stored.counterpartyVoen)) {
    add("INVALID_TAX_ID", "error", "counterpartyVoen", { value: stored.counterpartyVoen }, "VÖEN must be 10 digits");
  }
  if (stored.issueDate && stored.issueDate > new Date().toISOString().slice(0, 10)) {
    add("DATE_IN_FUTURE", "warning", "issueDate", { date: stored.issueDate }, "Issue date is in the future");
  }
  if (stored.declared && stored.lines.length > 0) {
    const computed = compute(stored);
    if (computed.gross !== stored.declared.gross) {
      add(
        "TOTAL_MISMATCH",
        "error",
        null,
        { declared: stored.declared.gross, computed: computed.gross, currency: stored.currency },
        "Printed total differs from the recalculated total",
      );
    }
  }
  if (stored.number && stored.counterpartyVoen) {
    const earlier = all.find(
      (other) =>
        other.id !== stored.id &&
        other.number === stored.number &&
        other.counterpartyVoen === stored.counterpartyVoen &&
        other.createdAt < stored.createdAt,
    );
    if (earlier)
      add(
        "DUPLICATE_INVOICE",
        "error",
        "number",
        { number: stored.number, other: earlier.id },
        "Same number and counterparty already exist",
      );
  }
  for (const [field, confidence] of Object.entries(stored.fieldConfidence)) {
    if (confidence < LOW_CONFIDENCE_BELOW) {
      add(
        "LOW_CONFIDENCE",
        "warning",
        field,
        { field, percent: String(Math.round(confidence * 100)) },
        `Low confidence on ${field}`,
      );
    }
  }
  return issues;
}

function withDerivedStatus(stored: StoredInvoice, all: StoredInvoice[] = db): StoredInvoice {
  if (!REVIEWED.includes(stored.status)) return stored;
  const open = validate(stored, all).filter((issue) => !issue.resolved);
  stored.status = open.some((issue) => issue.severity !== "info") ? "extracted" : "validated";
  return stored;
}

// ---------- reading ----------

function settle(stored: StoredInvoice): StoredInvoice {
  if (stored.readyAt === undefined || stored.createdAtMs === undefined) return stored;
  const elapsed = Date.now() - stored.createdAtMs;
  const total = stored.readyAt - stored.createdAtMs;
  if (elapsed < total / 2) stored.status = "uploaded";
  else if (elapsed < total) stored.status = "extracting";
  else if (stored.sourceFileName.toLowerCase().includes("xəta")) {
    stored.status = "failed";
    stored.statusDetail = "Sənədi oxumaq mümkün olmadı (demo xətası).";
  } else if (stored.status === "uploaded" || stored.status === "extracting") {
    stored.status = "extracted";
    withDerivedStatus(stored);
  }
  return stored;
}

export function allInvoices(): StoredInvoice[] {
  return db.map(settle);
}

export function findInvoice(id: string): StoredInvoice | undefined {
  const found = db.find((candidate) => candidate.id === id);
  return found ? settle(found) : undefined;
}

export function toInvoice(stored: StoredInvoice): Invoice {
  const inProgress = PROCESSING.includes(stored.status) || stored.status === "failed";
  const computed = inProgress ? null : compute(stored);
  const open = inProgress ? [] : validate(stored, db).filter((issue) => !issue.resolved);
  return {
    id: stored.id,
    direction: stored.direction,
    number: stored.number,
    issueDate: stored.issueDate,
    counterpartyName: stored.counterpartyName,
    counterpartyVoen: stored.counterpartyVoen,
    currency: stored.currency,
    netTotal: computed?.net ?? "0.00",
    vatTotal: computed?.vat ?? "0.00",
    grossTotal: computed?.gross ?? "0.00",
    status: stored.status,
    extractionConfidence: stored.extractionConfidence,
    issueCount: open.length,
    errorCount: open.filter((issue) => issue.severity === "error").length,
    sourceFileName: stored.sourceFileName,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

export function toDetail(stored: StoredInvoice): InvoiceDetail {
  const base = toInvoice(stored);
  const inProgress = PROCESSING.includes(stored.status) || stored.status === "failed";
  const computed = inProgress ? null : compute(stored);
  return {
    ...base,
    lines: computed?.lines ?? [],
    issues: inProgress ? [] : validate(stored, db),
    declaredTotals: stored.declared,
    fieldConfidence: stored.fieldConfidence,
    source: { mimeType: "application/pdf", fileName: stored.sourceFileName, pageCount: 1 },
    journalEntryId: stored.journalEntryId,
    statusDetail: stored.statusDetail,
  };
}

// ---------- writing ----------

export type UpdateResult = { ok: true } | { ok: false; reason: "conflict" | "invalid" };

export function updateInvoice(stored: StoredInvoice, patch: InvoiceUpdate): UpdateResult {
  if (
    stored.status === "posted" ||
    stored.status === "rejected" ||
    PROCESSING.includes(stored.status) ||
    stored.status === "failed"
  ) {
    return { ok: false, reason: "conflict" };
  }
  if (patch.lines) {
    if (patch.lines.some((input) => !taxRates.some((rate) => rate.code === input.vatRateCode)))
      return { ok: false, reason: "invalid" };
    stored.lines = patch.lines.map((input, index) => ({
      id: input.id ?? `l-${++counter}-${index}`,
      description: input.description,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      vatRateCode: input.vatRateCode,
      accountSuggestion: stored.lines.find((existing) => existing.id === input.id)?.accountSuggestion ?? null,
      accountFinal: input.accountFinal ?? null,
    }));
  }
  if (patch.direction !== undefined) stored.direction = patch.direction;
  if (patch.number !== undefined) stored.number = patch.number.trim() || null;
  if (patch.issueDate !== undefined) stored.issueDate = patch.issueDate || null;
  if (patch.counterpartyName !== undefined) stored.counterpartyName = patch.counterpartyName.trim() || null;
  if (patch.counterpartyVoen !== undefined) stored.counterpartyVoen = patch.counterpartyVoen.trim() || null;
  if (patch.currency !== undefined) stored.currency = patch.currency;

  // A person has now looked at these fields, so the model's doubt about them no longer applies.
  for (const field of Object.keys(patch)) {
    if (
      field === "counterpartyName" ||
      field === "counterpartyVoen" ||
      field === "number" ||
      field === "issueDate" ||
      field === "currency"
    ) {
      stored.fieldConfidence[field] = 1;
    }
  }
  stored.updatedAt = new Date().toISOString();
  stored.status = "extracted";
  withDerivedStatus(stored);
  return { ok: true };
}

export function revalidate(stored: StoredInvoice): void {
  stored.status = stored.status === "validated" || stored.status === "extracted" ? "extracted" : stored.status;
  withDerivedStatus(stored);
  stored.updatedAt = new Date().toISOString();
}

export function createFromUpload(fileName: string): StoredInvoice[] {
  const now = Date.now();
  const seed = [...fileName].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const names = ["Alfa MMC", "Beta ASC", "Qamma LTD", "Delta Tədarük"];
  const voens = ["1234567891", "2345678912", "3456789123", "4567891234"];
  const pick = seed % names.length;
  const unit = String(20 + (seed % 80)).concat(".00");
  const mismatch = fileName.toLowerCase().includes("səhv");

  const created: StoredInvoice = invoice({
    id: `inv-up-${crypto.randomUUID().slice(0, 8)}`,
    number: `UP-${seed % 1000}`,
    issueDate: "2026-10-08",
    counterpartyName: names[pick]!,
    counterpartyVoen: voens[pick]!,
    createdAt: new Date(now).toISOString(),
    status: "uploaded",
    sourceFileName: fileName,
    extractionConfidence: 0.9,
    lines: [line("l1", "Yüklənmiş qaimə sətri", "3", unit, "AZ_VAT_STANDARD", ["201", 0.8])],
  });
  const computed = compute(created);
  created.declared = mismatch
    ? { net: computed.net, vat: computed.vat, gross: "1.00" }
    : { net: computed.net, vat: computed.vat, gross: computed.gross };
  created.createdAtMs = now;
  created.readyAt = now + processingMs.value;
  db = [created, ...db];
  return [created];
}

// ---------- journal ----------

function buildEntry(stored: StoredInvoice, id: string, status: JournalEntry["status"]): JournalEntry {
  const totals = compute(stored);
  const purchase = stored.direction === "purchase";
  const lines: JournalEntry["lines"] = [];
  const codeOf = (source: InvoiceLine, fallback: string) =>
    source.accountFinal ?? source.accountSuggestion?.code ?? fallback;
  // The ledger is kept in the base currency, whatever currency the invoice used.
  const base = (amount: string) => toBase(amount, stored.currency);
  const line = (code: string, debit: string, credit: string, description: string) =>
    lines.push({
      accountCode: code,
      accountName: accountName(code),
      debit: base(debit),
      credit: base(credit),
      description,
    });

  if (purchase) {
    for (const source of totals.lines) line(codeOf(source, "201"), source.net, "0.00", source.description);
    if (totals.vat !== "0.00") line("241", totals.vat, "0.00", "Əvəzləşdirilən ƏDV");
    line("521", "0.00", totals.gross, stored.counterpartyName ?? "");
  } else {
    line("211", totals.gross, "0.00", stored.counterpartyName ?? "");
    for (const source of totals.lines) line(codeOf(source, "601"), "0.00", source.net, source.description);
    if (totals.vat !== "0.00") line("531", "0.00", totals.vat, "Hesablanmış ƏDV");
  }

  // Converting each line separately can leave a cent of rounding difference. It is put on the last line of the
  // lighter side so the entry still balances. (The real policy is the backend's to decide: see BACKEND_REQUIREMENTS.)
  const sum = (key: "debit" | "credit") => lines.reduce((total, entry) => total + parseDec(entry[key]), 0n);
  const gap = sum("debit") - sum("credit");
  if (gap !== 0n) {
    const key = gap > 0n ? "credit" : "debit";
    const last = [...lines].reverse().find((entry) => parseDec(entry[key]) > 0n) ?? lines[lines.length - 1]!;
    last[key] = formatDec(parseDec(last[key]) + (gap > 0n ? gap : -gap));
  }

  const debit = sum("debit");
  const credit = sum("credit");
  return {
    id,
    date: stored.issueDate ?? new Date().toISOString().slice(0, 10),
    description: `${stored.number ?? ""} · ${stored.counterpartyName ?? ""}`.trim(),
    status,
    source: "invoice",
    sourceInvoiceId: stored.id,
    currency: BASE_CURRENCY,
    exchangeRate: rateFor(stored.currency),
    lines,
    totalDebit: formatDec(debit),
    totalCredit: formatDec(credit),
    balanced: debit === credit,
    createdAt: new Date().toISOString(),
  };
}

function manualEntry(
  id: string,
  date: string,
  description: string,
  status: JournalEntry["status"],
  source: JournalEntry["source"],
  debitCode: string,
  creditCode: string,
  amount: string,
): JournalEntry {
  return {
    id,
    date,
    description,
    status,
    source,
    sourceInvoiceId: null,
    currency: BASE_CURRENCY,
    exchangeRate: null,
    lines: [
      { accountCode: debitCode, accountName: accountName(debitCode), debit: amount, credit: "0.00", description },
      { accountCode: creditCode, accountName: accountName(creditCode), debit: "0.00", credit: amount, description },
    ],
    totalDebit: amount,
    totalCredit: amount,
    balanced: true,
    createdAt: `${date}T09:00:00Z`,
  };
}

/** Invoices that start out posted already have their entry, so opening one shows it. */
function seedPostedEntries(): void {
  for (const stored of db) {
    if (stored.journalEntryId) journal.set(stored.journalEntryId, buildEntry(stored, stored.journalEntryId, "posted"));
  }
  // Entries that did not come from an invoice, in every state, so the ledger screens have something to show.
  for (const entry of [
    manualEntry("je-seed-1", "2026-10-01", "Ofis icarəsi - oktyabr", "posted", "manual", "721", "223", "1200.00"),
    manualEntry(
      "je-seed-2",
      "2026-09-30",
      "Əmək haqqı hesablanması - sentyabr",
      "pending_approval",
      "manual",
      "721",
      "223",
      "8500.00",
    ),
    manualEntry("je-seed-3", "2026-09-30", "Amortizasiya - sentyabr", "proposed", "ai", "721", "201", "640.00"),
    manualEntry("je-seed-4", "2026-09-15", "Düzəliş yazılışı", "rejected", "manual", "731", "223", "99.00"),
  ]) {
    journal.set(entry.id, entry);
  }
}

export function proposeEntries(stored: StoredInvoice): JournalEntry | "conflict" {
  if (stored.status !== "validated" || stored.journalEntryId) return "conflict";
  const entry = buildEntry(stored, `je-${++counter}`, "proposed");
  journal.set(entry.id, entry);
  stored.journalEntryId = entry.id;
  return entry;
}

export function allJournalEntries(): JournalEntry[] {
  return [...journal.values()];
}

export function findJournalEntry(id: string): JournalEntry | undefined {
  return journal.get(id);
}
