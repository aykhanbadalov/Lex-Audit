// DEMO CONTENT. Workbooks, columns and counts are invented; the real profiling and operations belong to the backend.
import type { components } from "@/api/schema";
import { addUploadedFile } from "./files";
import { processingMs } from "./files";

type Workbook = components["schemas"]["Workbook"];
type WorkbookDetail = components["schemas"]["WorkbookDetail"];
type Sheet = components["schemas"]["Sheet"];
type ExcelJob = components["schemas"]["ExcelJob"];
type ExcelJobRequest = components["schemas"]["ExcelJobRequest"];

const salesSheet = (): Sheet => ({
  name: "Satışlar",
  rowCount: 240,
  columns: [
    {
      letter: "A",
      name: "Tarix",
      detectedType: "date",
      meaning: { label: "Tarix", confidence: 0.98 },
      filled: 240,
      empty: 0,
      duplicates: 190,
      samples: ["03.09.2026", "2026-09-04", "5/9/26"],
    },
    {
      letter: "B",
      name: "Müştəri",
      detectedType: "text",
      meaning: { label: "Kontragent", confidence: 0.95 },
      filled: 238,
      empty: 2,
      duplicates: 205,
      samples: ["Alfa MMC", " Beta ASC", "Qamma LTD"],
    },
    {
      letter: "C",
      name: "VÖEN",
      detectedType: "taxId",
      meaning: { label: "VÖEN", confidence: 0.93 },
      filled: 225,
      empty: 15,
      duplicates: 214,
      samples: ["1234567891", " 2345678912", "12345"],
    },
    {
      letter: "D",
      name: "Məbləğ",
      detectedType: "money",
      meaning: { label: "Məbləğ", confidence: 0.97 },
      filled: 240,
      empty: 0,
      duplicates: 22,
      samples: ["1500.00", "383.50", "5487.00"],
    },
    {
      letter: "E",
      name: "Qeyd",
      detectedType: "text",
      meaning: { label: "Şərh", confidence: 0.62 },
      filled: 31,
      empty: 209,
      duplicates: 12,
      samples: ["təcili", "yoxlanılıb"],
    },
  ],
});

interface StoredJob {
  id: string;
  request: ExcelJobRequest;
  createdAtMs: number;
  readyAt: number;
  createdAt: string;
  outputFileId: string | null;
  outputFileName: string | null;
}

interface StoredWorkbook {
  id: string;
  fileName: string;
  createdAt: string;
  createdAtMs?: number;
  readyAt?: number;
  fixedStatus?: Workbook["status"];
  jobs: StoredJob[];
}

const seeds = (): StoredWorkbook[] => [
  {
    id: "wb-sales",
    fileName: "Satış reyestri.xlsx",
    createdAt: "2026-10-05T09:00:00Z",
    fixedStatus: "ready",
    jobs: [],
  },
  {
    id: "wb-bank",
    fileName: "Bank çıxarışı sentyabr.xlsx",
    createdAt: "2026-10-02T10:30:00Z",
    fixedStatus: "ready",
    jobs: [],
  },
  {
    id: "wb-wait",
    fileName: "Yeni reyestr.xlsx",
    createdAt: "2026-10-09T06:00:00Z",
    fixedStatus: "profiling",
    jobs: [],
  },
];

let db = seeds();
let counter = 0;

export function resetExcel(): void {
  db = seeds();
  counter = 0;
}

function statusOf(workbook: StoredWorkbook): Workbook["status"] {
  if (workbook.fixedStatus) return workbook.fixedStatus;
  const elapsed = Date.now() - (workbook.createdAtMs ?? 0);
  const total = (workbook.readyAt ?? 0) - (workbook.createdAtMs ?? 0);
  if (elapsed < total / 2) return "uploaded";
  if (elapsed < total) return "profiling";
  return workbook.fileName.toLowerCase().includes("xəta") ? "failed" : "ready";
}

function toWorkbook(workbook: StoredWorkbook): Workbook {
  const status = statusOf(workbook);
  return {
    id: workbook.id,
    fileName: workbook.fileName,
    status,
    statusDetail: status === "failed" ? "Fayl oxuna bilmədi (demo xətası)." : null,
    sheetCount: status === "ready" ? 1 : 0,
    rowCount: status === "ready" ? 240 : 0,
    createdAt: workbook.createdAt,
    updatedAt: workbook.createdAt,
  };
}

