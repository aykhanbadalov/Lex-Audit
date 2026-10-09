import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import {
  availableColumns,
  mappingsEqual,
  useCommitImport,
  useImport,
  useSaveMapping,
  type ImportDetail,
  type Mapping,
} from "@/features/integrations/api";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { usePermission } from "@/shared/hooks/usePermission";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/integrations/$id")({ component: ImportPage });

function ImportPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="integrations:read">
      <ImportContent />
    </RequirePermission>
  );
}

function ImportContent() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const job = useImport(id);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/integrations">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("integrations.back")}
        </Link>
      </Button>
      {job.isPending ? (
        <LoadingState />
      ) : job.isError ? (
        job.error instanceof ApiError && job.error.code === "NOT_FOUND" ? (
          <EmptyState
            icon={FileQuestion}
            title={t("integrations.notFound")}
            description={t("integrations.notFoundHint")}
          />
        ) : (
          <ErrorState message={job.error.message} onRetry={() => void job.refetch()} />
        )
      ) : (
        // Keyed by the saved mapping, so a fresh server answer resets the local choice instead of fighting it.
        <ImportView key={JSON.stringify(job.data.mapping)} detail={job.data} />
      )}
    </>
  );
}

function ImportView({ detail }: { detail: ImportDetail }) {
  const { t } = useTranslation();
  const canWrite = usePermission("integrations:write");
  const save = useSaveMapping(detail.id);
  const commit = useCommitImport(detail.id);
  const [mapping, setMapping] = useState<Mapping>(detail.mapping);
  const [confirming, setConfirming] = useState(false);

  const editable = detail.status === "needs_mapping" || detail.status === "ready";
  const dirty = !mappingsEqual(mapping, detail.mapping);
  const problems = detail.errors.filter((error) => error.row === 0);
  const rowErrors = detail.errors.filter((error) => error.row > 0);
  const hasError = (row: number, field: string) =>
    rowErrors.some((error) => error.row === row && error.field === field);
  const mappedFields = detail.targetFields.filter((field) => detail.mapping[field.key]);

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <StatusBadge
          tone={
            detail.status === "done"
              ? "success"
              : detail.status === "failed"
                ? "danger"
                : detail.status === "needs_mapping"
                  ? "warning"
                  : "info"
          }
          label={t(`integrations.status.${detail.status}`)}
        />
        <h1 className="text-2xl font-semibold tracking-tight break-all">{detail.fileName}</h1>
        <p className="text-sm text-muted-foreground">{t(`integrations.source.${detail.source}`)}</p>
      </header>

      {detail.status === "analysing" ? (
        <p role="status" className="text-sm">
          {t("integrations.analysing")}
        </p>
      ) : null}
      {detail.status === "importing" ? (
        <p role="status" className="text-sm">
          {t("integrations.importing")}
        </p>
      ) : null}
      {detail.status === "done" && detail.summary ? (
        <dl className="grid gap-3 sm:grid-cols-4">
          {(["rowsTotal", "rowsOk", "rowsFailed", "duplicates"] as const).map((key) => (
            <div key={key} className="rounded-lg border bg-card p-4">
              <dt className="text-sm text-muted-foreground">{t(`integrations.summary.${key}`)}</dt>
              <dd className="text-2xl font-semibold">{detail.summary![key]}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {detail.columns.length > 0 ? (
        <section aria-labelledby="mapping-heading" className="space-y-3">
          <h2 id="mapping-heading" className="text-lg font-semibold">
            {t("integrations.mapping.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("integrations.mapping.hint")}</p>
          <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
            {detail.targetFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`map-${field.key}`}>
                  {t(`integrations.field.${field.key}`)}
                  {field.required ? (
                    <Badge tone="outline" className="ml-2 font-normal">
                      {t("integrations.mapping.required")}
                    </Badge>
                  ) : null}
                </Label>
                <Select
                  id={`map-${field.key}`}
                  disabled={!editable || !canWrite}
                  value={mapping[field.key] ?? ""}
                  onChange={(event) =>
                    setMapping((current) => ({ ...current, [field.key]: event.target.value || null }))
                  }
                >
                  <option value="">{t("integrations.mapping.none")}</option>
                  {availableColumns(
                    detail.columns.map((column) => column.name),
                    mapping,
                    field.key,
                  ).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          {editable && canWrite ? (
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(mapping)}
            >
              {t("integrations.mapping.save")}
            </Button>
          ) : null}
        </section>
      ) : null}

      {problems.length > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <ul>
            {problems.map((error) => (
              <li key={error.field}>
                {t("integrations.error.REQUIRED_UNMAPPED", { field: t(`integrations.field.${error.field}`) })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.preview.length > 0 ? (
        <section aria-labelledby="preview-heading" className="space-y-3">
          <h2 id="preview-heading" className="text-lg font-semibold">
            {t("integrations.preview.title")}
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("integrations.preview.title")}</caption>
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    {t("integrations.preview.row")}
                  </th>
                  {mappedFields.map((field) => (
                    <th key={field.key} scope="col" className="px-3 py-2 text-left font-medium">
                      {t(`integrations.field.${field.key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.preview.map((row) => (
                  <tr key={row.row} className="border-t">
                    <td className="px-3 py-2">{row.row}</td>
                    {mappedFields.map((field) => {
                      const bad = hasError(row.row, field.key);
                      return (
                        <td key={field.key} className={bad ? "px-3 py-2 font-medium text-destructive" : "px-3 py-2"}>
                          {row.values[field.key] || "—"}
                          {bad ? <span className="sr-only"> ({t("integrations.preview.invalid")})</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rowErrors.length > 0 ? (
            <ul className="text-sm">
              {rowErrors.map((error) => (
                <li key={`${error.row}-${error.field}`}>
                  {t("integrations.preview.rowError", {
                    row: error.row,
                    field: t(`integrations.field.${error.field}`),
                    message: t(`integrations.error.${error.code}`),
                  })}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {editable && canWrite ? (
        <div className="space-y-2">
          <Button
            type="button"
            disabled={dirty || !detail.canCommit || commit.isPending}
            onClick={() => setConfirming(true)}
          >
            {t("integrations.commit.button")}
          </Button>
          {dirty ? (
            <p className="text-xs text-muted-foreground">{t("integrations.commit.saveFirst")}</p>
          ) : !detail.canCommit ? (
            <p className="text-xs text-muted-foreground">{t("integrations.commit.cannot")}</p>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("integrations.commit.confirmTitle")}
        description={t("integrations.commit.confirmDescription", { count: detail.rowCount })}
        confirmLabel={t("integrations.commit.button")}
        busy={commit.isPending}
        onConfirm={() => commit.mutate(undefined, { onSettled: () => setConfirming(false) })}
      />
    </article>
  );
}
