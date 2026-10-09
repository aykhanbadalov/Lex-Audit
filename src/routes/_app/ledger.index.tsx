import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useJournalList, type JournalEntrySummary } from "@/features/ledger/api";
import { JournalStatusBadge } from "@/features/ledger/components/JournalEntryCard";
import { LedgerNav } from "@/features/ledger/components/LedgerNav";
import {
  hasActiveJournalFilters,
  JOURNAL_STATUSES,
  journalSearchSchema,
  type JournalSearch,
} from "@/features/ledger/filters";
import { DataTable } from "@/shared/components/DataTable";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/ledger/")({
  validateSearch: journalSearchSchema,
  component: LedgerPage,
});

function LedgerPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="journal:read">
      <LedgerPageContent />
    </RequirePermission>
  );
}

function LedgerPageContent() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const list = useJournalList(search);
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const tag = localeTag(i18n.language);
  const active = hasActiveJournalFilters(search);

  const update = (patch: Partial<JournalSearch>) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const columns = useMemo<ColumnDef<JournalEntrySummary, unknown>[]>(
    () => [
      { accessorKey: "date", header: t("ledger.columns.date"), cell: ({ row }) => formatDate(row.original.date, tag) },
      {
        accessorKey: "description",
        header: t("ledger.columns.description"),
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-2">
            <Link to="/ledger/$id" params={{ id: row.original.id }} className="font-medium hover:underline">
              {row.original.description}
            </Link>
            <Badge tone="outline">{t(`ledger.source.${row.original.source}`)}</Badge>
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("ledger.columns.status"),
        cell: ({ row }) => <JournalStatusBadge entry={row.original} />,
      },
    ],
    [t, tag],
  );

  return (
    <>
      <PageHeader title={t("nav.ledger")} description={t("modules.ledger")} />
      <LedgerNav />
      <form
        role="search"
        className="mb-6 grid gap-3 sm:grid-cols-[12rem_10rem_10rem_auto] sm:items-end"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1.5">
          <Label htmlFor="je-status">{t("ledger.columns.status")}</Label>
          <Select
            id="je-status"
            value={search.status ?? ""}
            onChange={(event) => update({ status: (event.target.value || undefined) as JournalSearch["status"] })}
          >
            <option value="">{t("common.all")}</option>
            {JOURNAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`invoices.journal.status.${status}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="je-from">{t("news.filters.from")}</Label>
          <Input
            id="je-from"
            type="date"
            value={search.from ?? ""}
            max={search.to}
            onChange={(event) => update({ from: event.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="je-to">{t("news.filters.to")}</Label>
          <Input
            id="je-to"
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
        emptyTitle={t("ledger.empty")}
        emptyDescription={t("ledger.emptyHint")}
        onRowClick={(row) => void navigate({ to: "/ledger/$id", params: { id: row.id } })}
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