const RESULTS: Record<
  ExcelJobRequest["operation"],
  { changed: number; removed: number; suffix: string; changes: ExcelJob["changes"] }
> = {
  trim_spaces: {
    changed: 15,
    removed: 0,
    suffix: "təmizlənmiş",
    changes: [
      { row: 7, column: "C", before: " 2345678912", after: "2345678912" },
      { row: 19, column: "C", before: "1234567891 ", after: "1234567891" },
      { row: 33, column: "B", before: " Beta ASC", after: "Beta ASC" },
    ],
  },
  remove_duplicates: { changed: 0, removed: 12, suffix: "təkrarsız", changes: [] },
  normalize_dates: {
    changed: 87,
    removed: 0,
    suffix: "tarixlər",
    changes: [
      { row: 3, column: "A", before: "2026-09-04", after: "04.09.2026" },
      { row: 8, column: "A", before: "5/9/26", after: "05.09.2026" },
    ],
  },
};

function toJob(workbook: StoredWorkbook, job: StoredJob): ExcelJob {
  const elapsed = Date.now() - job.createdAtMs;
  const total = job.readyAt - job.createdAtMs;
  const status: ExcelJob["status"] = elapsed < total / 2 ? "queued" : elapsed < total ? "running" : "done";
  const result = RESULTS[job.request.operation];

  // The result is a NEW file under Files. It is created once, the first time the job is seen finished.
  if (status === "done" && !job.outputFileId) {
    const base = workbook.fileName.replace(/\.[^.]+$/, "");
    job.outputFileName = `${base} (${result.suffix}).xlsx`;
    job.outputFileId = addUploadedFile({
      name: job.outputFileName,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 90_000,
      folder: "/Excel",
      tags: ["excel"],
    }).id;
  }
  return {
    id: job.id,
    workbookId: workbook.id,
    operation: job.request.operation,
    sheet: job.request.sheet,
    columns: job.request.columns,
    status,
    statusDetail: null,
    rowsRead: status === "done" ? 240 : 0,
    rowsChanged: status === "done" ? result.changed : 0,
    rowsRemoved: status === "done" ? result.removed : 0,
    changes: status === "done" ? result.changes : [],
    outputFileId: status === "done" ? job.outputFileId : null,
    outputFileName: status === "done" ? job.outputFileName : null,
    createdAt: job.createdAt,
  };
}

export const allWorkbooks = (): Workbook[] => db.map(toWorkbook).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const findWorkbook = (id: string) => db.find((workbook) => workbook.id === id);

export function toDetail(workbook: StoredWorkbook): WorkbookDetail {
  const ready = statusOf(workbook) === "ready";
  return {
    ...toWorkbook(workbook),
    sheets: ready ? [salesSheet()] : [],
    jobs: [...workbook.jobs].reverse().map((job) => toJob(workbook, job)),
  };
}

export function createWorkbook(fileName: string): StoredWorkbook {
  const now = Date.now();
  const created: StoredWorkbook = {
    id: `wb-up-${++counter}`,
    fileName,
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    readyAt: now + processingMs.value,
    jobs: [],
  };
  db = [created, ...db];
  return created;
}

export type JobResult = { ok: true; job: ExcelJob } | { ok: false; reason: "conflict" | "invalid" };

export function createJob(workbook: StoredWorkbook, request: ExcelJobRequest): JobResult {
  if (statusOf(workbook) !== "ready") return { ok: false, reason: "conflict" };
  const sheet = salesSheet();
  const letters = new Set(sheet.columns.map((column) => column.letter));
  const valid =
    request.sheet === sheet.name &&
    request.columns.every((letter) => letters.has(letter)) &&
    (request.operation !== "remove_duplicates" || request.columns.length >= 1) &&
    (request.operation !== "normalize_dates" || request.columns.length === 1);
  if (!valid) return { ok: false, reason: "invalid" };

  const now = Date.now();
  const job: StoredJob = {
    id: `job-${++counter}`,
    request,
    createdAtMs: now,
    readyAt: now + processingMs.value,
    createdAt: new Date(now).toISOString(),
    outputFileId: null,
    outputFileName: null,
  };
  workbook.jobs.push(job);
  return { ok: true, job: toJob(workbook, job) };
}

export function findJob(id: string): ExcelJob | undefined {
  for (const workbook of db) {
    const job = workbook.jobs.find((candidate) => candidate.id === id);
    if (job) return toJob(workbook, job);
  }
  return undefined;
}
