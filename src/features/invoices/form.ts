import type { InvoiceDetail, InvoiceUpdate } from "./api";

export interface LineFormValues {
  /** The server's line id. Not called `id`: react-hook-form reserves that name. */
  lineId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRateCode: string;
  net: string;
  vat: string;
  accountFinal: string;
}

export interface InvoiceFormValues {
  number: string;
  issueDate: string;
  currency: string;
  net: string;
  vat: string;
  gross: string;
  lines: LineFormValues[];
}

/** People in Azerbaijan write "8,50"; the API wants "8.50". Either is accepted when typing. */
export const DECIMAL_INPUT = /^-?\d+([.,]\d+)?$/;

export function normalizeDecimal(input: string): string {
  return input.trim().replace(",", ".");
}

export function toFormValues(detail: InvoiceDetail): InvoiceFormValues {
  return {
    number: detail.number ?? "",
    issueDate: detail.issueDate ?? "",
    currency: detail.currency,
    net: detail.net,
    vat: detail.vat,
    gross: detail.gross,
    lines: detail.lines.map((line) => ({
      lineId: line.id,
      description: line.description,
      quantity: line.qty,
      unitPrice: line.unitPrice,
      vatRateCode: line.vatRateCode,
      net: line.net,
      vat: line.vat,
      accountFinal: line.accountFinal ?? "",
    })),
  };
}

/**
 * What is sent when saving. Money travels as strings only and is never computed here: the backend checks the
 * totals against the lines and reports a mismatch as an issue instead of silently "fixing" it.
 */
export function toUpdate(values: InvoiceFormValues): InvoiceUpdate {
  return {
    number: values.number.trim(),
    issueDate: values.issueDate || undefined,
    currency: values.currency,
    net: normalizeDecimal(values.net),
    vat: normalizeDecimal(values.vat),
    gross: normalizeDecimal(values.gross),
    lines: values.lines.map((line) => ({
      id: line.lineId,
      description: line.description.trim(),
      qty: normalizeDecimal(line.quantity),
      unitPrice: normalizeDecimal(line.unitPrice),
      vatRateCode: line.vatRateCode,
      net: normalizeDecimal(line.net),
      vat: normalizeDecimal(line.vat),
      accountFinal: line.accountFinal.trim() || null,
    })),
  };
}

/**
 * The id of the input an issue points at, so it can move focus there. `lineNo` is 1-based as the backend counts.
 * Returns null for something that has no input of its own (for example "the invoice has no lines").
 */
export function fieldIdFor(field: string | null | undefined, lineNo?: number | null): string | null {
  if (!field) return null;
  const known = ["number", "issueDate", "currency", "net", "vat", "gross"];
  if (lineNo)
    return `field-lines-${lineNo - 1}-${field === "quantity" ? "quantity" : field === "qty" ? "quantity" : field}`;
  return known.includes(field) ? `field-${field}` : null;
}
