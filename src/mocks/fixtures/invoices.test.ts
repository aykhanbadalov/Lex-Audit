import { beforeEach, describe, expect, it } from "vitest";
import { parseDec } from "../decimal";
import {
  allInvoices,
  compute,
  findInvoice,
  proposeEntries,
  resetInvoicesDb,
  toDetail,
  toInvoice,
  updateInvoice,
  validate,
} from "./invoices";

beforeEach(() => resetInvoicesDb());

const codes = (id: string) =>
  validate(findInvoice(id)!, allInvoices())
    .map((issue) => issue.code)
    .sort();

describe("mock invoice validation", () => {
  it("leaves a clean invoice validated", () => {
    expect(codes("inv-1001")).toEqual([]);
    expect(toInvoice(findInvoice("inv-1001")!).status).toBe("validated");
  });

  it("flags a printed total that does not match the recalculated one", () => {
    const issue = validate(findInvoice("inv-1002")!, allInvoices()).find((item) => item.code === "TOTAL_MISMATCH");
    expect(issue).toMatchObject({ severity: "error", params: { declared: "1750.00", computed: "1770.00" } });
    expect(toInvoice(findInvoice("inv-1002")!).status).toBe("extracted");
  });

  it("flags a duplicate only on the later invoice", () => {
    expect(codes("inv-1004")).toContain("DUPLICATE_INVOICE");
    expect(codes("inv-1001")).not.toContain("DUPLICATE_INVOICE");
  });

  it("flags a malformed VÖEN and low-confidence fields", () => {
    expect(codes("inv-1005")).toEqual(expect.arrayContaining(["INVALID_TAX_ID", "LOW_CONFIDENCE"]));
  });

  it("flags missing mandatory fields", () => {
    const missing = validate(findInvoice("inv-1010")!, allInvoices()).filter((item) => item.code === "MISSING_FIELD");
    expect(missing.map((item) => item.fieldPath).sort()).toEqual(["counterpartyName", "counterpartyVoen", "number"]);
  });

  it("warns about a date in the future without blocking", () => {
    const issue = validate(findInvoice("inv-1009")!, allInvoices()).find((item) => item.code === "DATE_IN_FUTURE");
    expect(issue?.severity).toBe("warning");
  });

  it("reports no lines or issues while an invoice is still being read", () => {
    const detail = toDetail(findInvoice("inv-1006")!);
    expect(detail.status).toBe("extracting");
    expect(detail.lines).toEqual([]);
    expect(detail.issues).toEqual([]);
  });
});

describe("mock invoice recalculation", () => {
  it("recomputes line and invoice totals on the server side after an edit", () => {
    const stored = findInvoice("inv-1002")!;
    expect(compute(stored).gross).toBe("1770.00");

    updateInvoice(stored, {
      lines: [
        { id: "l1", description: "Xidmət haqqı", quantity: "1", unitPrice: "1483.05", vatRateCode: "AZ_VAT_STANDARD" },
      ],
    });

    const detail = toDetail(stored);
    expect(detail.netTotal).toBe("1483.05");
    expect(detail.vatTotal).toBe("266.95");
    expect(detail.grossTotal).toBe("1750.00");
    expect(detail.issues.some((issue) => issue.code === "TOTAL_MISMATCH")).toBe(false);
    expect(detail.status).toBe("validated");
  });

  it("clears the doubt about a field a person has corrected", () => {
    const stored = findInvoice("inv-1005")!;
    updateInvoice(stored, { counterpartyVoen: "1234567899", number: "DL-7" });
    expect(codes("inv-1005")).not.toContain("INVALID_TAX_ID");
    expect(
      validate(stored, allInvoices())
        .filter((issue) => issue.code === "LOW_CONFIDENCE")
        .map((issue) => issue.fieldPath),
    ).not.toContain("counterpartyVoen");
  });

  it("refuses to edit an invoice that is posted, rejected or still being read", () => {
    for (const id of ["inv-1003", "inv-1011", "inv-1006", "inv-1007"]) {
      expect(updateInvoice(findInvoice(id)!, { number: "X" })).toEqual({ ok: false, reason: "conflict" });
    }
  });

  it("refuses a line with an unknown VAT rate", () => {
    expect(
      updateInvoice(findInvoice("inv-1001")!, {
        lines: [{ description: "x", quantity: "1", unitPrice: "1", vatRateCode: "NOPE" }],
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("mock journal proposal", () => {
  it("balances debits and credits for every proposable invoice, in every currency and rate", () => {
    for (const stored of allInvoices().filter((item) => toInvoice(item).status === "validated")) {
      const entry = proposeEntries(stored);
      if (entry === "conflict") continue;
      const debit = entry.lines.reduce((sum, line) => sum + parseDec(line.debit), 0n);
      const credit = entry.lines.reduce((sum, line) => sum + parseDec(line.credit), 0n);
      expect(debit, stored.id).toBe(credit);
      expect(entry.balanced, stored.id).toBe(true);
    }
  });

  it("books a purchase as expense + input VAT against the supplier", () => {
    const entry = proposeEntries(findInvoice("inv-1001")!);
    if (entry === "conflict") throw new Error("expected an entry");
    expect(entry.lines.map((line) => line.accountCode)).toEqual(["201", "201", "241", "521"]);
    expect(entry.totalDebit).toBe("383.50");
    expect(entry.lines.at(-1)).toMatchObject({ accountCode: "521", credit: "383.50" });
  });

  it("books a sale as receivable against income + output VAT, and skips VAT lines at 0%", () => {
    const entry = proposeEntries(findInvoice("inv-1008")!);
    if (entry === "conflict") throw new Error("expected an entry");
    expect(entry.lines.map((line) => line.accountCode)).toEqual(["211", "601", "601"]);
  });

  it("refuses to propose for an invoice with open problems, and only once", () => {
    expect(proposeEntries(findInvoice("inv-1002")!)).toBe("conflict");
    expect(proposeEntries(findInvoice("inv-1001")!)).not.toBe("conflict");
    expect(proposeEntries(findInvoice("inv-1001")!)).toBe("conflict");
  });
});
