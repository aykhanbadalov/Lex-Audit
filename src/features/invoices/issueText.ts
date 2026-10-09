import type { TFunction } from "i18next";
import { formatMoney, isDecimalString, type Currency } from "@/shared/lib/money";
import type { InvoiceIssue } from "./api";

/**
 * The server sends a stable `code` plus plain `params`; the wording belongs to the UI so it follows the user's
 * language. A code this version does not know falls back to the server's English `message` instead of showing nothing.
 */
export function describeIssue(t: TFunction, issue: InvoiceIssue, currency: Currency, locale: string): string {
  const p = issue.params;
  const money = (value: string | undefined) =>
    value && isDecimalString(value) ? formatMoney(value, currency, locale) : (value ?? "");
  const field = (name: string | undefined) => (name ? t(`invoices.fields.${name}`, { defaultValue: name }) : "");

  switch (issue.code) {
    case "MISSING_FIELD":
      return t("invoices.issue.MISSING_FIELD", { field: field(p.field) });
    case "INVALID_TAX_ID":
      return t("invoices.issue.INVALID_TAX_ID", { value: p.value ?? "" });
    case "TOTAL_MISMATCH":
      return t("invoices.issue.TOTAL_MISMATCH", { declared: money(p.declared), computed: money(p.computed) });
    case "DUPLICATE_INVOICE":
      return t("invoices.issue.DUPLICATE_INVOICE", { number: p.number ?? "" });
    case "LOW_CONFIDENCE":
      return t("invoices.issue.LOW_CONFIDENCE", { field: field(p.field), percent: p.percent ?? "" });
    case "DATE_IN_FUTURE":
      return t("invoices.issue.DATE_IN_FUTURE");
    default:
      return issue.message;
  }
}

const ORDER = { error: 0, warning: 1, info: 2 } as const;

/** Errors first, so the thing that blocks the invoice is never below the fold. */
export function sortIssues(issues: readonly InvoiceIssue[]): InvoiceIssue[] {
  return [...issues].filter((issue) => !issue.resolved).sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
