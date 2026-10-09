import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import {
  EXCEL_OPERATIONS,
  operationProblem,
  useCreateExcelJob,
  useWorkbook,
  type ColumnProfile,
  type ExcelJob,
  type ExcelOperation,
  type WorkbookDetail,
} from "@/features/excel/api";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { usePermission } from "@/shared/hooks/usePermission";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/excel/$id")({ component: WorkbookPage });

const LOW_CONFIDENCE = 0.85;
const JOB_TONE: Record<ExcelJob["status"], BadgeTone> = {
  queued: "neutral",
  running: "info",
  done: "success",
  failed: "danger",
};

function WorkbookPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="excel:use">
      <WorkbookContent />
    </RequirePermission>
  );
}

function WorkbookContent() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const workbook = useWorkbook(id);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/excel">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("excel.back")}
        </Link>
      </Button>
      {workbook.isPending ? (
        <LoadingState />
      ) : workbook.isError ? (
        workbook.error instanceof ApiError && workbook.error.code === "NOT_FOUND" ? (
          <EmptyState icon={FileQuestion} title={t("excel.notFound")} description={t("excel.notFoundHint")} />
        ) : (
          <ErrorState message={workbook.error.message} onRetry={() => void workbook.refetch()} />
        )
      ) : (
        <WorkbookView workbook={workbook.data} />
      )}
    </>
  );
}

