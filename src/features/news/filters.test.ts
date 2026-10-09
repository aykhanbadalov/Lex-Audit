import { describe, expect, it } from "vitest";
import { hasActiveFilters, newsSearchSchema, toApiFilters } from "./filters";

describe("newsSearchSchema", () => {
  it("keeps valid values", () => {
    expect(newsSearchSchema.parse({ riskLevel: "high", read: "unread", from: "2026-01-31" })).toMatchObject({
      riskLevel: "high",
      read: "unread",
      from: "2026-01-31",
    });
  });

  it("drops invalid values instead of throwing, so a hand-edited URL cannot break the page", () => {
    const parsed = newsSearchSchema.parse({
      riskLevel: "extreme",
      read: "maybe",
      from: "yesterday",
      bookmarked: "yes",
    });
    expect(parsed.riskLevel).toBeUndefined();
    expect(parsed.read).toBeUndefined();
    expect(parsed.from).toBeUndefined();
    expect(parsed.bookmarked).toBeUndefined();
  });

  it("turns a number the router parsed out of the URL back into a string", () => {
    expect(newsSearchSchema.parse({ q: 2025 }).q).toBe("2025");
  });
});

describe("toApiFilters", () => {
  it("renames date params and omits the default 'all' read filter", () => {
    expect(toApiFilters({ from: "2026-01-01", to: "2026-02-01", read: "all" })).toEqual({
      q: undefined,
      sourceId: undefined,
      category: undefined,
      riskLevel: undefined,
      publishedFrom: "2026-01-01",
      publishedTo: "2026-02-01",
      read: undefined,
      bookmarked: undefined,
    });
  });

  it("trims the search text and ignores blank input", () => {
    expect(toApiFilters({ q: "  ƏDV  " }).q).toBe("ƏDV");
    expect(toApiFilters({ q: "   " }).q).toBeUndefined();
  });
});

describe("hasActiveFilters", () => {
  it("is false for an empty search and for the default read filter", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ read: "all" })).toBe(false);
  });

  it("is true as soon as one filter is set", () => {
    expect(hasActiveFilters({ category: "tax" })).toBe(true);
    expect(hasActiveFilters({ bookmarked: true })).toBe(true);
  });
});
