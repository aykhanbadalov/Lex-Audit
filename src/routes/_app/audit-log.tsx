import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { auditCsv, filterAuditEvents, useAuditEvents, type AuditEvent } from "@/features/audit/api";
import { auditActionKey, auditSearchSchema, hasActiveAuditFilters, type AuditSearch } from "@/features/audit/filters";
import { usePeople } from "@/shared/api/people";
import { DataTable } from "@/shared/components/DataTable";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { useSearchText } from "@/shared/hooks/useSearchText";
import { formatDateTime } from "@/shared/lib/date";
import { saveBlob } from "@/shared/lib/download";
import { localeTag } from "@/shared/lib/locale";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export const Route = createFileRoute("/_app/audit-log")({
  validateSearch: auditSearchSchema,
  component: AuditPage,
});

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
  const list = useAuditEvents();
  const person = usePeople();
  const tag = localeTag(i18n.language);
  const active = hasActiveAuditFilters(search);
  const actionText = (action: string) => t(`audit.action.${auditActionKey(action)}`, { defaultValue: action });

  const items = useMemo(
    () =>
      filterAuditEvents(
        list.data ?? [],
        search,
        (event) =>
          `${person(event.actorId)} ${actionText(event.action)} ${event.action} ${event.resourceType} ${event.resourceId}`,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the helpers depend on the language and the people list
    [list.data, search, i18n.language, person],
  );

  const { text, onTextChange } = useSearchText(
    search.q,
    (q) => void navigate({ search: (previous) => ({ ...previous, q }), replace: true }),
  );
  const update = (patch: Partial<AuditSearch>) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const columns = useMemo<ColumnDef<AuditEvent, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("audit.columns.at"),
        cell: ({ row }) => <time dateTime={row.original.createdAt}>{formatDateTime(row.original.createdAt, tag)}</time>,
      },
      { id: "actor", header: t("audit.columns.actor"), cell: ({ row }) => person(row.original.actorId) },
      {
        id: "action",
        header: t("audit.columns.action"),
        cell: ({ row }) => (
          <span className="block">
            {actionText(row.original.action)}
            <span className="block font-mono text-xs text-muted-foreground">{row.original.requestId}</span>
          </span>
        ),
      },
      {
        id: "resource",
        header: t("audit.columns.resource"),
        cell: ({ row }) => (
          <span className="block">
            {row.original.resourceType}
            <span className="block font-mono text-xs break-all text-muted-foreground">{row.original.resourceId}</span>
          </span>
        ),
      },
      {
        id: "change",
        header: t("audit.columns.change"),
        enableSorting: false,
        cell: ({ row }) => <Change event={row.original} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- actionText only depends on t
    [t, tag, person],
  );

  function exportCsv() {
    saveBlob(new Blob([auditCsv(items, person)], { type: "text/csv;charset=utf-8" }), "audit-jurnali.csv");
  }

  return (
    <>
      <PageHeader
        title={t("nav.audit")}
        description={t("modules.audit")}
        actions={
          <Button variant="outline" disabled={items.length === 0} onClick={exportCsv}>
            <Download className="size-4" aria-hidden="true" />
            {t("audit.export")}
          </Button>
        }
      />
      <p className="mb-4 text-xs text-muted-foreground">{t("audit.limitNote", { count: list.data?.length ?? 0 })}</p>
      <form
        role="search"
        className="mb-6 grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end"
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
    </>
  );
}

/** What the event changed, as plain text. The backend masks personal data before it stores it. */
function Change({ event }: { event: AuditEvent }) {
  const { t } = useTranslation();
  if (event.before == null && event.after == null) return <span className="text-muted-foreground">—</span>;
  const show = (value: unknown) => JSON.stringify(value, null, 2);
  return (
    <details>
      <summary className="cursor-pointer text-sm text-primary">{t("audit.showChange")}</summary>
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
        {event.before != null ? (
          <div>
            <p className="font-medium">{t("audit.before")}</p>
            <pre className="max-h-40 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{show(event.before)}</pre>
          </div>
        ) : null}
        {event.after != null ? (
          <div>
            <p className="font-medium">{t("audit.after")}</p>
            <pre className="max-h-40 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{show(event.after)}</pre>
          </div>
        ) : null}
      </div>
    </details>
  );
}
