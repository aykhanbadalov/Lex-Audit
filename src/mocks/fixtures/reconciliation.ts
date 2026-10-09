// DEMO CONTENT. The rows are invented; the real matching belongs to the backend.
import type { components } from "@/api/schema";
import { formatDec, parseDec } from "../decimal";
import { processingMs } from "./files";

type Reconciliation = components["schemas"]["Reconciliation"];
type Row = components["schemas"]["ReconciliationRow"];
type Item = components["schemas"]["ReconItem"];
type Kind = components["schemas"]["ReconciliationKind"];

const item = (date: string, description: string, amount: string, reference: string | null = null): Item => ({
  date,
  description,
  amount,
  reference,
});

/** The difference is always the left amount minus the right one; a missing side counts as zero. Never computed in the browser. */
function difference(left: Item | null, right: Item | null): string {
  return formatDec(parseDec(left?.amount ?? "0") - parseDec(right?.amount ?? "0"));
}

function row(
  id: string,
  status: Row["status"],
  left: Item | null,
  right: Item | null,
  confidence: number | null = null,
): Row {
  return { id, status, confidence, left, right, difference: difference(left, right) };
}

const rowsFor = (kind: Kind, prefix: string): Row[] =>
  kind === "bank_ledger"
    ? [
        row(
          `${prefix}-r1`,
          "confirmed",
          item("2026-09-02", "Daxilolma — Qamma LTD", "5487.00", "TRX-1001"),
          item("2026-09-02", "SF-2026-044", "5487.00", "SF-2026-044"),
        ),
        row(
          `${prefix}-r2`,
          "confirmed",
          item("2026-09-05", "Ödəniş — Alfa MMC", "383.50", "TRX-1002"),
          item("2026-09-05", "AF-0457 ödənişi", "383.50", "AF-0457"),
        ),
        row(
          `${prefix}-r3`,
          "confirmed",
          item("2026-09-10", "Komissiya", "12.00"),
          item("2026-09-10", "Bank komissiyası", "12.00"),
        ),
        row(
          `${prefix}-r4`,
          "suggested",
          item("2026-09-18", "Ödəniş — Beta ASC", "1750.00", "TRX-1003"),
          item("2026-09-18", "BT-118", "1770.00", "BT-118"),
          0.91,
        ),
        row(
          `${prefix}-r5`,
          "suggested",
          item("2026-09-22", "Ödəniş — Delta", "354.00", "TRX-1004"),
          item("2026-09-23", "DL-7", "354.00", "DL-7"),
          0.74,
        ),
        row(`${prefix}-r6`, "unmatched", item("2026-09-20", "Naməlum ödəniş", "120.00", "TRX-1005"), null),
        row(`${prefix}-r7`, "unmatched", item("2026-09-27", "Nağd çıxarış", "300.00", "TRX-1006"), null),
        row(`${prefix}-r8`, "unmatched", null, item("2026-09-30", "Əmək haqqı hesablanması", "8500.00")),
      ]
    : [
        row(
          `${prefix}-r1`,
          "confirmed",
          item("2026-09-28", "AF-0457 · Alfa MMC", "383.50", "AF-0457"),
          item("2026-09-28", "AF-0457", "383.50", "AF-0457"),
        ),
        row(
          `${prefix}-r2`,
          "suggested",
          item("2026-10-02", "BT-118 · Beta ASC", "1770.00", "BT-118"),
          item("2026-10-02", "BT-118", "1750.00", "BT-118"),
          0.88,
        ),
        row(`${prefix}-r3`, "unmatched", item("2026-09-30", "SF-2026-044 · Qamma LTD", "5487.00", "SF-2026-044"), null),
        row(`${prefix}-r4`, "unmatched", null, item("2026-09-12", "ZZ-9 · Naməlum", "70.80", "ZZ-9")),
      ];

interface Stored {
  id: string;
  kind: Kind;
  fileName: string;
  periodId: string;
  createdAt: string;
  createdAtMs?: number;
  readyAt?: number;
  rows: Row[];
}

const seeds = (): Stored[] => [
  {
    id: "rec-1",
    kind: "bank_ledger",
    fileName: "Bank çıxarışı sentyabr.csv",
    periodId: "2026-09",
    createdAt: "2026-10-03T11:00:00Z",
    rows: rowsFor("bank_ledger", "rec-1"),
  },
  {
    id: "rec-2",
    kind: "invoices_etaxes",
    fileName: "e-qaimə reyestri 2026-09.xml",
    periodId: "2026-09",
    createdAt: "2026-10-04T12:00:00Z",
    rows: rowsFor("invoices_etaxes", "rec-2"),
  },
];

let db = seeds();
let counter = 2;
export function resetReconciliation(): void {
  db = seeds();
  counter = 2;
}

function summary(stored: Stored): Reconciliation["summary"] {
  const open = stored.rows.filter((entry) => entry.status !== "confirmed");
  return {
    confirmed: stored.rows.filter((entry) => entry.status === "confirmed").length,
    suggested: stored.rows.filter((entry) => entry.status === "suggested").length,
    unmatched: stored.rows.filter((entry) => entry.status === "unmatched" || entry.status === "rejected").length,
    differenceTotal: formatDec(open.reduce((total, entry) => total + parseDec(entry.difference ?? "0"), 0n)),
    currency: "AZN",
  };
}

function toReconciliation(stored: Stored): Reconciliation {
  const running = stored.readyAt !== undefined && Date.now() < stored.readyAt;
  return {
    id: stored.id,
    kind: stored.kind,
    fileName: stored.fileName,
    periodId: stored.periodId,
    status: running ? "running" : "ready",
    statusDetail: null,
    summary: running
      ? { confirmed: 0, suggested: 0, unmatched: 0, differenceTotal: "0.00", currency: "AZN" }
      : summary(stored),
    createdAt: stored.createdAt,
  };
}

export const allReconciliations = (): Reconciliation[] =>
  db.map(toReconciliation).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const findReconciliation = (id: string) => db.find((entry) => entry.id === id);
export const reconciliationOf = toReconciliation;

export function createReconciliation(kind: Kind, fileName: string, periodId: string): Stored {
  const now = Date.now();
  const id = `rec-${++counter}`;
  const created: Stored = {
    id,
    kind,
    fileName,
    periodId,
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    readyAt: now + processingMs.value,
    rows: rowsFor(kind, id),
  };
  db = [created, ...db];
  return created;
}

export function rowsOf(stored: Stored, status: Row["status"] | null): Row[] {
  return stored.rows.filter((entry) => !status || entry.status === status);
}

export type DecisionResult = { ok: true; row: Row } | { ok: false; reason: "not-found" | "conflict" };

/** Only a suggestion can be decided, and only once. A person decides; the model only suggests. */
export function decide(stored: Stored, rowId: string, decision: "confirmed" | "rejected"): DecisionResult {
  const target = stored.rows.find((entry) => entry.id === rowId);
  if (!target) return { ok: false, reason: "not-found" };
  if (target.status !== "suggested") return { ok: false, reason: "conflict" };
  target.status = decision;
  target.confidence = null;
  return { ok: true, row: target };
}
