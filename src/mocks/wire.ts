// The mock database keeps the shapes the screens were first designed around. The real backend sends different shapes,
// so every handler converts at the edge with the functions below. If the backend contract changes, only this file
// and the handlers change, never the fixtures.
import type { components } from "./draft/schema";
import { accounts, compute, taxRates, validate, allInvoices, type StoredInvoice } from "./fixtures/invoices";

type DraftInvoice = components["schemas"]["Invoice"];
type DraftJournalEntry = components["schemas"]["JournalEntry"];
type DraftIssue = components["schemas"]["InvoiceIssue"];
type DraftTaxRate = components["schemas"]["TaxRate"];

const LOW_CONFIDENCE_BELOW = 0.85;

/** The backend has no "uploaded/extracting/failed" invoices: a document becomes an invoice once it has been read. */
export const isVisibleInvoice = (stored: StoredInvoice): boolean =>
  !["uploaded", "extracting", "failed"].includes(stored.status);

export function realInvoiceStatus(
  draft: DraftInvoice["status"],
  openIssues: number,
): "extracted" | "needs_review" | "validated" | "posted" {
  if (draft === "posted") return "posted";
  if (draft === "validated") return "validated";
  return openIssues > 0 || draft === "rejected" ? "needs_review" : "extracted";
}

function lineNoAndField(path: string | null): { lineNo: number | null; field: string | null } {
  if (!path) return { lineNo: null, field: null };
  const match = /^lines\[(\d+)\]\.(\w+)$/.exec(path);
  if (match) return { lineNo: Number(match[1]) + 1, field: match[2] === "quantity" ? "qty" : match[2]! };
  return { lineNo: null, field: path.replace(/Total$/, "") };
}

const CODE_MAP: Record<string, string> = { DATE_IN_FUTURE: "FUTURE_DATE" };

function wireIssue(issue: DraftIssue) {
  const { lineNo, field } = lineNoAndField(issue.fieldPath);
  return {
    id: issue.id,
    code: CODE_MAP[issue.code] ?? issue.code,
    severity: issue.severity === "info" ? ("warning" as const) : issue.severity,
    detail: issue.message,
    lineNo,
    field,
  };
}

export function wireInvoice(stored: StoredInvoice) {
  const computed = compute(stored);
  const open = validate(stored, allInvoices()).filter((issue) => !issue.resolved);
  const confidence = stored.extractionConfidence ?? 0;
  return {
    id: stored.id,
    direction: stored.direction,
    number: stored.number ?? "",
    issueDate: stored.issueDate ?? "",
    counterparty: {
      id: `cp-${stored.counterpartyVoen ?? stored.id}`,
      name: stored.counterpartyName ?? "",
      voen: stored.counterpartyVoen ?? "",
      isVatPayer: true,
    },
    currency: stored.currency,
    // What is stored on the invoice: the printed totals when the document has them, otherwise the lines' sum.
    net: stored.declared?.net ?? computed.net,
    vat: stored.declared?.vat ?? computed.vat,
    gross: stored.declared?.gross ?? computed.gross,
    status: realInvoiceStatus(stored.status, open.length),
    sourceFileId: `file-${stored.id}`,
    extractionConfidence: String(confidence),
    templateVersion: "tpl-demo-1",
    aiModelVersion: "lexaudit-demo-0.1",
    lowConfidenceFields: Object.entries(stored.fieldConfidence)
      .filter(([, value]) => value < LOW_CONFIDENCE_BELOW)
      .map(([field]) => field),
    fieldConfidence: stored.fieldConfidence,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

export function wireInvoiceDetail(stored: StoredInvoice) {
  const computed = compute(stored);
  return {
    ...wireInvoice(stored),
    lines: computed.lines.map((line, index) => ({
      id: line.id,
      lineNo: index + 1,
      description: line.description,
      qty: line.quantity,
      unitPrice: line.unitPrice,
      vatRateCode: line.vatRateCode,
      net: line.net,
      vat: line.vat,
      accountSuggestion: line.accountSuggestion?.code ?? null,
      accountSuggestionConfidence: line.accountSuggestion ? String(line.accountSuggestion.confidence) : null,
      accountFinal: line.accountFinal,
    })),
    issues: validate(stored, allInvoices())
      .filter((issue) => !issue.resolved)
      .map(wireIssue),
  };
}

// ---------- reference data ----------

export const wireAccounts = () =>
  accounts.map((account) => ({
    id: `acc-${account.code}`,
    code: account.code,
    nameAz: account.name,
    nameRu: account.name,
    nameEn: account.name,
    type: account.type,
    parentId: null,
  }));

export function wireTaxRate(rate: DraftTaxRate) {
  const percent = (Number(rate.rate) * 100).toFixed(2);
  return {
    id: `rate-${rate.code}`,
    taxType: "VAT" as const,
    code: rate.code,
    ratePercent: percent,
    treatment: rate.code.includes("EXEMPT")
      ? ("exempt" as const)
      : Number(rate.rate) === 0
        ? ("zero_rated" as const)
        : ("taxable" as const),
    validFrom: rate.validFrom,
    validTo: rate.validTo,
    legalSourceId: rate.legalSource?.id ?? null,
    status: "active" as const,
  };
}

export const wireTaxRates = () => taxRates.map(wireTaxRate);

// ---------- journal ----------

/** Pending approval and rejected are not journal states on the backend: the entry stays "proposed" with an approval. */
export function realJournalStatus(status: DraftJournalEntry["status"]): "proposed" | "approved" | "posted" {
  return status === "posted" ? "posted" : status === "approved" ? "approved" : "proposed";
}

export function wireJournalSummary(entry: DraftJournalEntry) {
  return {
    id: entry.id,
    date: entry.date,
    description: entry.description,
    status: realJournalStatus(entry.status),
    source: entry.source === "invoice" || entry.source === "manual" || entry.source === "ai" ? entry.source : "manual",
    sourceInvoiceId: entry.sourceInvoiceId,
    approvalId: entry.status === "pending_approval" ? `appr-${entry.id}` : null,
    postedAt: entry.status === "posted" ? entry.createdAt : null,
    createdAt: entry.createdAt,
  };
}

export function wireJournalDetail(entry: DraftJournalEntry) {
  return {
    ...wireJournalSummary(entry),
    lines: entry.lines.map((line, index) => ({
      lineNo: index + 1,
      accountCode: line.accountCode,
      debit: line.debit,
      credit: line.credit,
      description: line.description ?? "",
    })),
  };
}

// ---------- approvals ----------

type DraftApproval = components["schemas"]["ApprovalRequest"];

/** The backend's approval has no title, no diff and no names: only a kind, a reference and two user ids. */
export function wireApproval(item: Omit<DraftApproval, "canDecide">) {
  return {
    id: item.id,
    kind: item.kind,
    resourceRef: item.source?.id ?? item.id,
    requesterId: item.requestedBy.id,
    approverId: item.decidedBy?.id ?? null,
    status: item.status === "denied" ? ("rejected" as const) : item.status,
    expiresAt: item.expiresAt,
    decidedAt: item.decidedAt,
    comment: item.comment,
    createdAt: item.requestedAt,
  };
}
