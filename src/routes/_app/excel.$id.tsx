import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { readClean, readProfile, useExcelJob, type ExcelJob } from "@/features/excel/api";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { MoneyText } from "@/shared/components/MoneyText";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/_app/excel/$id")({ component: ExcelJobPage });

function ExcelJobPage() {
  return (
    <RequirePermission permission="excel:use">
      <ExcelJobContent />
    </RequirePermission>
  );
}

function ExcelJobContent() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const job = useExcelJob(id);

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/excel">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("excel.back")}
      </Link>
    </Button>
  );

  if (job.isPending)
    return (
      <>
        {back}
        <LoadingState />
      </>
    );
  if (job.isError) {
    return (
      <>
        {back}
        {job.error instanceof ApiError && job.error.code === "NOT_FOUND" ? (
          <EmptyState icon={FileQuestion} title={t("excel.notFound")} description={t("excel.notFoundHint")} />
        ) : (
          <ErrorState message={job.error.message} onRetry={() => void job.refetch()} />
        )}
      </>
    );
  }
  return (
    <>
      {back}
      <JobView job={job.data} />
    </>
  );
}

function JobView({ job }: { job: ExcelJob }) {
  const { t } = useTranslation();
  const working = job.status === "pending" || job.status === "running";
  const profile = job.operation === "profile" && job.status === "done" ? readProfile(job.result) : null;
  const clean = job.operation === "clean" && job.status === "done" ? readClean(job.result) : null;

  return (
    <article className="space-y-6">
      <PageHeader
        title={t(`excel.operation.${job.operation}`)}
        actions={
          <StatusBadge
            tone={job.status === "done" ? "success" : job.status === "failed" ? "danger" : "info"}
            label={t(`excel.status.${job.status}`)}
          />
        }
      />
      {working ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("excel.working")}
        </p>
      ) : null}
      {job.status === "failed" ? (
        <div role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm">
          <p className="font-medium">{t("excel.failedTitle")}</p>
          {job.error ? <p className="text-muted-foreground">{job.error}</p> : null}
        </div>
      ) : null}

      {job.status === "done" && job.outputFileId ? (
        <p className="text-sm">
          {t("excel.resultFile")}{" "}
          <Link to="/files/$id" params={{ id: job.outputFileId }} className="font-medium text-primary hover:underline">
            {t("excel.openFile")}
          </Link>
          . {t("excel.originalUntouched")}
        </p>
      ) : null}

      {clean ? (
        <section aria-labelledby="clean-heading" className="space-y-2">
          <h2 id="clean-heading" className="text-lg font-semibold">
            {t("excel.cleanResult", { before: clean.rowsIn, after: clean.rowsOut })}
          </h2>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {clean.log.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {profile ? (
        <section aria-labelledby="profile-heading" className="space-y-3">
          <h2 id="profile-heading" className="text-lg font-semibold">
            {t("excel.profile.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("excel.profile.summary", {
              rows: profile.rows,
              empty: profile.emptyRows,
              duplicates: profile.duplicateRows,
            })}
            {profile.truncated ? ` ${t("excel.profile.truncated")}` : ""}
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {(["column", "type", "filled", "distinct", "sum", "samples"] as const).map((column) => (
                    <th key={column} scope="col" className="px-3 py-2 text-left font-medium">
                      {t(`excel.profile.col.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profile.columns.map((column) => (
                  <tr key={column.name} className="border-t align-top">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {column.name}
                    </th>
                    <td className="px-3 py-2">
                      {t(`excel.profile.type.${column.type}`)}
                      {column.unparsable > 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          {t("excel.profile.unparsable", { count: column.unparsable })}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{column.nonEmpty}</td>
                    <td className="px-3 py-2 tabular-nums">{column.distinct}</td>
                    <td className="px-3 py-2">{column.sum ? <MoneyText amount={column.sum} /> : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{column.samples.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </article>
  );
}
