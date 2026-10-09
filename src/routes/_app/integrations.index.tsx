import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { uploadMultipart } from "@/api/upload";
import {
  IMPORT_SOURCES,
  importKeys,
  useExportToOneC,
  useImports,
  type ImportJob,
  type ImportSource,
} from "@/features/integrations/api";
import { DataTable } from "@/shared/components/DataTable";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { UploadDropzone } from "@/shared/upload/UploadDropzone";
import type { BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/integrations/")({ component: IntegrationsPage });

const TONE: Record<ImportJob["status"], BadgeTone> = {
  analysing: "info",
  needs_mapping: "warning",
  ready: "info",
  importing: "info",
  done: "success",
  failed: "danger",
};

function IntegrationsPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="files:read">
      <IntegrationsContent />
    </RequirePermission>
  );
}

function IntegrationsContent() {
  const { t, i18n } = useTranslation();
  const canWrite = usePermission("imports:commit");
  const list = useImports();
  const [source, setSource] = useState<ImportSource>("onec");
  const tag = localeTag(i18n.language);

  const columns = useMemo<ColumnDef<ImportJob, unknown>[]>(
    () => [
      {
        accessorKey: "fileName",
        header: t("integrations.columns.file"),
        cell: ({ row }) => (
          <Link to="/integrations/$id" params={{ id: row.original.id }} className="font-medium hover:underline">
            {row.original.fileName}
          </Link>
        ),
      },
      {
        accessorKey: "source",
        header: t("integrations.columns.source"),
        cell: ({ row }) => t(`integrations.source.${row.original.source}`),
      },
      {
        accessorKey: "status",
        header: t("integrations.columns.status"),
        cell: ({ row }) => (
          <StatusBadge tone={TONE[row.original.status]} label={t(`integrations.status.${row.original.status}`)} />
        ),
      },
      {
        id: "result",
        header: t("integrations.columns.result"),
        enableSorting: false,
        cell: ({ row }) => (row.original.summary ? t("integrations.resultLine", row.original.summary) : "—"),
      },
      {
        accessorKey: "createdAt",
        header: t("integrations.columns.created"),
        cell: ({ row }) => formatDate(row.original.createdAt, tag),
      },
    ],
    [t, tag],
  );

  return (
    <>
      <PageHeader title={t("nav.integrations")} description={t("modules.integrations")} />
      {canWrite ? (
        <section aria-labelledby="new-import" className="mb-8 space-y-3">
          <h2 id="new-import" className="text-lg font-semibold">
            {t("integrations.newImport")}
          </h2>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="import-source">{t("integrations.columns.source")}</Label>
            <Select
              id="import-source"
              value={source}
              onChange={(event) => setSource(event.target.value as ImportSource)}
            >
              {IMPORT_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {t(`integrations.source.${value}`)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{t(`integrations.sourceHint.${source}`)}</p>
          </div>
          <UploadDropzone
            upload={(file, options) => uploadMultipart("/imports", file, { source }, options)}
            queryKey={importKeys.all}
          />
        </section>
      ) : null}

      <DataTable
        columns={columns}
        data={list.data ?? []}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        emptyTitle={t("integrations.empty")}
        emptyDescription={t("integrations.emptyHint")}
      />
      {canWrite ? <OneCExport /> : null}
    </>
  );
}

function OneCExport() {
  const { t } = useTranslation();
  const exportFile = useExportToOneC();
  const [period, setPeriod] = useState("");
  const valid = /^\d{4}-\d{2}$/.test(period);
  return (
    <section aria-labelledby="export-heading" className="mt-10 max-w-xl space-y-3">
      <h2 id="export-heading" className="text-lg font-semibold">
        {t("integrations.export.title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("integrations.export.hint")}</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) exportFile.mutate(period);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="export-period">{t("reconciliation.columns.period")}</Label>
          <Input id="export-period" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </div>
        <Button type="submit" disabled={!valid || exportFile.isPending}>
          {t("integrations.export.submit")}
        </Button>
      </form>
      {exportFile.data ? (
        <p role="status" className="text-sm">
          {t("integrations.export.ready")}{" "}
          <Link
            to="/files/$id"
            params={{ id: exportFile.data.id }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {exportFile.data.name}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
