import { z } from "zod";
import type { components } from "@/api/schema";

type Status = components["schemas"]["InvoiceStatus"];

export const INVOICE_STATUSES = [
  "uploaded",
  "extracting",
  "extracted",
  "validated",
  "posted",
  "rejected",
  "failed",
] as const satisfies readonly Status[];
export const INVOICE_DIRECTIONS = [
  "purchase",
  "sales",
] as const satisfies readonly components["schemas"]["InvoiceDirection"][];

export const invoicesSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  status: z.enum(INVOICE_STATUSES).optional().catch(undefined),
  direction: z.enum(INVOICE_DIRECTIONS).optional().catch(undefined),
  hasIssues: z.boolean().optional().catch(undefined),
  // Set by the VAT screen: "the invoices behind this line of the summary".
  vatPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  vatBucket: z.enum(["output", "input", "zeroRated", "exempt"]).optional().catch(undefined),
});

export type InvoicesSearch = z.infer<typeof invoicesSearchSchema>;

export function hasActiveInvoiceFilters(search: InvoicesSearch): boolean {
  return Boolean(search.q?.trim() || search.status || search.direction || search.hasIssues || search.vatPeriod);
}

/** Still being read by the model: the screen refreshes on its own. */
export function isProcessing(status: Status): boolean {
  return status === "uploaded" || status === "extracting";
}

/** Only these can still be corrected by a person. The server enforces it as well. */
export function isEditable(status: Status): boolean {
  return status === "extracted" || status === "validated";
}

/** Money on a row that has no meaning yet (not read, or the read failed) is shown as a dash. */
export function hasAmounts(status: Status): boolean {
  return !isProcessing(status) && status !== "failed";
}
