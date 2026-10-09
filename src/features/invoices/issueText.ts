import type { TFunction } from "i18next";
import type { InvoiceIssue } from "./api";

/**
 * The backend sends a stable `code` and an English `detail` with the numbers in it. The headline follows the user's
 * language; the detail is kept below it so nothing the backend found is hidden. A code this version does not know is
 * shown with its English detail instead of nothing.
 */
export function describeIssue(t: TFunction, issue: InvoiceIssue): { title: string; detail: string | null } {
  const known = t(`invoices.issue.${issue.code}`, { defaultValue: "" });
  return known ? { title: known, detail: issue.detail || null } : { title: issue.detail || issue.code, detail: null };
}

const ORDER = { error: 0, warning: 1 } as const;

/** Errors first, so the thing that blocks the invoice is never below the fold. */
export function sortIssues(issues: readonly InvoiceIssue[]): InvoiceIssue[] {
  return [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.lineNo ?? 0) - (b.lineNo ?? 0));
}
