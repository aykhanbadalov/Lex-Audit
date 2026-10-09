import { describe, expect, it } from "vitest";
import { availableColumns, mappingsEqual } from "./api";

describe("availableColumns", () => {
  const columns = ["Tarix", "Debet", "Kredit"];

  it("hides a column that already feeds another field, but keeps the field's own choice", () => {
    const mapping = { date: "Tarix", amount: "Debet" };
    expect(availableColumns(columns, mapping, "amount")).toEqual(["Debet", "Kredit"]);
    expect(availableColumns(columns, mapping, "description")).toEqual(["Kredit"]);
  });

  it("offers everything when nothing is mapped", () => {
    expect(availableColumns(columns, { date: null }, "date")).toEqual(columns);
  });
});

describe("mappingsEqual", () => {
  it("treats a missing key and null as the same, and detects a real change", () => {
    expect(mappingsEqual({ a: "X", b: null }, { a: "X" })).toBe(true);
    expect(mappingsEqual({ a: "X" }, { a: "Y" })).toBe(false);
    expect(mappingsEqual({ a: "X" }, { a: "X", b: "Z" })).toBe(false);
  });
});
