import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ApiError } from "@/api/errors";
import {
  ROW_STATUSES,
  useDecideRow,
  useReconciliation,
  useReconciliationRows,
  type ReconciliationRow,
  type RowStatus,
} from "@/features/reconciliation/api";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { MoneyText } from "@/shared/components/MoneyText";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatDate, formatMonth } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import type { Currency } from "@/shared/lib/money";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/reconciliation/$id")({
  validateSearch: z.object({ status: z.enum(ROW_STATUSES).optional().catch(undefined) }),
  component: ReconciliationDetailPage,
});

const TONE: Record<RowStatus, BadgeTone> = {
  confirmed: "success",
  suggested: "warning",
  unmatched: "danger",
  rejected: "neutral",
};

function ReconciliationDetailPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="reconciliation:read">
      <ReconciliationDetailContent />
    </RequirePermission>
  );
}

function ReconciliationDetailContent() {
  const { t, i18n } = useTranslation();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const canWrite = usePermission("reconciliation:write");
  const recon = useReconciliation(id);
  const ready = recon.data?.status === "ready";
  const rows = useReconciliationRows(id, search.status, ready);
  const decide = useDecideRow(id);
  const items = useMemo(() => rows.data?.pages.flatMap((page) => page.items) ?? [], [rows.data]);
  const tag = localeTag(i18n.language);

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/reconciliation">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("reconciliation.back")}
      </Link>
    </Button>
  );
  if (recon.isPending)
    return (
      <>
        {back}
        <LoadingState />
      </>
    );
  if (recon.isError) {
    return (
      <>
        {back}
        {recon.error instanceof ApiError && recon.error.code === "NOT_FOUND" ? (
          <EmptyState
            icon={FileQuestion}
            title={t("reconciliation.notFound")}
            description={t("reconciliation.notFoundHint")}
          />
        ) : (
          <ErrorState message={recon.error.message} onRetry={() => void recon.refetch()} />
        )}
      </>
    );
  }

  const data = recon.data;
  const currency = data.summary.currency as Currency;
  const item = (value: ReconciliationRow["left"]) =>
    value ? (
      <>
        <span className="block">{value.description}</span>
        <span className="block text-xs text-muted-foreground">
          {formatDate(value.date, tag)} · <MoneyText amount={value.amount} currency={currency} />
        </span>
      </>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  return (
    <article className="space-y-6">
      {back}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight break-all">{data.fileName}</h1>
        <p className="text-sm text-muted-foreground">
          {t(`reconciliation.kind.${data.kind}`)} · {formatMonth(data.periodId, tag)}
        </p>
      </header>

      {!ready ? (
        <p role="status" className="text-sm">
          {t("reconciliation.running")}
        </p>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-4">
            {(["confirmed", "suggested", "unmatched"] as const).map((key) => (
              <div key={key} className="rounded-lg border bg-card p-4">
                <dt className="text-sm text-muted-foreground">{t(`reconciliation.status.${key}`)}</dt>
                <dd className="text-2xl font-semibold">{data.summary[key]}</dd>
              </div>
            ))}
            <div className="rounded-lg border bg-card p-4">
              <dt className="text-sm text-muted-foreground">{t("reconciliation.differenceTotal")}</dt>
              <dd className="text-xl font-semibold">
                <MoneyText amount={data.summary.differenceTotal} currency={currency} />
              </dd>
            </div>
          </dl>

          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="rec-filter">{t("reconciliation.filter")}</Label>
            <Select
              id="rec-filter"
              value={search.status ?? ""}
              onChange={(event) =>
                void navigate({
                  search: { status: (event.target.value || undefined) as RowStatus | undefined },
                  replace: true,
                })
              }
            >
              <option value="">{t("common.all")}</option>
              {ROW_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`reconciliation.status.${status}`)}
                </option>
              ))}
            </Select>
          </div>

          {rows.isPending ? (
            <LoadingState />
          ) : rows.isError ? (
            <ErrorState message={rows.error.message} onRetry={() => void rows.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState title={t("table.noResults")} description={t("table.noResultsHint")} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("reconciliation.rows")}</caption>
                <thead className="bg-muted">
                  <tr>
                    {(["left", "right", "difference", "status"] as const).map((key) => (
                      <th key={key} scope="col" className="px-3 py-2 text-left font-medium">
                        {key === "left" || key === "right"
                          ? t(`reconciliation.side.${data.kind}.${key}`)
                          : t(`reconciliation.rowColumns.${key}`)}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2">
                      <span className="sr-only">{t("vat.deposit.columns.action")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t align-top">
                      <td className="px-3 py-2">{item(row.left)}</td>
                      <td className="px-3 py-2">{item(row.right)}</td>
                      <td className="px-3 py-2 text-right">
                        {row.difference && row.difference !== "0.00" ? (
                          <MoneyText amount={row.difference} currency={currency} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap items-center gap-1">
                          <Badge tone={TONE[row.status]}>{t(`reconciliation.status.${row.status}`)}</Badge>
                          {row.confidence !== null ? (
                            <span className="text-xs text-muted-foreground">
                              {t("reconciliation.confidence", { percent: Math.round(row.confidence * 100) })}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {row.status === "suggested" && canWrite ? (
                          <span className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={decide.isPending}
                              onClick={() => decide.mutate({ rowId: row.id, decision: "confirm" })}
                            >
                              {t("reconciliation.confirm")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={decide.isPending}
                              onClick={() => decide.mutate({ rowId: row.id, decision: "reject" })}
                            >
                              {t("reconciliation.reject")}
                            </Button>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.hasNextPage ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void rows.fetchNextPage()} disabled={rows.isFetchingNextPage}>
                {rows.isFetchingNextPage ? t("app.loading") : t("common.loadMore")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
