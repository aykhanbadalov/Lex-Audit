// Excel jobs, reconciliations, imports and the 1C export, in the shapes the real backend sends.
import { delay, http, HttpResponse } from "msw";
import { addUploadedFile, findFile } from "../fixtures/files";
import { addApprovalRequest, findApproval, registerEffect } from "../fixtures/approvals";
import { allJournalEntries } from "../fixtures/invoices";
import { recordAudit } from "../fixtures/audit";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(200));
/** How long a background job "runs" before it is done. Tests shorten it. */
export const jobConfig = { ms: import.meta.env.MODE === "test" ? 120 : 1500 };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- excel jobs ----------

interface Job {
  id: string;
  operation: "profile" | "clean" | "reconcile" | "report";
  inputFileId: string | null;
  params: Record<string, unknown>;
  createdAt: number;
  outputFileId: string | null;
}
let jobs = new Map<string, Job>();
let counter = 0;

function jobResult(job: Job): { result: unknown; outputFileId: string | null } {
  if (job.operation === "profile") {
    return {
      outputFileId: job.outputFileId,
      result: {
        rows: 120,
        emptyRows: 2,
        duplicateRows: 6,
        truncated: false,
        columns: [
          {
            name: "Tarix",
            type: "date",
            nonEmpty: 118,
            distinct: 30,
            samples: ["2026-09-01", "2026-09-02"],
            unparsable: 0,
          },
          {
            name: "Məbləğ",
            type: "number",
            nonEmpty: 118,
            distinct: 90,
            sum: "31500.50",
            min: "10.00",
            max: "4200.00",
            samples: ["120.00", "75.50"],
            unparsable: 1,
          },
          {
            name: "Müştəri",
            type: "text",
            nonEmpty: 120,
            distinct: 14,
            samples: ["Alfa MMC", "Beta ASC"],
            unparsable: 0,
          },
        ],
      },
    };
  }
  if (job.operation === "clean") {
    const dedupe = job.params.dedupe !== false;
    return {
      outputFileId: job.outputFileId,
      result: {
        rowsIn: 120,
        rowsOut: dedupe ? 112 : 118,
        log: dedupe ? ["2 boş sətir silindi", "6 təkrarlanan sətir silindi"] : ["2 boş sətir silindi"],
      },
    };
  }
  return { outputFileId: job.outputFileId, result: { template: job.params.template ?? "report", rows: 42 } };
}

function wireJob(job: Job) {
  const done = Date.now() - job.createdAt >= jobConfig.ms;
  const base = {
    id: job.id,
    operation: job.operation,
    inputFileId: job.inputFileId,
    createdAt: new Date(job.createdAt).toISOString(),
    error: null,
  };
  if (!done) return { ...base, outputFileId: null, status: "running" as const, result: null };
  const { result, outputFileId } = jobResult(job);
  return { ...base, outputFileId, status: "done" as const, result };
}

// ---------- reconciliations ----------

interface Match {
  id: string;
  matchType: "exact" | "amount_mismatch" | "amount_date" | "unmatched_left" | "unmatched_right";
  confidence: string;
  left: { ref: string; key: string; amount: string; date: string | null } | null;
  right: { ref: string; key: string; amount: string; date: string | null } | null;
  difference: string | null;
  explanation: string;
  status: "proposed" | "confirmed";
}
interface Recon {
  id: string;
  leftSource: string;
  rightSource: string;
  matches: Match[];
}
let recons = new Map<string, Recon>();

