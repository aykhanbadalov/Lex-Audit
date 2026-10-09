import { describe, expect, it } from "vitest";
import type { InvoiceDetail } from "./api";
import { DECIMAL_INPUT, fieldIdFor, normalizeDecimal, toFormValues, toUpdate } from "./form";

const detail = {
  direction: "purchase",
  number: "AF-1",
  issueDate: "2026-09-28",
  counterpartyName: "Alfa MMC",
  counterpartyVoen: "1234567891",
  currency: "AZN",
  lines: [
    {
      id: "l1",
      description: "Kağız",
      quantity: "10",
      unitPrice: "8.50",
      vatRateCode: "AZ_VAT_STANDARD",
      accountFinal: null,
      accountSuggestion: null,
      position: 1,
      net: "85.00",
      vat: "15.30",
      gross: "100.30",
    },
  ],
} as unknown as InvoiceDetail;

describe("decimal input", () => {
  it.each(["8", "8.50", "8,50", "-3,5", "0.001"])("accepts %s", (value) =>
    expect(DECIMAL_INPUT.test(value)).toBe(true),
  );
  it.each(["", "abc", "1e3", "8,5,0", "8.", ",5", "1 000"])("rejects %j", (value) =>
    expect(DECIMAL_INPUT.test(value)).toBe(false),
  );

  it("turns a decimal comma into a point and trims", () => {
    expect(normalizeDecimal(" 8,50 ")).toBe("8.50");
    expect(normalizeDecimal("8.50")).toBe("8.50");
  });
});

describe("form mapping", () => {
  it("shows missing fields as empty text, not 'null'", () => {
    const values = toFormValues({
      ...detail,
      number: null,
      issueDate: null,
      counterpartyName: null,
      counterpartyVoen: null,
    } as InvoiceDetail);
    expect(values).toMatchObject({ number: "", issueDate: "", counterpartyName: "", counterpartyVoen: "" });
  });

  it("round-trips an unchanged invoice and keeps money as the strings it arrived as", () => {
    const update = toUpdate(toFormValues(detail));
    expect(update.lines).toEqual([
      {
        id: "l1",
        description: "Kağız",
        quantity: "10",
        unitPrice: "8.50",
        vatRateCode: "AZ_VAT_STANDARD",
        accountFinal: null,
      },
    ]);
    expect(Object.keys(update).sort()).toEqual([
      "counterpartyName",
      "counterpartyVoen",
      "currency",
      "direction",
      "issueDate",
      "lines",
      "number",
    ]);
  });

  it("normalizes what a person typed before it is sent", () => {
    const values = toFormValues(detail);
    values.lines[0]!.unitPrice = " 8,75 ";
    values.lines[0]!.accountFinal = " 201 ";
    values.number = "  AF-2 ";
    const update = toUpdate(values);
    expect(update.lines?.[0]).toMatchObject({ unitPrice: "8.75", accountFinal: "201" });
    expect(update.number).toBe("AF-2");
  });

  it("sends a new line without an id and an empty account as null", () => {
    const values = toFormValues(detail);
    values.lines.push({
      lineId: null,
      description: "Yeni",
      quantity: "1",
      unitPrice: "5",
      vatRateCode: "AZ_VAT_ZERO",
      accountFinal: "",
    });
    expect(toUpdate(values).lines?.[1]).toEqual({
      id: null,
      description: "Yeni",
      quantity: "1",
      unitPrice: "5",
      vatRateCode: "AZ_VAT_ZERO",
      accountFinal: null,
    });
  });
});

describe("fieldIdFor", () => {
  it("maps server paths to input ids", () => {
    expect(fieldIdFor("number")).toBe("field-number");
    expect(fieldIdFor("counterpartyVoen")).toBe("field-counterpartyVoen");
    expect(fieldIdFor("lines[1].unitPrice")).toBe("field-lines-1-unitPrice");
  });
});
