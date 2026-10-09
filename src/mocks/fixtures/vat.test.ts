import { beforeEach, describe, expect, it } from "vitest";
import { resetInvoicesDb } from "./invoices";
import {
  createDraft,
  findDraft,
  invoicesInBucket,
  matchDepositLine,
  periods,
  reconciliationFor,
  resetVat,
  summaryFor,
} from "./vat";

beforeEach(() => {
  resetInvoicesDb();
  resetVat();
});

// Every expected figure below was worked out by hand from the seed invoices, not copied from the output.
describe("VAT summary", () => {
  it("adds up September: output VAT from sales, deductible VAT from purchases, and what is left to pay", () => {
    const summary = summaryFor("2026-09");
    expect(summary.outputVat).toBe("837.00"); // SF-2026-044: 756.00 + 81.00
    expect(summary.inputVat).toBe("74.70"); // AF-0457: 58.50, ET-902: 16.20
    expect(summary.result).toBe("762.30");
    expect(summary.resultKind).toBe("payable");
    expect(summary.taxableTurnover).toBe("4650.00");
  });

  it("leaves out invoices nobody has validated yet, and says how many", () => {
    // The duplicate AF-0457 (September) is still waiting for review, so it must not add 58.50 of input VAT.
    expect(summaryFor("2026-09").excludedInvoiceCount).toBe(1);
    expect(summaryFor("2026-10").excludedInvoiceCount).toBe(3);
  });

  it("converts foreign currency to the base currency and reports a zero result as zero", () => {
    const summary = summaryFor("2026-10");
    expect(summary.zeroRatedTurnover).toBe("4080.00"); // 2400.00 USD at the demo rate 1.70
    expect(summary.convertedInvoiceCount).toBe(1);
    expect(summary.outputVat).toBe("0.00");
    expect(summary.resultKind).toBe("zero");
  });

  it("counts invoices per line so the drill-down total matches the summary", () => {
    const summary = summaryFor("2026-09");
    for (const item of summary.breakdown) {
      expect(invoicesInBucket("2026-09", item.bucket)).toHaveLength(item.invoiceCount);
    }
    expect(invoicesInBucket("2026-09", "output").map((invoice) => invoice.id)).toEqual(["inv-1003"]);
    expect(
      invoicesInBucket("2026-09", "input")
        .map((invoice) => invoice.id)
        .sort(),
    ).toEqual(["inv-1001", "inv-1012"]);
  });

  it("reports an empty period without failing", () => {
    expect(summaryFor("2026-05")).toMatchObject({
      outputVat: "0.00",
      inputVat: "0.00",
      resultKind: "zero",
      excludedInvoiceCount: 0,
    });
  });

  it("has a due date for every period, and the open ones come first", () => {
    expect(periods.every((period) => /^\d{4}-\d{2}-\d{2}$/.test(period.dueDate))).toBe(true);
    expect(periods.map((period) => period.status)).toEqual(["open", "open", "filed", "filed", "filed", "filed"]);
  });
});

describe("VAT deposit account", () => {
  it("explains the difference between the statement and the books by the unmatched movements", () => {
    const reconciliation = reconciliationFor("2026-09")!;
    expect(reconciliation.closingBalance).toBe("1588.30"); // 1000.00 + 837.00 - 248.70
    expect(reconciliation.ledgerBalance).toBe("1762.30"); // only matched movements
    expect(reconciliation.difference).toBe("-174.00"); // the 120.00 and 54.00 nobody has explained
    expect(reconciliation.unmatchedCount).toBe(2);
  });

  it("carries one month's closing balance into the next month's opening balance", () => {
    expect(reconciliationFor("2026-10")!.openingBalance).toBe(reconciliationFor("2026-09")!.closingBalance);
  });

  it("shrinks the difference when a movement is matched to its invoice", () => {
    expect(matchDepositLine("dep-3", "inv-1005")).toEqual({ ok: true, periodId: "2026-09" });
    const reconciliation = reconciliationFor("2026-09")!;
    expect(reconciliation.difference).toBe("-120.00");
    expect(reconciliation.unmatchedCount).toBe(1);
    expect(reconciliation.lines.find((line) => line.id === "dep-3")).toMatchObject({
      matchStatus: "matched",
      matchedInvoiceId: "inv-1005",
      suggestedInvoiceId: null,
    });
  });

  it("refuses to match a line twice, or to give one invoice two payments", () => {
    expect(matchDepositLine("dep-1", "inv-1001")).toEqual({ ok: false, reason: "conflict" }); // already matched
    expect(matchDepositLine("dep-2", "inv-1001")).toEqual({ ok: false, reason: "conflict" }); // invoice already has a payment
  });

  it("answers 'not found' for an unknown line or invoice", () => {
    expect(matchDepositLine("nope", "inv-1001")).toEqual({ ok: false, reason: "not-found" });
    expect(matchDepositLine("dep-2", "nope")).toEqual({ ok: false, reason: "not-found" });
  });

  it("treats a period without a statement as empty, and an unknown period as missing", () => {
    expect(reconciliationFor("2026-07")).toMatchObject({ closingBalance: "0.00", unmatchedCount: 0 });
    expect(reconciliationFor("1999-01")).toBeUndefined();
  });
});

describe("VAT return draft", () => {
  it("prepares a draft from the summary and remembers it", () => {
    expect(findDraft("2026-09")).toBeUndefined();
    const draft = createDraft("2026-09", "Aygün")!;
    if (draft === "conflict") throw new Error("expected a draft");
    expect(draft.lines.find((line) => line.code === "VAT_PAYABLE")?.amount).toBe("762.30");
    expect(draft.lines.find((line) => line.code === "OUTPUT_VAT")?.amount).toBe("837.00");
    expect(draft.excludedInvoiceCount).toBe(1);
    expect(findDraft("2026-09")).toEqual(draft);
  });

  it("names the result line by what it means", () => {
    const draft = createDraft("2026-10", "Aygün");
    if (draft === "conflict") throw new Error("expected a draft");
    expect(draft.lines.some((line) => line.code === "VAT_PAYABLE" || line.code === "VAT_REFUNDABLE")).toBe(true);
  });

  it("will not prepare a draft for a period that is already filed", () => {
    expect(createDraft("2026-08", "Aygün")).toBe("conflict");
  });
});
