import { describe, expect, it } from "vitest";
import { hasActiveFilters, newsSearchSchema, toApiFilters } from "./filters";

describe("newsSearchSchema", () => {
  it("keeps valid values", () => {
    expect(newsSearchSchema.parse({ read: "unread", bookmarked: true })).toMatchObject({
      read: "unread",
      bookmarked: true,
    });
  });

  it("drops invalid values instead of throwing, so a hand-edited URL cannot break the page", () => {
    const parsed = newsSearchSchema.parse({ read: "maybe", bookmarked: "yes" });
    expect(parsed.read).toBeUndefined();
    expect(parsed.bookmarked).toBeUndefined();
  });

  it("turns a number the router parsed out of the URL back into a string", () => {
    expect(newsSearchSchema.parse({ q: 2025 }).q).toBe("2025");
  });
});

describe("toApiFilters", () => {
  it("speaks the backend's language: unread and bookmarked are the strings 'true'", () => {
    expect(toApiFilters({ read: "unread", bookmarked: true, q: " vergi " })).toEqual({
      q: "vergi",
      sourceId: undefined,
      unread: "true",
      bookmarked: "true",
    });
  });

  it("treats 'all' as no filter", () => {
    expect(hasActiveFilters({ read: "all" })).toBe(false);
    expect(hasActiveFilters({ sourceId: "s" })).toBe(true);
  });
});
