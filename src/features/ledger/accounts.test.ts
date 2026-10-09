import { describe, expect, it } from "vitest";
import { buildAccountRows, matchesAccount, type Account } from "./accounts";

const account = (code: string, parentCode: string | null = null, name = `Hesab ${code}`): Account => ({
  code,
  name,
  type: "asset",
  parentCode,
});

describe("buildAccountRows", () => {
  it("keeps a flat chart sorted by code, numerically", () => {
    const rows = buildAccountRows([account("221"), account("21"), account("201")]);
    expect(rows.map((row) => [row.account.code, row.depth])).toEqual([
      ["21", 0],
      ["201", 0],
      ["221", 0],
    ]);
  });

  it("puts children right under their parent, indented", () => {
    const rows = buildAccountRows([
      account("201", "20"),
      account("20"),
      account("211"),
      account("202", "20"),
      account("2011", "201"),
    ]);
    expect(rows.map((row) => [row.account.code, row.depth])).toEqual([
      ["20", 0],
      ["201", 1],
      ["2011", 2],
      ["202", 1],
      ["211", 0],
    ]);
  });

  it("shows an account whose parent is missing at the top level instead of losing it", () => {
    expect(buildAccountRows([account("201", "99")]).map((row) => row.depth)).toEqual([0]);
  });

  it("does not loop forever on bad data where accounts are each other's parent", () => {
    const rows = buildAccountRows([account("1", "2"), account("2", "1")]);
    expect(rows.length).toBeLessThanOrEqual(2);
  });

  it("returns nothing for an empty chart", () => {
    expect(buildAccountRows([])).toEqual([]);
  });
});

describe("matchesAccount", () => {
  it("matches the code or the name, case-insensitively and Azerbaijani-aware", () => {
    expect(matchesAccount(account("221", null, "Kassa"), "22")).toBe(true);
    expect(matchesAccount(account("221", null, "Kassa"), "KASSA")).toBe(true);
    expect(matchesAccount(account("241", null, "Əvəzləşdirilən ƏDV"), "ədv")).toBe(true);
    expect(matchesAccount(account("221", null, "Kassa"), "bank")).toBe(false);
    expect(matchesAccount(account("221", null, "Kassa"), "  ")).toBe(true);
  });
});
