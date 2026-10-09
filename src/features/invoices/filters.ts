import { z } from "zod";

export const INVOICE_STATUSES = ["extracted", "needs_review", "validated", "posted"] as const;
export const INVOICE_DIRECTIONS = ["purchase", "sales"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const invoicesSearchSchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional().catch(undefined),
  direction: z.enum(INVOICE_DIRECTIONS).optional().catch(undefined),
  // The VAT screen links here with the dates of a period and the direction of the line it summarises.
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});

export type InvoicesSearch = z.infer<typeof invoicesSearchSchema>;

export function hasActiveInvoiceFilters(search: InvoicesSearch): boolean {
  return Boolean(search.status || search.direction || search.from || search.to);
}

/** Only these can still be corrected by a person. The server refuses edits to a posted invoice as well. */
export function isEditable(status: InvoiceStatus): boolean {
  return status !== "posted";
}

/** Whether a person still has to look at the invoice before it can be posted. */
export function needsAttention(status: InvoiceStatus): boolean {
  return status === "extracted" || status === "needs_review";
}
