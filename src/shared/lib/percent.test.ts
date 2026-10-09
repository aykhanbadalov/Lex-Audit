import { describe, expect, it } from "vitest";
import { ratePercent } from "./percent";

describe("ratePercent", () => {
  it.each([
    ["0.18", "18"],
    ["0", "0"],
    ["1", "100"],
    ["0.045", "4.5"],
    ["0.2", "20"],
    ["0.0190", "1.9"],
    ["0.005", "0.5"],
    ["0.12345", "12.345"],
  ])("%s -> %s", (rate, expected) => {
    expect(ratePercent(rate)).toBe(expected);
  });
});
