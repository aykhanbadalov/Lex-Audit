// DEMO CONTENT. Columns, rows and counts are invented; the real parsing and validation belong to the backend.
import type { components } from "@/api/schema";
import { addUploadedFile, processingMs } from "./files";

type Source = components["schemas"]["ImportSource"];
type ImportJob = components["schemas"]["ImportJob"];
type ImportDetail = components["schemas"]["ImportDetail"];
type Field = components["schemas"]["ImportTargetField"];
type RowError = components["schemas"]["ImportRowError"];

const FIELDS: Record<Source, Field[]> = {
  onec: [
    { key: "date", required: true },
    { key: "number", required: true },
    { key: "counterparty", required: true },
    { key: "voen", required: false },
    { key: "amount", required: true },
    { key: "currency", required: false },
  ],
  etaxes: [
    { key: "number", required: true },
    { key: "date", required: true },
    { key: "voen", required: true },
    { key: "net", required: false },
    { key: "vat", required: false },
    { key: "gross", required: true },
  ],
  bank: [
    { key: "date", required: true },
    { key: "description", required: true },
    { key: "amount", required: true },
    { key: "reference", required: false },
  ],
};

// 1C exports often carry Russian headers; the server proposes a mapping by name.
const COLUMNS: Record<Source, string[]> = {
  onec: ["Дата", "Номер", "Контрагент", "VÖEN", "Сумма", "Валюта"],
  etaxes: ["Qaimənin nömrəsi", "Tarix", "VÖEN", "ƏDV-siz", "ƏDV", "Cəmi"],
  bank: ["Tarix", "Təsvir", "Debet", "Kredit", "Referans"],
};

const PROPOSED: Record<Source, Record<string, string | null>> = {
  onec: {
    date: "Дата",
    number: "Номер",
    counterparty: "Контрагент",
    voen: "VÖEN",
    amount: "Сумма",
    currency: "Валюта",
  },
  etaxes: { number: "Qaimənin nömrəsi", date: "Tarix", voen: "VÖEN", net: "ƏDV-siz", vat: "ƏDV", gross: "Cəmi" },
  // A bank statement has Debit and Credit, not one amount: the server cannot choose, a person must.
  bank: { date: "Tarix", description: "Təsvir", amount: null, reference: "Referans" },
};

/** Four sample rows, keyed by column name. Row 3 holds a date that does not exist. */
const SAMPLE: Record<Source, Record<string, string>[]> = {
  onec: [
    { Дата: "02.09.2026", Номер: "SF-1", Контрагент: "Qamma LTD", VÖEN: "3456789123", Сумма: "5487.00", Валюта: "AZN" },
    {
      Дата: "05.09.2026",
      Номер: "SF-2",
      Контрагент: "Sigma Trade",
      VÖEN: "4567891234",
      Сумма: "2400.00",
      Валюта: "USD",
    },
    { Дата: "31.02.2026", Номер: "SF-3", Контрагент: "Alfa MMC", VÖEN: "1234567891", Сумма: "383.50", Валюта: "AZN" },
    { Дата: "09.09.2026", Номер: "SF-4", Контрагент: "Beta ASC", VÖEN: "2345678912", Сумма: "1770.00", Валюта: "AZN" },
  ],
  etaxes: [
    {
      "Qaimənin nömrəsi": "AF-0457",
      Tarix: "28.09.2026",
      VÖEN: "1234567891",
      "ƏDV-siz": "325.00",
      ƏDV: "58.50",
      Cəmi: "383.50",
    },
    {
      "Qaimənin nömrəsi": "BT-118",
      Tarix: "02.10.2026",
      VÖEN: "2345678912",
      "ƏDV-siz": "1500.00",
      ƏDV: "270.00",
      Cəmi: "1770.00",
    },
    {
      "Qaimənin nömrəsi": "ET-902",
      Tarix: "31.02.2026",
      VÖEN: "7891234567",
      "ƏDV-siz": "2290.00",
      ƏDV: "16.20",
      Cəmi: "2306.20",
    },
    {
      "Qaimənin nömrəsi": "DL-7",
      Tarix: "05.10.2026",
      VÖEN: "12345",
      "ƏDV-siz": "300.00",
      ƏDV: "54.00",
      Cəmi: "354.00",
    },
  ],
  bank: [
    { Tarix: "02.09.2026", Təsvir: "Daxilolma — Qamma LTD", Debet: "5487.00", Kredit: "", Referans: "TRX-1001" },
    { Tarix: "05.09.2026", Təsvir: "Ödəniş — Alfa MMC", Debet: "", Kredit: "383.50", Referans: "TRX-1002" },
    { Tarix: "31.02.2026", Təsvir: "Komissiya", Debet: "", Kredit: "12.00", Referans: "TRX-1003" },
    { Tarix: "20.09.2026", Təsvir: "Naməlum ödəniş", Debet: "", Kredit: "120.00", Referans: "TRX-1005" },
  ],
};

