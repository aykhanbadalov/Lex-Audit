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
