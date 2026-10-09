import { describe, expect, it } from "vitest";
import { formatMoney, isDecimalString } from "./money";

describe("isDecimalString", () => {
  it.each(["0", "12500.00", "-3.5", "100"])("accepts %s", (value) => {
    expect(isDecimalString(value)).toBe(true);
  });

  it.each(["", "1e5", "12,5", "abc", "1.", ".5", " 1"])("rejects %j", (value) => {
    expect(isDecimalString(value)).toBe(false);
  });
});

describe("formatMoney", () => {
  it("formats with grouping and two decimals", () => {
    expect(formatMoney("1234567.8", "AZN", "en-US")).toContain("1,234,567.80");
  });

  it("keeps precision beyond what a float can hold", () => {
    expect(formatMoney("12345678901234567.89", "AZN", "en-US")).toContain("12,345,678,901,234,567.89");
  });

  it("refuses values that are not decimal strings", () => {
    expect(() => formatMoney("1e3", "AZN", "en-US")).toThrow(TypeError);
  });
});

describe("formatMoney in Azerbaijani", () => {
  const az = (amount: string, currency: Parameters<typeof formatMoney>[1] = "AZN") =>
    formatMoney(amount, currency, "az-Latn-AZ");

  it("uses dots for thousands, a comma for decimals and the symbol after the amount", () => {
    expect(az("1234567.8")).toBe("1.234.567,80\u00A0₼");
    expect(az("12500.00")).toBe("12.500,00\u00A0₼");
    expect(az("0")).toBe("0,00\u00A0₼");
    expect(az("999")).toBe("999,00\u00A0₼");
  });

  it("handles negative amounts", () => {
    expect(az("-3.5")).toBe("-3,50\u00A0₼");
  });

  it("rounds to cents half away from zero, exactly", () => {
    expect(az("0.004")).toBe("0,00\u00A0₼");
    expect(az("0.005")).toBe("0,01\u00A0₼");
    expect(az("999.995")).toBe("1.000,00\u00A0₼");
    expect(az("2.675")).toBe("2,68\u00A0₼"); // a float would give 2.67
  });

  it("never prints a negative zero", () => {
    expect(az("-0.001")).toBe("0,00\u00A0₼");
  });

  it("keeps precision beyond what a float can hold", () => {
    expect(az("12345678901234567.89")).toBe("12.345.678.901.234.567,89\u00A0₼");
  });

  it("knows the other currency symbols", () => {
    expect(az("10", "USD")).toBe("10,00\u00A0$");
    expect(az("10", "EUR")).toBe("10,00\u00A0€");
    expect(az("10", "RUB")).toBe("10,00\u00A0₽");
    expect(az("10", "TRY")).toBe("10,00\u00A0₺");
  });

  it("accepts any Azerbaijani locale tag and still refuses non-decimal input", () => {
    expect(formatMoney("1", "AZN", "az")).toBe("1,00\u00A0₼");
    expect(() => formatMoney("1e3", "AZN", "az-Latn-AZ")).toThrow(TypeError);
  });
});
