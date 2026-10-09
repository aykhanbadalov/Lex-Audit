import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { uploadInvoice } from "@/api/upload";
import { invoiceKeys, useInvoiceList, type Invoice } from "@/features/invoices/api";
import { InvoiceStatusBadge } from "@/features/invoices/components/InvoiceStatusBadge";
import {
  hasActiveInvoiceFilters,
  hasAmounts,
  INVOICE_DIRECTIONS,
  INVOICE_STATUSES,
  invoicesSearchSchema,
  type InvoicesSearch,
} from "@/features/invoices/filters";
import { DataTable } from "@/shared/components/DataTable";
import { MoneyText } from "@/shared/components/MoneyText";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { usePermission } from "@/shared/hooks/usePermission";
import { useSearchText } from "@/shared/hooks/useSearchText";
import { formatDate, formatMonth } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { UploadDropzone } from "@/shared/upload/UploadDropzone";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/invoices/")({
  validateSearch: invoicesSearchSchema,
  component: InvoicesPage,
});

function InvoicesPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="invoices:read">
      <InvoicesPageContent />
    </RequirePermission>
  );
}

function InvoicesPageContent() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const canWrite = usePermission("invoices:write");
  const list = useInvoiceList(search);
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const tag = localeTag(i18n.language);
  const active = hasActiveInvoiceFilters(search);

  const { text, onTextChange } = useSearchText(search.q, (q) => {
    void navigate({ search: (previous) => ({ ...previous, q }), replace: true });
  });
  const update = (patch: Partial<InvoicesSearch>) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const columns = useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      {
        id: "invoice",
        header: t("invoices.columns.invoice"),
        accessorFn: (row) => row.number ?? row.sourceFileName,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to="/invoices/$id"
              params={{ id: row.original.id }}
              state={{ fromInvoicesSearch: search }}
              className="font-medium hover:underline"
            >
              {row.original.number ?? row.original.sourceFileName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {t(`invoices.direction.${row.original.direction}`)}
              {row.original.counterpartyName ? ` · ${row.original.counterpartyName}` : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "issueDate",
        header: t("invoices.columns.date"),
        cell: ({ row }) => (row.original.issueDate ? formatDate(row.original.issueDate, tag) : "—"),
      },
      {
        accessorKey: "grossTotal",
        header: t("invoices.columns.gross"),
        cell: ({ row }) =>
          hasAmounts(row.original.status) ? (
            <MoneyText amount={row.original.grossTotal} currency={row.original.currency} />
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "status",
        header: t("invoices.columns.status"),
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
      },
      {
        id: "issues",
        header: t("invoices.columns.issues"),
        enableSorting: false,
        cell: ({ row }) => {
          const errors = row.original.errorCount;
          const warnings = row.original.issueCount - errors;
          if (errors === 0 && warnings === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="flex flex-wrap gap-1">
              {errors > 0 ? <Badge tone="danger">{t("invoices.issues.errors", { count: errors })}</Badge> : null}
              {warnings > 0 ? <Badge tone="warning">{t("invoices.issues.warnings", { count: warnings })}</Badge> : null}
            </span>
          );
        },
      },
    ],
    [t, tag, search],
  );

  return (
    <>
      <PageHeader title={t("nav.invoices")} description={t("modules.invoices")} />

      {canWrite ? (
        <div className="mb-6">
          <UploadDropzone upload={(file, options) => uploadInvoice(file, options)} queryKey={invoiceKeys.all} />
        </div>
      ) : null}

      {search.vatPeriod ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="info">
            {t("invoices.vatFilter", {
              period: formatMonth(search.vatPeriod, tag),
              bucket: search.vatBucket ? t(`vat.bucket.${search.vatBucket}`) : t("vat.bucket.all"),
            })}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => update({ vatPeriod: undefined, vatBucket: undefined })}
          >
            {t("invoices.vatFilterRemove")}
          </Button>
        </p>
      ) : null}

      <form
        role="search"
        className="mb-6 grid gap-3 sm:grid-cols-[1fr_12rem_12rem_auto] sm:items-end"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1.5">
          <Label htmlFor="inv-q">{t("news.filters.search")}</Label>
          <Input
            id="inv-q"
            type="search"
            value={text}
            placeholder={t("invoices.searchPlaceholder")}
            onChange={(event) => onTextChange(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-status">{t("invoices.columns.status")}</Label>
          <Select
            id="inv-status"
            value={search.status ?? ""}
            onChange={(event) => update({ status: (event.target.value || undefined) as InvoicesSearch["status"] })}
          >
            <option value="">{t("common.all")}</option>
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`invoices.status.${status}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-direction">{t("invoices.fields.direction")}</Label>
          <Select
            id="inv-direction"
            value={search.direction ?? ""}
            onChange={(event) =>
              update({ direction: (event.target.value || undefined) as InvoicesSearch["direction"] })
            }
          >
            <option value="">{t("common.all")}</option>
            {INVOICE_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {t(`invoices.direction.${direction}`)}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={search.hasIssues ?? false}
            onChange={(event) => update({ hasIssues: event.target.checked || undefined })}
          />
          {t("invoices.onlyWithIssues")}
        </label>
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
        emptyTitle={t("invoices.empty")}
        emptyDescription={canWrite ? t("invoices.emptyHintWrite") : t("invoices.emptyHint")}
        onRowClick={(row) =>
          void navigate({ to: "/invoices/$id", params: { id: row.id }, state: { fromInvoicesSearch: search } })
        }
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
