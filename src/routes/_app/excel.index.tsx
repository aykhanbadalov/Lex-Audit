import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { uploadMultipart } from "@/api/upload";
import { excelKeys, useWorkbooks, type Workbook } from "@/features/excel/api";
import { DataTable } from "@/shared/components/DataTable";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { UploadDropzone } from "@/shared/upload/UploadDropzone";
import type { BadgeTone } from "@/shared/ui/badge";

export const Route = createFileRoute("/_app/excel/")({ component: ExcelPage });

const TONE: Record<Workbook["status"], BadgeTone> = {
  uploaded: "neutral",
  profiling: "info",
  ready: "success",
  failed: "danger",
};

function ExcelPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="excel:read">
      <ExcelPageContent />
    </RequirePermission>
  );
}

function ExcelPageContent() {
  const { t, i18n } = useTranslation();
  const canWrite = usePermission("excel:write");
  const list = useWorkbooks();
  const tag = localeTag(i18n.language);

  const columns = useMemo<ColumnDef<Workbook, unknown>[]>(
    () => [
      {
        accessorKey: "fileName",
        header: t("excel.columns.file"),
        cell: ({ row }) => (
          <Link to="/excel/$id" params={{ id: row.original.id }} className="font-medium hover:underline">
            {row.original.fileName}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: t("excel.columns.status"),
        cell: ({ row }) => (
          <StatusBadge tone={TONE[row.original.status]} label={t(`excel.status.${row.original.status}`)} />
        ),
      },
      {
        accessorKey: "rowCount",
        header: t("excel.columns.rows"),
        cell: ({ row }) => (row.original.status === "ready" ? row.original.rowCount : "—"),
      },
      {
        accessorKey: "createdAt",
        header: t("excel.columns.created"),
        cell: ({ row }) => formatDate(row.original.createdAt, tag),
      },
    ],
    [t, tag],
  );

  return (
    <>
      <PageHeader title={t("nav.excel")} description={t("modules.excel")} />
      {canWrite ? (
        <div className="mb-6">
          <UploadDropzone
            upload={(file, options) => uploadMultipart("/excel/workbooks", file, {}, options)}
            queryKey={excelKeys.all}
          />
        </div>
      ) : null}
      <DataTable
        columns={columns}
        data={list.data ?? []}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        emptyTitle={t("excel.empty")}
        emptyDescription={canWrite ? t("excel.emptyHintWrite") : t("excel.emptyHint")}
      />
    </>
  );
}