function buildRecon(id: string, left: string, right: string): Recon {
  const side = (ref: string, key: string, amount: string, date: string) => ({ ref, key, amount, date });
  const m = (
    n: number,
    matchType: Match["matchType"],
    l: Match["left"],
    r: Match["right"],
    difference: string | null,
    explanation: string,
  ): Match => ({
    id: `${id}-m${n}`,
    matchType,
    confidence: matchType === "exact" ? "1.00" : "0.80",
    left: l,
    right: r,
    difference,
    explanation,
    status: "proposed",
  });
  return {
    id,
    leftSource: left,
    rightSource: right,
    matches: [
      m(
        1,
        "exact",
        side("row 2", "AF-0457", "383.50", "2026-09-29"),
        side("inv", "AF-0457", "383.50", "2026-09-29"),
        null,
        "Nömrə və məbləğ eynidir",
      ),
      m(
        2,
        "exact",
        side("row 3", "SF-2026-044", "1500.00", "2026-09-30"),
        side("inv", "SF-2026-044", "1500.00", "2026-09-30"),
        null,
        "Nömrə və məbləğ eynidir",
      ),
      m(
        3,
        "amount_mismatch",
        side("row 4", "BT-118", "1770.00", "2026-10-03"),
        side("inv", "BT-118", "1750.00", "2026-10-03"),
        "20.00",
        "Nömrə eynidir, məbləğ fərqlidir",
      ),
      m(
        4,
        "unmatched_left",
        side("row 5", "DL-7", "354.00", "2026-09-22"),
        null,
        null,
        "Sağ tərəfdə uyğun yazı tapılmadı",
      ),
      m(
        5,
        "unmatched_right",
        null,
        side("inv", "EP-31", "162.00", "2026-10-07"),
        null,
        "Sol tərəfdə uyğun yazı tapılmadı",
      ),
    ],
  };
}

function wireRecon(recon: Recon) {
  return {
    id: recon.id,
    leftSource: recon.leftSource,
    rightSource: recon.rightSource,
    status: "done",
    summary: summaryOf(recon),
    matches: recon.matches,
  };
}
function summaryOf(recon: Recon) {
  const count = (type: Match["matchType"]) => recon.matches.filter((match) => match.matchType === type).length;
  return {
    exact: count("exact"),
    amountMismatch: count("amount_mismatch"),
    amountDate: count("amount_date"),
    unmatchedLeft: count("unmatched_left"),
    unmatchedRight: count("unmatched_right"),
    skipped: 0,
    leftTotal: "3607.50",
    rightTotal: "3795.50",
  };
}

// ---------- imports ----------

interface Imp {
  id: string;
  source: string;
  fileName: string;
  rowsOk: number;
  rowsFailed: number;
  status: "previewed" | "approval_required" | "imported";
  approvalId: string | null;
}
let imports = new Map<string, Imp>();

export function resetWork(): void {
  jobs = new Map();
  recons = new Map();
  imports = new Map();
  counter = 0;
}
export const resetWorkUploadKeys = resetWork;

const sourceSpecOk = (spec: {
  type?: string;
  fileId?: string;
  from?: string;
  to?: string;
  keyColumn?: string;
  amountColumn?: string;
}) =>
  spec.type === "file"
    ? Boolean(spec.fileId && spec.keyColumn && spec.amountColumn && findFile(spec.fileId))
    : spec.type === "invoices"
      ? Boolean(spec.from && DATE.test(spec.from) && spec.to && DATE.test(spec.to))
      : spec.type === "bank";

