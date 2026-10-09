import { describe, expect, it } from "vitest";
import { readSample } from "./api";

describe("readSample", () => {
  it("reduces an invoice row and a bank row to their few key values", () => {
    expect(
      readSample({
        row: 2,
        ok: true,
        errors: [],
        data: { kind: "invoice", number: "AF-1", issueDate: "2026-09-01", counterpartyName: "Alfa", gross: "118.00" },
      })?.columns,
    ).toEqual(["AF-1", "2026-09-01", "Alfa", "118.00"]);
    expect(
      readSample({ kind: "bank", date: "2026-09-02", amount: "-50.00", description: "ödəniş", reference: null })
        ?.columns,
    ).toEqual(["2026-09-02", "-50.00", "ödəniş", ""]);
  });

  it("skips anything it does not recognise", () => {
    expect(readSample(null)).toBeNull();
    expect(readSample({ kind: "other" })).toBeNull();
  });
});
