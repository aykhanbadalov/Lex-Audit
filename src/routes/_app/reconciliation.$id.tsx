import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { readRef, readSummary, useConfirmMatch, useReconciliation, type Match } from "@/features/reconciliation/api";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { MoneyText } from "@/shared/components/MoneyText";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/_app/reconciliation/$id")({ component: ReconciliationResult });

function ReconciliationResult() {
  return (
    <RequirePermission permission="excel:use">
      <ResultContent />
    </RequirePermission>
  );
}

function ResultContent() {
  const { t, i18n } = useTranslation();
  const { id } = Route.useParams();
  const recon = useReconciliation(id);
  const confirm = useConfirmMatch(id);
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
  const summary = readSummary(data.summary);
  const side = (match: Match, which: "left" | "right") => {
    const ref = readRef(match[which]);
    return ref ? (
      <span className="block">
        <MoneyText amount={ref.amount} />
        <span className="block text-xs text-muted-foreground">
          {ref.key || ref.ref}
          {ref.date ? ` · ${formatDate(ref.date, tag)}` : ""}
        </span>
      </span>
    ) : (
      "-"
    );
  };

  return (
    <>
      {back}
      <PageHeader title={t("reconciliation.resultTitle")} description={`${data.leftSource} ↔ ${data.rightSource}`} />
      {summary ? (
        <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-4">
          {(
            [
              ["exact", summary.exact],
              ["amountMismatch", summary.amountMismatch],
              ["amountDate", summary.amountDate],
              ["unmatchedLeft", summary.unmatchedLeft],
              ["unmatchedRight", summary.unmatchedRight],
              ["skipped", summary.skipped],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-lg border bg-card p-3">
              <dt className="text-muted-foreground">{t(`reconciliation.summary.${key}`)}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
          <div className="rounded-lg border bg-card p-3">
            <dt className="text-muted-foreground">{t("reconciliation.summary.leftTotal")}</dt>
            <dd className="font-semibold">
              <MoneyText amount={summary.leftTotal} />
            </dd>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <dt className="text-muted-foreground">{t("reconciliation.summary.rightTotal")}</dt>
            <dd className="font-semibold">
              <MoneyText amount={summary.rightTotal} />
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("reconciliation.resultTitle")}</caption>
          <thead className="bg-muted">
            <tr>
              {(["type", "left", "right", "difference", "explanation", "status"] as const).map((column) => (
                <th key={column} scope="col" className="px-3 py-2 text-left font-medium">
                  {t(`reconciliation.columns.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matches.map((match) => (
              <tr key={match.id} className="border-t align-top">
                <td className="px-3 py-2">
                  {t(`reconciliation.matchType.${match.matchType}`, { defaultValue: match.matchType })}
                </td>
                <td className="px-3 py-2">{side(match, "left")}</td>
                <td className="px-3 py-2">{side(match, "right")}</td>
                <td className="px-3 py-2">{match.difference ? <MoneyText amount={match.difference} /> : "-"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{match.explanation}</td>
                <td className="px-3 py-2">
                  {match.status === "confirmed" ? (
                    <Badge tone="success">{t("reconciliation.status.confirmed")}</Badge>
                  ) : readRef(match.left) && readRef(match.right) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(match.id)}
                    >
                      {t("reconciliation.confirm")}
                    </Button>
                  ) : (
                    <Badge tone="warning">{t("reconciliation.status.unmatched")}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
