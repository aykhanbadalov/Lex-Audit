import { describe, expect, it } from "vitest";
import { normalizeFolder, parseTags } from "./folder";

describe("normalizeFolder", () => {
  it.each([
    ["", "/"],
    ["/", "/"],
    ["müqavilələr", "/müqavilələr"],
    ["/müqavilələr/2026/", "/müqavilələr/2026"],
    ["  a //  b  ", "/a/b"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeFolder(input)).toBe(expected);
  });

  it("refuses to climb out of the folder tree", () => {
    expect(normalizeFolder("../etc")).toBeNull();
    expect(normalizeFolder("/a/../b")).toBeNull();
    expect(normalizeFolder("./a")).toBeNull();
  });
});

describe("parseTags", () => {
  it("splits on commas, trims, drops blanks and repeats", () => {
    expect(parseTags("ƏDV, müqavilə ,, ƏDV")).toEqual(["ƏDV", "müqavilə"]);
    expect(parseTags("")).toEqual([]);
  });
});