export const workHandlers = [
  http.post(apiPath("/excel/jobs"), async ({ request }) => {
    const auth = authorize(request, "excel:use");
    if ("response" in auth) return auth.response;
    await latency();
    const body = (await request.json()) as {
      operation?: Job["operation"];
      inputFileId?: string;
      params?: Record<string, unknown>;
    };
    if (!body.operation || !["profile", "clean", "reconcile", "report"].includes(body.operation))
      return apiError(422, "VALIDATION_FAILED", "Unknown operation");
    if (body.inputFileId && !findFile(body.inputFileId)) return apiError(404, "NOT_FOUND", "Input file not found");
    if ((body.operation === "profile" || body.operation === "clean") && !body.inputFileId)
      return apiError(422, "VALIDATION_FAILED", "inputFileId is required");
    if (body.operation === "report") {
      const p = body.params as { template?: string; from?: string; to?: string } | undefined;
      if (
        !p ||
        !["invoices", "journal"].includes(p.template ?? "") ||
        !DATE.test(p.from ?? "") ||
        !DATE.test(p.to ?? "")
      )
        return apiError(422, "VALIDATION_FAILED", "Invalid report parameters");
    }
    const id = `job-${++counter}`;
    const output =
      body.operation === "profile"
        ? null
        : addUploadedFile({
            name: `${body.operation}-${id}.xlsx`,
            mimeType: "application/vnd.ms-excel",
            sizeBytes: 12_000,
            folder: "/Excel",
            tags: ["excel"],
          });
    const job: Job = {
      id,
      operation: body.operation,
      inputFileId: body.inputFileId ?? null,
      params: body.params ?? {},
      createdAt: Date.now(),
      outputFileId: output?.id ?? null,
    };
    jobs.set(id, job);
    recordAudit(auth.user, {
      action: "excel.job",
      resourceType: "excel_job",
      resourceId: id,
      resourceLabel: body.operation,
      outcome: "success",
    });
    return HttpResponse.json({ ...wireJob(job), status: "pending", result: null, outputFileId: null }, { status: 202 });
  }),

  http.get(apiPath("/excel/jobs/:id"), ({ request, params }) => {
    const auth = authorize(request, "excel:use");
    if ("response" in auth) return auth.response;
    const job = jobs.get(String(params.id));
    return job ? HttpResponse.json(wireJob(job)) : apiError(404, "NOT_FOUND", "Excel job not found");
  }),

  http.post(apiPath("/reconciliations"), async ({ request }) => {
    const auth = authorize(request, "excel:use");
    if ("response" in auth) return auth.response;
    await latency();
    const body = (await request.json()) as {
      left?: Parameters<typeof sourceSpecOk>[0];
      right?: Parameters<typeof sourceSpecOk>[0];
    };
    if (!body.left || !body.right || !sourceSpecOk(body.left) || !sourceSpecOk(body.right))
      return apiError(422, "VALIDATION_FAILED", "A source is incomplete or the file does not exist");
    const id = `rec-${++counter}`;
    const recon = buildRecon(id, body.left.type ?? "", body.right.type ?? "");
    recons.set(id, recon);
    recordAudit(auth.user, {
      action: "reconciliation.run",
      resourceType: "reconciliation",
      resourceId: id,
      resourceLabel: id,
      outcome: "success",
    });
    return HttpResponse.json({ id, summary: summaryOf(recon) }, { status: 201 });
  }),

  http.get(apiPath("/reconciliations/:id"), ({ request, params }) => {
    const auth = authorize(request, "excel:use");
    if ("response" in auth) return auth.response;
    const recon = recons.get(String(params.id));
    return recon ? HttpResponse.json(wireRecon(recon)) : apiError(404, "NOT_FOUND", "Reconciliation not found");
  }),

  http.post(apiPath("/reconciliations/:id/matches/:m/confirm"), ({ request, params }) => {
    const auth = authorize(request, "excel:use");
    if ("response" in auth) return auth.response;
    const match = recons.get(String(params.id))?.matches.find((candidate) => candidate.id === params.m);
    if (!match) return apiError(404, "NOT_FOUND", "Match not found");
    // Only a pair can be confirmed, and only once.
    if (!match.left || !match.right || match.status === "confirmed")
      return apiError(409, "CONFLICT", "The match cannot be confirmed");
    match.status = "confirmed";
    recordAudit(auth.user, {
      action: "reconciliation.confirm",
      resourceType: "reconciliation",
      resourceId: String(params.id),
      resourceLabel: match.id,
      outcome: "success",
    });
    return HttpResponse.json({ status: "confirmed" });
  }),

  http.post(apiPath("/imports/preview"), async ({ request }) => {
    const auth = authorize(request, "excel:use");
    if ("response" in auth) return auth.response;
    await latency();
    const body = (await request.json()) as { source?: string; fileId?: string };
    if (!body.source || !["1c", "etaxes", "bank"].includes(body.source))
      return apiError(422, "VALIDATION_FAILED", "Unknown source");
    const file = body.fileId ? findFile(body.fileId) : undefined;
    if (!file) return apiError(404, "NOT_FOUND", "File not found");
    const bad = file.name.toLocaleLowerCase("az").includes("səhv");
    const id = `imp-${++counter}`;
    imports.set(id, {
      id,
      source: body.source,
      fileName: file.name,
      rowsOk: bad ? 1 : 3,
      rowsFailed: bad ? 2 : 0,
      status: "previewed",
      approvalId: null,
    });
    recordAudit(auth.user, {
      action: "import.preview",
      resourceType: "import",
      resourceId: id,
      resourceLabel: file.name,
      outcome: "success",
    });
    const invoice = (row: number, number: string, gross: string) => ({
      row,
      ok: true,
      errors: [],
      data: {
        kind: "invoice",
        direction: "purchase",
        number,
        issueDate: "2026-09-15",
        counterpartyName: "Alfa MMC",
        counterpartyVoen: "1234567891",
        net: "100.00",
        vat: "18.00",
        gross,
        currency: "AZN",
        vatPercent: "18",
      },
    });
    return HttpResponse.json(
      {
        importId: id,
        template: body.source === "bank" ? "bank-table-v1" : "onec-table-v1",
        rowsOk: bad ? 1 : 3,
        rowsFailed: bad ? 2 : 0,
        truncated: false,
        errors: bad
          ? [
              { row: 3, errors: ["VÖEN 10 rəqəmdən ibarət olmalıdır"] },
              { row: 4, errors: ["Tarix oxunmadı"] },
            ]
          : [],
        sample: bad
          ? [invoice(2, "UP-1", "118.00")]
          : [invoice(2, "UP-1", "118.00"), invoice(3, "UP-2", "236.00"), invoice(4, "UP-3", "59.00")],
      },
      { status: 201 },
    );
  }),

  http.post(apiPath("/imports/:id/commit"), ({ request, params }) => {
    const auth = authorize(request, "imports:commit");
    if ("response" in auth) return auth.response;
    const imp = imports.get(String(params.id));
    if (!imp) return apiError(404, "NOT_FOUND", "Import not found");
    if (imp.rowsOk === 0) return apiError(409, "CONFLICT", "There is nothing valid to import");
    const reused = imp.approvalId !== null && Boolean(findApproval(imp.approvalId));
    if (!reused) {
      const approvalId = `appr-imp-${imp.id}`;
      imp.approvalId = approvalId;
      imp.status = "approval_required";
      addApprovalRequest({
        id: approvalId,
        kind: "import_commit",
        title: "İdxal icra edilsin",
        summary: imp.fileName,
        riskLevel: "moderate-write",
        status: "pending",
        requestedBy: { id: auth.user.id, name: auth.user.name },
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
        decidedBy: null,
        decidedAt: null,
        comment: null,
        changes: [],
        source: { type: "import", id: imp.id } as never,
      });
      registerEffect(approvalId, {
        approved: () => void (imp.status = "imported"),
        denied: () => {
          imp.status = "previewed";
          imp.approvalId = null;
        },
      });
    }
    recordAudit(auth.user, {
      action: "import.commit_requested",
      resourceType: "import",
      resourceId: imp.id,
      resourceLabel: imp.fileName,
      outcome: "success",
    });
    return HttpResponse.json(
      { importId: imp.id, approvalId: imp.approvalId, status: "approval_required", reused },
      { status: 202 },
    );
  }),

  http.get(apiPath("/imports/:id"), ({ request, params }) => {
    const auth = authorize(request, "excel:use");
    if ("response" in auth) return auth.response;
    const imp = imports.get(String(params.id));
    if (!imp) return apiError(404, "NOT_FOUND", "Import not found");
    return HttpResponse.json({
      id: imp.id,
      source: imp.source,
      template: imp.source === "bank" ? "bank-table-v1" : "onec-table-v1",
      status: imp.status,
      rowsOk: imp.rowsOk,
      rowsFailed: imp.rowsFailed,
      approvalId: imp.approvalId,
      error: null,
    });
  }),

  http.post(apiPath("/journal/export-1c"), async ({ request }) => {
    const auth = authorize(request, "journal:read");
    if ("response" in auth) return auth.response;
    await latency();
    const body = (await request.json()) as { from?: string; to?: string };
    if (!DATE.test(body.from ?? "") || !DATE.test(body.to ?? ""))
      return apiError(422, "VALIDATION_FAILED", "Invalid range");
    const entries = allJournalEntries().filter(
      (entry) => entry.status === "posted" && entry.date >= body.from! && entry.date <= body.to!,
    );
    const file = addUploadedFile({
      name: `1c-export-${body.from}-${body.to}.xml`,
      mimeType: "application/xml",
      sizeBytes: 8_000,
      folder: "/1C",
      tags: ["1c", "ixrac"],
    });
    return HttpResponse.json({ fileId: file.id, entries: entries.length }, { status: 201 });
  }),
];
