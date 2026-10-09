import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Scale } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLegislationList, type LegislationSummary } from "@/features/legislation/api";
import {
  LEGISLATION_TYPES,
  legislationListSearchSchema,
  type LegislationListSearch,
} from "@/features/legislation/filters";
import { DataTable } from "@/shared/components/DataTable";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { useSearchText } from "@/shared/hooks/useSearchText";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/legislation/")({
  validateSearch: legislationListSearchSchema,
  component: LegislationPage,
});

function LegislationPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="legislation:read">
      <LegislationPageContent />
    </RequirePermission>
  );
}

function LegislationPageContent() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const list = useLegislationList(search);
  const items = useMemo(() => list.data?.pages.flatMap((page) => page) ?? [], [list.data]);

  const { text, onTextChange } = useSearchText(search.q, (q) => {
    void navigate({ search: (previous) => ({ ...previous, q }), replace: true });
  });

  const tag = localeTag(i18n.language);
  const columns = useMemo<ColumnDef<LegislationSummary, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("legislation.columns.title"),
        cell: ({ row }) => (
          <Link
            to="/legislation/$id"
            params={{ id: row.original.id }}
            state={{ fromLegislationSearch: search }}
            className="font-medium hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      { id: "type", accessorFn: (row) => t(`legislation.type.${row.type}`), header: t("legislation.columns.type") },
      { accessorKey: "officialNumber", header: t("legislation.columns.number") },
      {
        accessorKey: "adoptedAt",
        header: t("legislation.columns.adopted"),
        cell: ({ row }) => (row.original.adoptedAt ? formatDate(row.original.adoptedAt, tag) : "—"),
      },
      {
        accessorKey: "latestVersionNo",
        header: t("legislation.columns.version"),
        cell: ({ row }) => `v${row.original.latestVersionNo}`,
      },
    ],
    [t, tag, search],
  );

  const active = Boolean(search.q?.trim() || search.type);

  return (
    <>
      <PageHeader title={t("nav.legislation")} description={t("modules.legislation")} />

      <form
        role="search"
        className="mb-6 grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1.5">
          <Label htmlFor="leg-q">{t("news.filters.search")}</Label>
          <Input
            id="leg-q"
            type="search"
            value={text}
            placeholder={t("legislation.searchPlaceholder")}
            onChange={(event) => onTextChange(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leg-type">{t("legislation.columns.type")}</Label>
          <Select
            id="leg-type"
            value={search.type ?? ""}
            onChange={(event) => {
              const type = (event.target.value || undefined) as LegislationListSearch["type"];
              void navigate({ search: (previous) => ({ ...previous, type }), replace: true });
            }}
          >
            <option value="">{t("common.all")}</option>
            {LEGISLATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`legislation.type.${type}`)}
              </option>
            ))}
          </Select>
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
        emptyTitle={t("legislation.empty")}
        emptyDescription={t("legislation.emptyHint")}
        onRowClick={(row) =>
          void navigate({ to: "/legislation/$id", params: { id: row.id }, state: { fromLegislationSearch: search } })
        }
      />

      {list.hasNextPage ? (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage ? t("app.loading") : t("common.loadMore")}
          </Button>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        <Scale aria-hidden="true" />
        {t("legislation.count", { count: items.length })}
      </p>
    </>
  );
}
