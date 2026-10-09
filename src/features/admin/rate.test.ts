import { describe, expect, it } from "vitest";
import { normalizePercent } from "./rate";

describe("normalizePercent", () => {
  it.each([
    ["18", "18"],
    ["0", "0"],
    ["4,5", "4.5"],
    ["4.50", "4.50"],
    ["100", "100"],
    [" 18 ", "18"],
  ])("accepts %s", (input, expected) => expect(normalizePercent(input)).toBe(expected));

  it.each(["", "abc", "-1", "101", "100.5", "1.234", "18%", "1e2"])("rejects %j", (input) =>
    expect(normalizePercent(input)).toBeNull(),
  );
});