function WorkbookView({ workbook }: { workbook: WorkbookDetail }) {
  const { t } = useTranslation();
  const canWrite = usePermission("excel:use");
  const ready = workbook.status === "ready";
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <StatusBadge
          tone={ready ? "success" : workbook.status === "failed" ? "danger" : "info"}
          label={t(`excel.status.${workbook.status}`)}
        />
        <h1 className="text-2xl font-semibold tracking-tight break-all">{workbook.fileName}</h1>
        <p className="text-sm text-muted-foreground">{t("excel.originalSafe")}</p>
      </header>

      {!ready ? (
        workbook.status === "failed" ? (
          <div role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm">
            {workbook.statusDetail ?? t("excel.failedTitle")}
          </div>
        ) : (
          <p role="status" className="text-sm">
            {t("excel.profiling")}
          </p>
        )
      ) : (
        <>
          {workbook.sheets.map((sheet) => (
            <section key={sheet.name} aria-labelledby={`sheet-${sheet.name}`} className="space-y-3">
              <h2 id={`sheet-${sheet.name}`} className="text-lg font-semibold">
                {t("excel.sheet", { name: sheet.name, rows: sheet.rowCount })}
              </h2>
              <ProfileTable columns={sheet.columns} />
            </section>
          ))}
          {canWrite ? <OperationForm workbook={workbook} /> : null}
        </>
      )}

      <section aria-labelledby="jobs-heading" className="space-y-3">
        <h2 id="jobs-heading" className="text-lg font-semibold">
          {t("excel.jobs")}
        </h2>
        {workbook.jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("excel.noJobs")}</p>
        ) : (
          <ul className="space-y-3">
            {workbook.jobs.map((job) => (
              <JobCard key={job.id} job={job} columns={workbook.sheets.flatMap((sheet) => sheet.columns)} />
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function ProfileTable({ columns }: { columns: ColumnProfile[] }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">{t("excel.profile")}</caption>
        <thead className="bg-muted">
          <tr>
            {(["column", "type", "meaning", "filled", "empty", "duplicates", "samples"] as const).map((key) => (
              <th key={key} scope="col" className="px-3 py-2 text-left font-medium">
                {t(`excel.profileColumns.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.letter} className="border-t align-top">
              <td className="px-3 py-2">
                <span className="font-mono text-xs">{column.letter}</span> {column.name}
              </td>
              <td className="px-3 py-2">{t(`excel.type.${column.detectedType}`)}</td>
              <td className="px-3 py-2">
                {column.meaning ? (
                  <span className="flex flex-wrap items-center gap-1">
                    {column.meaning.label}
                    {column.meaning.confidence < LOW_CONFIDENCE ? (
                      <Badge tone="warning">
                        {t("excel.checkMeaning", { percent: Math.round(column.meaning.confidence * 100) })}
                      </Badge>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2 tabular-nums">{column.filled}</td>
              <td className="px-3 py-2 tabular-nums">{column.empty}</td>
              <td className="px-3 py-2 tabular-nums">{column.duplicates}</td>
              {/* Plain text on purpose: cell values come from a file the user uploaded. */}
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {column.samples.map((sample) => `«${sample}»`).join(" ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OperationForm({ workbook }: { workbook: WorkbookDetail }) {
  const { t } = useTranslation();
  const create = useCreateExcelJob(workbook.id);
  const sheet = workbook.sheets[0];
  const [operation, setOperation] = useState<ExcelOperation>("trim_spaces");
  const [picked, setPicked] = useState<string[]>([]);
  if (!sheet) return null;

  const columns = operation === "trim_spaces" ? [] : picked;
  const problem = operationProblem(operation, columns);
  const toggle = (letter: string) =>
    setPicked((current) =>
      operation === "normalize_dates"
        ? [letter]
        : current.includes(letter)
          ? current.filter((value) => value !== letter)
          : [...current, letter],
    );

  return (
    <section aria-labelledby="op-heading" className="space-y-3">
      <h2 id="op-heading" className="text-lg font-semibold">
        {t("excel.run.title")}
      </h2>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!problem) create.mutate({ operation, sheet: sheet.name, columns }, { onSuccess: () => setPicked([]) });
        }}
      >
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="operation">{t("excel.run.operation")}</Label>
          <Select
            id="operation"
            value={operation}
            onChange={(event) => {
              setOperation(event.target.value as ExcelOperation);
              setPicked([]);
            }}
          >
            {EXCEL_OPERATIONS.map((value) => (
              <option key={value} value={value}>
                {t(`excel.operation.${value}`)}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{t(`excel.operationHint.${operation}`)}</p>
        </div>

        {operation !== "trim_spaces" ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {operation === "remove_duplicates" ? t("excel.run.keyColumns") : t("excel.run.dateColumn")}
            </legend>
            <div className="flex flex-wrap gap-3">
              {sheet.columns.map((column) => (
                <label key={column.letter} className="flex items-center gap-2 text-sm">
                  <input
                    type={operation === "normalize_dates" ? "radio" : "checkbox"}
                    name="columns"
                    className="size-4"
                    checked={picked.includes(column.letter)}
                    onChange={() => toggle(column.letter)}
                  />
                  {column.letter} · {column.name}
                </label>
              ))}
            </div>
            {problem ? <p className="text-xs text-muted-foreground">{t(`excel.run.${problem}`)}</p> : null}
          </fieldset>
        ) : null}

        <Button type="submit" disabled={Boolean(problem) || create.isPending}>
          {t("excel.run.submit")}
        </Button>
      </form>
    </section>
  );
}

function JobCard({ job, columns }: { job: ExcelJob; columns: ColumnProfile[] }) {
  const { t } = useTranslation();
  const names = job.columns.map((letter) => columns.find((column) => column.letter === letter)?.name ?? letter);
  return (
    <li className="space-y-3 rounded-lg border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={JOB_TONE[job.status]} label={t(`excel.job.status.${job.status}`)} />
        <span className="font-medium">{t(`excel.operation.${job.operation}`)}</span>
        {names.length > 0 ? <span className="text-muted-foreground">· {names.join(", ")}</span> : null}
      </div>
      {job.status === "done" ? (
        <>
          <p>{t("excel.job.result", { read: job.rowsRead, changed: job.rowsChanged, removed: job.rowsRemoved })}</p>
          {job.changes.length > 0 ? (
            <table className="w-full max-w-2xl text-xs">
              <caption className="sr-only">{t("excel.job.changes")}</caption>
              <thead>
                <tr className="text-left">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("excel.job.row")}
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("excel.job.column")}
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("excel.job.before")}
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    {t("excel.job.after")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {job.changes.map((change) => (
                  <tr key={`${change.row}-${change.column}`} className="border-t">
                    <td className="py-1 pr-3">{change.row}</td>
                    <td className="py-1 pr-3">{change.column}</td>
                    <td className="py-1 pr-3">
                      <del>«{change.before}»</del>
                    </td>
                    <td className="py-1">
                      <ins className="no-underline">«{change.after}»</ins>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {job.outputFileId ? (
            <p>
              {t("excel.job.output")}{" "}
              <Link
                to="/files/$id"
                params={{ id: job.outputFileId }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {job.outputFileName}
              </Link>
            </p>
          ) : null}
        </>
      ) : null}
      {job.status === "failed" ? (
        <p role="alert" className="text-destructive">
          {job.statusDetail}
        </p>
      ) : null}
    </li>
  );
}
