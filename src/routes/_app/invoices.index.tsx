import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { uploadInvoice } from "@/api/upload";
import { invoiceKeys, markInvoiceUploaded, useInvoiceList, type Invoice } from "@/features/invoices/api";
import { InvoiceStatusBadge } from "@/features/invoices/components/InvoiceStatusBadge";
import {
  hasActiveInvoiceFilters,
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
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { UploadDropzone } from "@/shared/upload/UploadDropzone";
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

  const update = (patch: Partial<InvoicesSearch>) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const columns = useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      {
        id: "invoice",
        header: t("invoices.columns.invoice"),
        accessorFn: (row) => row.number,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to="/invoices/$id"
              params={{ id: row.original.id }}
              state={{ fromInvoicesSearch: search }}
              className="font-medium hover:underline"
            >
              {row.original.number || t("invoices.noNumber")}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {t(`invoices.direction.${row.original.direction}`)}
              {row.original.counterparty?.name ? ` · ${row.original.counterparty.name}` : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "issueDate",
        header: t("invoices.columns.date"),
        cell: ({ row }) => (row.original.issueDate ? formatDate(row.original.issueDate, tag) : "-"),
      },
      {
        accessorKey: "gross",
        header: t("invoices.columns.gross"),
        cell: ({ row }) => <MoneyText amount={row.original.gross} currency={row.original.currency} />,
      },
      {
        accessorKey: "status",
        header: t("invoices.columns.status"),
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
      },
    ],
    [t, tag, search],
  );

  return (
    <>
      <PageHeader title={t("nav.invoices")} description={t("modules.invoices")} />

      {canWrite ? (
        <div className="mb-6">
          <UploadDropzone
            upload={async (file, options) => {
              const result = await uploadInvoice(file, options);
              markInvoiceUploaded();
              return result;
            }}
            queryKey={invoiceKeys.all}
          />
        </div>
      ) : null}

      <form
        role="search"
        className="mb-6 grid gap-3 sm:grid-cols-[12rem_12rem_10rem_10rem_auto] sm:items-end"
        onSubmit={(event) => event.preventDefault()}
      >
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
        <div className="space-y-1.5">
          <Label htmlFor="inv-from">{t("news.filters.from")}</Label>
          <Input
            id="inv-from"
            type="date"
            value={search.from ?? ""}
            max={search.to}
            onChange={(event) => update({ from: event.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-to">{t("news.filters.to")}</Label>
          <Input
            id="inv-to"
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
