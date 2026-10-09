import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KINDS,
  useCreateReconciliation,
  useReadyStatementFiles,
  useReconciliations,
  type Kind,
  type Reconciliation,
} from "@/features/reconciliation/api";
import { DataTable } from "@/shared/components/DataTable";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatMonth } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/reconciliation/")({ component: ReconciliationPage });

function ReconciliationPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="reconciliation:read">
      <ReconciliationContent />
    </RequirePermission>
  );
}

function ReconciliationContent() {
  const { t, i18n } = useTranslation();
  const canWrite = usePermission("reconciliation:write");
  const list = useReconciliations();
  const tag = localeTag(i18n.language);

  const columns = useMemo<ColumnDef<Reconciliation, unknown>[]>(
    () => [
      {
        accessorKey: "fileName",
        header: t("reconciliation.columns.file"),
        cell: ({ row }) => (
          <Link to="/reconciliation/$id" params={{ id: row.original.id }} className="font-medium hover:underline">
            {row.original.fileName}
          </Link>
        ),
      },
      {
        accessorKey: "kind",
        header: t("reconciliation.columns.kind"),
        cell: ({ row }) => t(`reconciliation.kind.${row.original.kind}`),
      },
      {
        accessorKey: "periodId",
        header: t("reconciliation.columns.period"),
        cell: ({ row }) => formatMonth(row.original.periodId, tag),
      },
      {
        accessorKey: "status",
        header: t("reconciliation.columns.status"),
        cell: ({ row }) => (
          <StatusBadge
            tone={row.original.status === "ready" ? "success" : row.original.status === "failed" ? "danger" : "info"}
            label={t(`reconciliation.status.${row.original.status}`)}
          />
        ),
      },
      {
        id: "summary",
        header: t("reconciliation.columns.summary"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === "ready" ? t("reconciliation.summaryLine", row.original.summary) : "—",
      },
    ],
    [t, tag],
  );

  return (
    <>
      <PageHeader title={t("nav.reconciliation")} description={t("modules.reconciliation")} />
      {canWrite ? <NewReconciliation /> : null}
      <DataTable
        columns={columns}
        data={list.data ?? []}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        emptyTitle={t("reconciliation.empty")}
        emptyDescription={t("reconciliation.emptyHint")}
      />
    </>
  );
}

function NewReconciliation() {
  const { t } = useTranslation();
  const files = useReadyStatementFiles();
  const create = useCreateReconciliation();
  const [kind, setKind] = useState<Kind>("bank_ledger");
  const [fileId, setFileId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const valid = Boolean(fileId) && /^\d{4}-\d{2}$/.test(periodId);

  return (
    <form
      className="mb-6 grid gap-3 rounded-lg border p-4 sm:grid-cols-[14rem_1fr_10rem_auto] sm:items-end"
      aria-label={t("reconciliation.new")}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) create.mutate({ kind, fileId, periodId }, { onSuccess: () => setFileId("") });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="rec-kind">{t("reconciliation.columns.kind")}</Label>
        <Select id="rec-kind" value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
          {KINDS.map((value) => (
            <option key={value} value={value}>
              {t(`reconciliation.kind.${value}`)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rec-file">{t("reconciliation.file")}</Label>
        <Select id="rec-file" value={fileId} onChange={(event) => setFileId(event.target.value)}>
          <option value="">{t("reconciliation.chooseFile")}</option>
          {files.data?.map((file) => (
            <option key={file.id} value={file.id}>
              {file.name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">{t("reconciliation.fileHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rec-period">{t("reconciliation.columns.period")}</Label>
        <Input id="rec-period" type="month" value={periodId} onChange={(event) => setPeriodId(event.target.value)} />
      </div>
      <Button type="submit" disabled={!valid || create.isPending}>
        {t("reconciliation.start")}
      </Button>
    </form>
  );
}