interface Stored {
  id: string;
  source: Source;
  fileName: string;
  createdAt: string;
  createdAtMs?: number;
  readyAt?: number;
  fixed?: ImportJob["status"];
  mapping: Record<string, string | null>;
  committedAt?: number;
  committedFailed?: number;
}

const seeds = (): Stored[] => [
  {
    id: "imp-1",
    source: "onec",
    fileName: "1C satışlar sentyabr.xlsx",
    createdAt: "2026-10-01T09:00:00Z",
    fixed: "done",
    mapping: { ...PROPOSED.onec },
  },
  {
    id: "imp-2",
    source: "bank",
    fileName: "Bank çıxarışı sentyabr.csv",
    createdAt: "2026-10-03T11:00:00Z",
    fixed: "needs_mapping",
    mapping: { ...PROPOSED.bank },
  },
];

let db = seeds();
let counter = 2;
export function resetImports(): void {
  db = seeds();
  counter = 2;
}

const ROW_COUNT = 120;
const DUPLICATES = 3;
const isDate = (value: string) => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return false;
  const [, day, month, year] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDate() === day && date.getUTCMonth() === month - 1;
};
const isAmount = (value: string) => /^-?\d+(\.\d+)?$/.test(value);
const isVoen = (value: string) => /^\d{10}$/.test(value);

/** The server's view of one row for one field, given the chosen column. */
function checkField(field: string, value: string): RowError["code"] | null {
  if (field === "date" && !isDate(value)) return "INVALID_DATE";
  if (["amount", "net", "vat", "gross"].includes(field) && value !== "" && !isAmount(value)) return "INVALID_AMOUNT";
  if (field === "amount" && value === "") return "INVALID_AMOUNT";
  if (field === "voen" && value !== "" && !isVoen(value)) return "INVALID_TAX_ID";
  return null;
}

function analyse(stored: Stored) {
  const fields = FIELDS[stored.source];
  const unmapped = fields.filter((field) => field.required && !stored.mapping[field.key]);
  const preview = SAMPLE[stored.source].map((sample, index) => ({
    row: index + 1,
    values: Object.fromEntries(
      fields.flatMap((field) =>
        stored.mapping[field.key] ? [[field.key, sample[stored.mapping[field.key]!] ?? ""]] : [],
      ),
    ),
  }));
  const errors: RowError[] = unmapped.map((field) => ({ row: 0, field: field.key, code: "REQUIRED_UNMAPPED" }));
  for (const entry of preview) {
    for (const [field, value] of Object.entries(entry.values)) {
      const code = checkField(field, value);
      if (code) errors.push({ row: entry.row, field, code });
    }
  }
  const rowErrors = errors.filter((error) => error.row > 0);
  const failedRows = new Set(rowErrors.map((error) => error.row)).size;
  // Bad rows are reported and skipped, but an import where every previewed row is bad is almost certainly mis-mapped.
  const canCommit = unmapped.length === 0 && failedRows < preview.length;
  return { preview, errors, canCommit, failedRows };
}

