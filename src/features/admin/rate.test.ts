import { describe, expect, it } from "vitest";
import { percentToRate } from "./rate";

describe("percentToRate", () => {
  it.each([
    ["18", "0.18"],
    ["0", "0"],
    ["4,5", "0.045"],
    ["4.5", "0.045"],
    ["7", "0.07"],
    ["12.34", "0.1234"],
    ["100", "1"],
    [" 18 ", "0.18"],
  ])("turns %s%% into %s", (input, expected) => expect(percentToRate(input)).toBe(expected));

  it.each(["", "abc", "-1", "101", "100.5", "1.234", "18%", "1e2"])("rejects %j", (input) =>
    expect(percentToRate(input)).toBeNull(),
  );
});
