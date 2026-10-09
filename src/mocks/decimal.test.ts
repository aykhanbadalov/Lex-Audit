import { describe, expect, it } from "vitest";
import { formatDec, mulDec, parseDec, roundCents } from "./decimal";

const line = (quantity: string, unitPrice: string, rate: string) => {
  const net = roundCents(mulDec(parseDec(quantity), parseDec(unitPrice)));
  const vat = roundCents(mulDec(net, parseDec(rate)));
  return { net: formatDec(net), vat: formatDec(vat), gross: formatDec(net + vat) };
};

describe("decimal arithmetic", () => {
  it("computes 18% VAT on a round amount", () => {
    expect(line("1", "100.00", "0.18")).toEqual({ net: "100.00", vat: "18.00", gross: "118.00" });
  });

  it("multiplies quantity by unit price exactly", () => {
    expect(line("10", "8.50", "0.18")).toEqual({ net: "85.00", vat: "15.30", gross: "100.30" });
    expect(line("2.5", "0.10", "0")).toEqual({ net: "0.25", vat: "0.00", gross: "0.25" });
  });

  it("rounds half away from zero, where a float would be wrong", () => {
    expect(formatDec(roundCents(parseDec("2.675")))).toBe("2.68"); // the float 2.675 is 2.67499999...
    expect(formatDec(roundCents(parseDec("-2.675")))).toBe("-2.68");
    expect(line("33.33", "1", "0.18").vat).toBe("6.00"); // 5.9994 rounds up
    expect(line("1", "0.10", "0.18").vat).toBe("0.02"); // 0.018 rounds up
  });

  it("is exact for amounts beyond float precision", () => {
    expect(formatDec(parseDec("12345678901234567.89"))).toBe("12345678901234567.89");
  });

  it("never prints a negative zero", () => {
    expect(formatDec(parseDec("-0.001"))).toBe("0.00");
  });

  it("parses amounts without a fractional part and with fewer digits than the scale", () => {
    expect(formatDec(parseDec("7"))).toBe("7.00");
    expect(formatDec(parseDec("7.5"))).toBe("7.50");
  });
});