function status(stored: Stored): ImportJob["status"] {
  if (stored.committedAt !== undefined) return Date.now() < stored.committedAt ? "importing" : "done";
  if (stored.fixed) return stored.fixed;
  if (stored.readyAt !== undefined && Date.now() < stored.readyAt) return "analysing";
  return FIELDS[stored.source].some((field) => field.required && !stored.mapping[field.key])
    ? "needs_mapping"
    : "ready";
}

function toJob(stored: Stored): ImportJob {
  const current = status(stored);
  const { failedRows } = analyse(stored);
  const failed = stored.committedFailed ?? failedRows;
  return {
    id: stored.id,
    source: stored.source,
    fileName: stored.fileName,
    status: current,
    statusDetail: null,
    rowCount: current === "analysing" ? 0 : ROW_COUNT,
    summary:
      current === "done"
        ? { rowsTotal: ROW_COUNT, rowsOk: ROW_COUNT - failed - DUPLICATES, rowsFailed: failed, duplicates: DUPLICATES }
        : null,
    createdAt: stored.createdAt,
  };
}

export const allImports = (): ImportJob[] => db.map(toJob).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const findImport = (id: string) => db.find((entry) => entry.id === id);

export function toDetail(stored: Stored): ImportDetail {
  const analysing = status(stored) === "analysing";
  const { preview, errors, canCommit } = analyse(stored);
  const editable = ["needs_mapping", "ready"].includes(status(stored));
  return {
    ...toJob(stored),
    columns: analysing
      ? []
      : COLUMNS[stored.source].map((name) => ({
          name,
          samples: SAMPLE[stored.source]
            .slice(0, 2)
            .map((sample) => sample[name] ?? "")
            .filter(Boolean),
        })),
    targetFields: FIELDS[stored.source],
    mapping: stored.mapping,
    preview: analysing ? [] : preview,
    errors: analysing ? [] : errors,
    canCommit: editable && canCommit,
  };
}

export function createImport(source: Source, fileName: string): Stored {
  const now = Date.now();
  const created: Stored = {
    id: `imp-${++counter}`,
    source,
    fileName,
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    readyAt: now + processingMs.value,
    mapping: { ...PROPOSED[source] },
  };
  db = [created, ...db];
  return created;
}

export type MappingResult = { ok: true } | { ok: false; reason: "conflict" | "invalid" };

export function saveMapping(stored: Stored, mapping: Record<string, string | null>): MappingResult {
  if (!["needs_mapping", "ready"].includes(status(stored))) return { ok: false, reason: "conflict" };
  const targets = new Set(FIELDS[stored.source].map((field) => field.key));
  const columns = new Set(COLUMNS[stored.source]);
  const chosen = Object.values(mapping).filter((column): column is string => Boolean(column));
  const valid =
    Object.keys(mapping).every((key) => targets.has(key)) &&
    chosen.every((column) => columns.has(column)) &&
    new Set(chosen).size === chosen.length;
  if (!valid) return { ok: false, reason: "invalid" };
  stored.mapping = Object.fromEntries(FIELDS[stored.source].map((field) => [field.key, mapping[field.key] ?? null]));
  stored.fixed = undefined;
  return { ok: true };
}

export function commit(stored: Stored): "ok" | "conflict" {
  const detail = toDetail(stored);
  if (!detail.canCommit) return "conflict";
  stored.committedFailed = analyse(stored).failedRows;
  stored.committedAt = Date.now() + processingMs.value;
  return "ok";
}

export function exportToOneC(periodId: string) {
  return addUploadedFile({
    name: `1c-export-${periodId}.xml`,
    mimeType: "application/xml",
    sizeBytes: 48_000,
    folder: "/1C",
    tags: ["1c", "ixrac"],
  });
}
