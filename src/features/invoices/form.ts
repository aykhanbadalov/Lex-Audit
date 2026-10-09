import type { InvoiceDetail, InvoiceUpdate } from "./api";

export interface LineFormValues {
  /** The server's line id, or null for a line added in the form and not saved yet. Not called `id`: react-hook-form reserves that name. */
  lineId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRateCode: string;
  accountFinal: string;
}

export interface InvoiceFormValues {
  direction: InvoiceDetail["direction"];
  number: string;
  issueDate: string;
  counterpartyName: string;
  counterpartyVoen: string;
  currency: InvoiceDetail["currency"];
  lines: LineFormValues[];
}

/** People in Azerbaijan write "8,50"; the API wants "8.50". Either is accepted when typing. */
export const DECIMAL_INPUT = /^-?\d+([.,]\d+)?$/;

export function normalizeDecimal(input: string): string {
  return input.trim().replace(",", ".");
}

export function toFormValues(detail: InvoiceDetail): InvoiceFormValues {
  return {
    direction: detail.direction,
    number: detail.number ?? "",
    issueDate: detail.issueDate ?? "",
    counterpartyName: detail.counterpartyName ?? "",
    counterpartyVoen: detail.counterpartyVoen ?? "",
    currency: detail.currency,
    lines: detail.lines.map((line) => ({
      lineId: line.id,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatRateCode: line.vatRateCode,
      accountFinal: line.accountFinal ?? "",
    })),
  };
}

/**
 * What is sent when saving. Only strings travel: the totals and VAT are never computed here, the server
 * recalculates them and returns the result.
 */
export function toUpdate(values: InvoiceFormValues): InvoiceUpdate {
  return {
    direction: values.direction,
    number: values.number.trim(),
    issueDate: values.issueDate,
    counterpartyName: values.counterpartyName.trim(),
    counterpartyVoen: values.counterpartyVoen.trim(),
    currency: values.currency,
    lines: values.lines.map((line) => ({
      id: line.lineId,
      description: line.description.trim(),
      quantity: normalizeDecimal(line.quantity),
      unitPrice: normalizeDecimal(line.unitPrice),
      vatRateCode: line.vatRateCode,
      accountFinal: line.accountFinal.trim() || null,
    })),
  };
}

/** The id the input for a server-reported path carries, so an issue can move focus to it. */
export function fieldIdFor(fieldPath: string): string {
  // "lines[1].unitPrice" (0-based) -> "field-lines-1-unitPrice"
  return `field-${fieldPath.replace(/\[(\d+)\]\./g, "-$1-").replace(/\./g, "-")}`;
}
