import { describe, expect, it } from "vitest";
import { readClean, readProfile } from "./api";

describe("readProfile", () => {
  it("reads the columns the backend profiled, keeping amounts as strings", () => {
    const profile = readProfile({
      rows: 3,
      emptyRows: 0,
      duplicateRows: 1,
      truncated: false,
      columns: [
        {
          name: "Məbləğ",
          type: "number",
          nonEmpty: 3,
          distinct: 2,
          sum: "30.10",
          min: "10.00",
          max: "10.05",
          samples: ["10.00"],
          unparsable: 0,
        },
      ],
    });
    expect(profile?.columns[0]).toMatchObject({ name: "Məbləğ", type: "number", sum: "30.10" });
    expect(profile?.duplicateRows).toBe(1);
  });

  it("returns null for anything that is not a profile, instead of guessing", () => {
    expect(readProfile(null)).toBeNull();
    expect(readProfile({ rows: "3" })).toBeNull();
    expect(readProfile({ rows: 3, columns: "x" })).toBeNull();
  });

  it("drops a malformed column and falls back to text for an unknown type", () => {
    const profile = readProfile({ rows: 1, columns: [{ nope: true }, { name: "A", type: "weird" }] });
    expect(profile?.columns).toHaveLength(1);
    expect(profile?.columns[0]?.type).toBe("text");
  });
});

describe("readClean", () => {
  it("reads the row counts and the log", () => {
    expect(readClean({ rowsIn: 10, rowsOut: 8, log: ["2 dublikat silindi"] })).toEqual({
      rowsIn: 10,
      rowsOut: 8,
      log: ["2 dublikat silindi"],
    });
    expect(readClean({})).toBeNull();
  });
});
