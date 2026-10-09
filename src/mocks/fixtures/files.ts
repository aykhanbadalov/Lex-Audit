// DEMO CONTENT. File names and texts are invented.
import type { components } from "../draft/schema";

type FileRecord = components["schemas"]["File"];
type FileDetail = components["schemas"]["FileDetail"];
type FileStatus = components["schemas"]["FileStatus"];

/** How long a freshly uploaded file takes to go pending → extracting → ready. Tests must not wait seconds. */
export const processingMs = { value: import.meta.env.MODE === "test" ? 120 : 4000 };

interface StoredFile extends FileRecord {
  /** Set for uploaded files: the moment extraction finishes. Seeded files keep their fixed status. */
  readyAt?: number;
  createdAtMs?: number;
  preview: string | null;
  content: string;
}

const iso = (value: string) => new Date(value).toISOString();

const seeds = (): StoredFile[] => [
  file(
    "file-contract-alfa",
    "Müqavilə - Alfa MMC.pdf",
    "application/pdf",
    482_113,
    "/Müqavilələr",
    ["müqavilə", "təchizatçı"],
    "ready",
    "2026-09-30T08:10:00Z",
    "Alfa MMC ilə təchizat müqaviləsi. Tərəflər, qiymət və ödəniş şərtləri. (demo mətn)",
  ),
  file(
    "file-vat-q3",
    "ƏDV bəyannaməsi Q3.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    91_204,
    "/Bəyannamələr",
    ["ƏDV", "bəyannamə"],
    "ready",
    "2026-10-05T11:30:00Z",
    "Cədvəl 1: hesablanmış ƏDV. Cədvəl 2: əvəzləşdirilən ƏDV. (demo mətn)",
  ),
  file(
    "file-bank-sep",
    "Bank çıxarışı sentyabr.csv",
    "text/csv",
    40_120,
    "/Bank",
    ["bank", "uzlaşdırma"],
    "ready",
    "2026-10-02T09:00:00Z",
    "tarix;təsvir;məbləğ\n2026-09-01;Daxilolma;1200.00 (demo mətn)",
  ),
  file(
    "file-scan-0457",
    "Skan - qaimə 0457.jpg",
    "image/jpeg",
    1_204_551,
    "/Qaimələr",
    ["qaimə", "skan"],
    "failed",
    "2026-10-08T14:45:00Z",
    null,
    "OCR mətni oxuya bilmədi: şəkil çox tutqundur.",
  ),
  file(
    "file-einvoice-registry",
    "e-qaimə reyestri 2026-09.xml",
    "application/xml",
    212_004,
    "/Qaimələr",
    ["e-qaimə"],
    "extracting",
    "2026-10-09T05:55:00Z",
    null,
  ),
  file(
    "file-payroll",
    "Əmək haqqı cədvəli.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    66_310,
    "/Kadr",
    ["əmək haqqı"],
    "ready",
    "2026-09-28T07:20:00Z",
    "İşçi, əmək haqqı, tutulmalar. (demo mətn)",
  ),
  file(
    "file-letter",
    "Rəsmi məktub.pdf",
    "application/pdf",
    150_880,
    "/Yazışmalar",
    ["məktub"],
    "ready",
    "2026-09-25T13:05:00Z",
    "Vergi xidmətinə göndərilən izahat məktubu. (demo mətn)",
  ),
  file(
    "file-assets",
    "Əsas vəsaitlər reyestri.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    118_700,
    "/Uçot",
    ["əsas vəsait", "amortizasiya"],
    "ready",
    "2026-09-20T10:00:00Z",
    "İnventar nömrəsi, ilkin dəyər, amortizasiya. (demo mətn)",
  ),
  file(
    "file-queue",
    "Gözləyən sənəd.pdf",
    "application/pdf",
    72_000,
    "/Qaimələr",
    [],
    "pending",
    "2026-10-09T06:10:00Z",
    null,
  ),
  file(
    "file-archive-zip",
    "Q2 sənədlər toplusu.zip",
    "application/zip",
    8_420_000,
    "/Arxiv",
    ["arxiv"],
    "ready",
    "2026-07-15T09:00:00Z",
    null,
  ),
  file(
    "file-agreement-beta",
    "Müqavilə - Beta ASC.pdf",
    "application/pdf",
    390_540,
    "/Müqavilələr",
    ["müqavilə"],
    "ready",
    "2026-09-12T12:00:00Z",
    "Beta ASC ilə xidmət müqaviləsi. (demo mətn)",
  ),
  file(
    "file-tax-letter",
    "Vergi bildirişi.pdf",
    "application/pdf",
    54_020,
    "/Yazışmalar",
    ["vergi"],
    "ready",
    "2026-09-10T08:00:00Z",
    "Vergi orqanından daxil olan bildiriş. (demo mətn)",
  ),
  {
    ...file(
      "file-old-contract",
      "Köhnə müqavilə (arxiv).pdf",
      "application/pdf",
      310_220,
      "/Arxiv",
      ["müqavilə"],
      "ready",
      "2025-12-01T10:00:00Z",
      "Müddəti bitmiş müqavilə. (demo mətn)",
    ),
    isArchived: true,
  },
];

