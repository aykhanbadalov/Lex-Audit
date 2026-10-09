import { describe, expect, it } from "vitest";
import { sameAmount, sumDecimals } from "./decimal";

describe("sumDecimals", () => {
  it("adds without floating point noise", () => {
    expect(sumDecimals(["0.10", "0.20"])).toBe("0.30");
    expect(sumDecimals(["1234567890123.45", "0.55"])).toBe("1234567890124.00");
  });
  it("handles negatives, zero and an empty list", () => {
    expect(sumDecimals(["10.00", "-12.50"])).toBe("-2.50");
    expect(sumDecimals([])).toBe("0.00");
    expect(sumDecimals(["-0.05", "0.05"])).toBe("0.00");
  });
  it("refuses something that is not a decimal string", () => {
    expect(() => sumDecimals(["1,5"])).toThrow(TypeError);
  });
});

describe("sameAmount", () => {
  it("ignores trailing zeros", () => {
    expect(sameAmount("383.5", "383.50")).toBe(true);
    expect(sameAmount("383.50", "383.51")).toBe(false);
  });
});
