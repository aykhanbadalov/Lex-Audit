import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuditEvents, useExportAudit, type AuditEvent } from "@/features/audit/api";
import {
  AUDIT_OUTCOMES,
  auditActionKey,
  auditSearchSchema,
  hasActiveAuditFilters,
  type AuditSearch,
} from "@/features/audit/filters";
import { DataTable } from "@/shared/components/DataTable";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { useSearchText } from "@/shared/hooks/useSearchText";
import { formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/audit-log")({
  validateSearch: auditSearchSchema,
  component: AuditPage,
});

const OUTCOME_TONE: Record<AuditEvent["outcome"], BadgeTone> = {
  success: "success",
  denied: "warning",
  failed: "danger",
};

function AuditPage() {
  return (
    <RequirePermission permission="audit:read">
      <AuditContent />
    </RequirePermission>
  );
}

function AuditContent() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const list = useAuditEvents(search);
  const exportAudit = useExportAudit();
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const tag = localeTag(i18n.language);
  const active = hasActiveAuditFilters(search);

  const { text, onTextChange } = useSearchText(
    search.q,
    (q) => void navigate({ search: (previous) => ({ ...previous, q }), replace: true }),
  );
  const update = (patch: Partial<AuditSearch>) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const columns = useMemo<ColumnDef<AuditEvent, unknown>[]>(
    () => [
      {
        accessorKey: "at",
        header: t("audit.columns.at"),
        cell: ({ row }) => <time dateTime={row.original.at}>{formatDateTime(row.original.at, tag)}</time>,
      },
      { id: "actor", header: t("audit.columns.actor"), cell: ({ row }) => row.original.actor.name },
      {
        id: "action",
        header: t("audit.columns.action"),
        cell: ({ row }) => (
          <span className="block">
            {t(`audit.action.${auditActionKey(row.original.action)}`, { defaultValue: row.original.action })}
            <span className="block font-mono text-xs text-muted-foreground">{row.original.requestId}</span>
          </span>
        ),
      },
      {
        id: "resource",
        header: t("audit.columns.resource"),
        cell: ({ row }) => row.original.resourceLabel,
      },
      {
        id: "outcome",
        header: t("audit.columns.outcome"),
        cell: ({ row }) => (
          <Badge tone={OUTCOME_TONE[row.original.outcome]}>{t(`audit.outcome.${row.original.outcome}`)}</Badge>
        ),
      },
    ],
    [t, tag],
  );

  return (
    <>
      <PageHeader
        title={t("nav.audit")}
        description={t("modules.audit")}
        actions={
          <Button variant="outline" disabled={exportAudit.isPending} onClick={() => exportAudit.mutate(search)}>
            <Download className="size-4" aria-hidden="true" />
            {t("audit.export")}
          </Button>
        }
      />
      {exportAudit.data ? (
        <p role="status" className="mb-4 text-sm">
          {t("audit.exported")}{" "}
          <Link
            to="/files/$id"
            params={{ id: exportAudit.data.id }}
            className="font-medium text-primary hover:underline"
          >
            {exportAudit.data.name}
          </Link>
        </p>
      ) : null}
      <form
        role="search"
        className="mb-6 grid gap-3 sm:grid-cols-[1fr_10rem_10rem_10rem_auto] sm:items-end"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1.5">
          <Label htmlFor="au-q">{t("news.filters.search")}</Label>
          <Input
            id="au-q"
            type="search"
            value={text}
            placeholder={t("audit.searchPlaceholder")}
            onChange={(event) => onTextChange(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="au-outcome">{t("audit.columns.outcome")}</Label>
          <Select
            id="au-outcome"
            value={search.outcome ?? ""}
            onChange={(event) => update({ outcome: (event.target.value || undefined) as AuditSearch["outcome"] })}
          >
            <option value="">{t("common.all")}</option>
            {AUDIT_OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>
                {t(`audit.outcome.${outcome}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="au-from">{t("news.filters.from")}</Label>
          <Input
            id="au-from"
            type="date"
            value={search.from ?? ""}
            max={search.to}
            onChange={(event) => update({ from: event.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="au-to">{t("news.filters.to")}</Label>
          <Input
            id="au-to"
            type="date"
            value={search.to ?? ""}
            min={search.from}
            onChange={(event) => update({ to: event.target.value || undefined })}
          />
        </div>
        {active ? (
          <Button type="button" variant="ghost" onClick={() => void navigate({ search: {}, replace: true })}>
            {t("news.filters.reset")}
          </Button>
        ) : null}
      </form>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        isFiltered={active}
        emptyTitle={t("audit.empty")}
        emptyDescription={t("audit.emptyHint")}
      />
      {list.hasNextPage ? (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage ? t("app.loading") : t("common.loadMore")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