function file(
  id: string,
  name: string,
  mimeType: string,
  sizeBytes: number,
  folder: string,
  tags: string[],
  status: FileStatus,
  createdAt: string,
  preview: string | null,
  statusDetail: string | null = null,
): StoredFile {
  return {
    id,
    name,
    mimeType,
    sizeBytes,
    folder,
    tags,
    status,
    statusDetail,
    ownerName: "Aygün Məmmədova",
    isArchived: false,
    currentVersionNo: 1,
    createdAt: iso(createdAt),
    updatedAt: iso(createdAt),
    preview,
    content: `Demo fayl: ${name}`,
  };
}

let db: StoredFile[] = seeds();

export function resetFilesDb(): void {
  db = seeds();
}

/** Uploaded files move on by themselves, like the background job would. Seeded files keep their fixed status. */
function settle(stored: StoredFile): StoredFile {
  if (stored.readyAt === undefined || stored.createdAtMs === undefined) return stored;
  const elapsed = Date.now() - stored.createdAtMs;
  const total = stored.readyAt - stored.createdAtMs;
  if (elapsed < total / 2) stored.status = "pending";
  else if (elapsed < total) stored.status = "extracting";
  else if (stored.name.toLowerCase().includes("xəta")) {
    stored.status = "failed";
    stored.statusDetail = "Sənədi oxumaq mümkün olmadı (demo xətası).";
  } else {
    stored.status = "ready";
    stored.statusDetail = null;
    stored.preview ??= `${stored.name} faylından çıxarılmış mətn. (demo mətn)`;
  }
  return stored;
}

export function allFiles(): StoredFile[] {
  return db.map(settle);
}

export function findFile(id: string): StoredFile | undefined {
  const found = db.find((candidate) => candidate.id === id);
  return found ? settle(found) : undefined;
}

export function addUploadedFile(input: {
  name: string;
  mimeType: string;
  sizeBytes: number;
  folder: string;
  tags: string[];
}): StoredFile {
  const now = Date.now();
  const created: StoredFile = {
    ...input,
    id: `file-up-${crypto.randomUUID().slice(0, 8)}`,
    status: "pending",
    statusDetail: null,
    ownerName: "Aygün Məmmədova",
    isArchived: false,
    currentVersionNo: 1,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    createdAtMs: now,
    readyAt: now + processingMs.value,
    preview: null,
    content: `Demo fayl: ${input.name}`,
  };
  db = [created, ...db];
  return created;
}

export function touch(stored: StoredFile): void {
  stored.updatedAt = new Date().toISOString();
}

export function restartProcessing(stored: StoredFile): void {
  const now = Date.now();
  stored.status = "pending";
  stored.statusDetail = null;
  stored.createdAtMs = now;
  stored.readyAt = now + processingMs.value;
  touch(stored);
}

/** The detail view adds versions, usage and the extracted-text preview to a file. */
export function toDetail(stored: StoredFile): FileDetail {
  const { preview, content: _content, readyAt: _readyAt, createdAtMs: _createdAtMs, ...file } = stored;
  void _content;
  void _readyAt;
  void _createdAtMs;
  return {
    ...file,
    extractedTextPreview: stored.status === "ready" ? preview : null,
    versions: [
      {
        id: `${stored.id}-v1`,
        versionNo: 1,
        sizeBytes: stored.sizeBytes,
        sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        uploadedAt: stored.createdAt,
        uploadedByName: stored.ownerName,
      },
    ],
    usage:
      stored.status === "ready"
        ? [
            {
              id: `${stored.id}-u1`,
              action: "indexed",
              actorName: "Sistem",
              occurredAt: stored.updatedAt,
              detail: "Axtarış indeksinə əlavə olundu.",
            },
          ]
        : [],
  };
}

export function toRecord(stored: StoredFile): FileRecord {
  const { preview: _preview, content: _content, readyAt: _readyAt, createdAtMs: _createdAtMs, ...record } = stored;
  void _preview;
  void _content;
  void _readyAt;
  void _createdAtMs;
  return record;
}
