import { describe, expect, it } from "vitest";
import type { InvoiceDetail } from "./api";
import { fieldIdFor, normalizeDecimal, toFormValues, toUpdate } from "./form";

const detail = {
  id: "inv",
  number: "AF-1",
  issueDate: "2026-09-01",
  currency: "AZN",
  net: "100.00",
  vat: "18.00",
  gross: "118.00",
  lines: [
    {
      id: "line-1",
      lineNo: 1,
      description: "Xidmət",
      qty: "2",
      unitPrice: "50.00",
      vatRateCode: "STANDARD",
      net: "100.00",
      vat: "18.00",
      accountSuggestion: null,
      accountSuggestionConfidence: null,
      accountFinal: null,
    },
  ],
} as unknown as InvoiceDetail;

describe("invoice form", () => {
  it("accepts a decimal comma and sends a decimal point", () => {
    expect(normalizeDecimal(" 8,50 ")).toBe("8.50");
  });

  it("round-trips the server values without changing a digit", () => {
    expect(toUpdate(toFormValues(detail))).toMatchObject({
      number: "AF-1",
      net: "100.00",
      vat: "18.00",
      gross: "118.00",
      lines: [{ id: "line-1", qty: "2", unitPrice: "50.00", vatRateCode: "STANDARD", accountFinal: null }],
    });
  });

  it("sends a corrected unit price as a string, never as a number", () => {
    const values = toFormValues(detail);
    values.lines[0]!.unitPrice = "49,99";
    expect(toUpdate(values).lines?.[0]?.unitPrice).toBe("49.99");
  });

  it("clears the account when the field is emptied", () => {
    const values = toFormValues(detail);
    values.lines[0]!.accountFinal = "  ";
    expect(toUpdate(values).lines?.[0]?.accountFinal).toBeNull();
  });
});

describe("fieldIdFor", () => {
  it("points a line issue at the right line input (the backend counts lines from 1)", () => {
    expect(fieldIdFor("unitPrice", 2)).toBe("field-lines-1-unitPrice");
    expect(fieldIdFor("qty", 1)).toBe("field-lines-0-quantity");
  });

  it("points a header issue at its input, and nothing at a field that has no input", () => {
    expect(fieldIdFor("gross", null)).toBe("field-gross");
    expect(fieldIdFor("lines", null)).toBeNull();
    expect(fieldIdFor(null)).toBeNull();
  });
});
