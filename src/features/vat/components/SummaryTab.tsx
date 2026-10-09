import { Link } from "@tanstack/react-router";
import { Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { MoneyText } from "@/shared/components/MoneyText";
import { Card, CardContent } from "@/shared/ui/card";
import { useVatSummary } from "../api";

export function SummaryTab({ period }: { period: string }) {
  const { t } = useTranslation();
  const summary = useVatSummary(period);
  if (summary.isPending) return <LoadingState rows={4} />;
  if (summary.isError) return <ErrorState message={summary.error.message} onRetry={() => void summary.refetch()} />;

  const data = summary.data;
  const range = { from: data.from, to: data.to };
  // A negative result is a refund: the sign is the backend's, the wording follows it.
  const refundable = data.payable.startsWith("-");
  const resultLabel = refundable ? t("vat.summary.resultRefundable") : t("vat.summary.resultPayable");

  return (
    <div className="space-y-6">
      {!data.complete ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="space-y-2">
            <p>{t("vat.summary.incomplete")}</p>
            {data.blockers.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-5">
                {data.blockers.map((blocker) => (
                  <li key={blocker.invoiceId}>
                    <Link to="/invoices/$id" params={{ id: blocker.invoiceId }} className="font-medium underline">
                      {blocker.number || t("invoices.noNumber")}
                    </Link>
                    : {blocker.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
      {data.excluded.length > 0 ? (
        <section aria-labelledby="excluded-heading" className="space-y-1">
          <h2 id="excluded-heading" className="text-sm font-medium">
            {t("vat.summary.excluded", { count: data.excluded.length })}
          </h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {data.excluded.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  to="/invoices/$id"
                  params={{ id: invoice.id }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {invoice.number || t("invoices.noNumber")} (
                  {t(`invoices.status.${invoice.status}`, { defaultValue: invoice.status })})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={t("vat.summary.outputVat")}
          amount={data.outputVat}
          extra={
            <Link
              to="/invoices"
              search={{ ...range, direction: "sales" }}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              {t("vat.summary.invoices", { count: data.included.sales })}
            </Link>
          }
        />
        <Stat
          label={t("vat.summary.inputVat")}
          amount={data.inputVat}
          extra={
            <Link
              to="/invoices"
              search={{ ...range, direction: "purchase" }}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              {t("vat.summary.invoices", { count: data.included.purchases })}
            </Link>
          }
        />
        <Stat label={resultLabel} amount={refundable ? data.payable.slice(1) : data.payable} strong />
      </div>

      <section aria-labelledby="turnover-heading" className="space-y-3">
        <h2 id="turnover-heading" className="text-lg font-semibold">
          {t("vat.summary.turnover")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label={t("vat.summary.taxable")} amount={data.taxableTurnover} />
          <Stat label={t("vat.summary.zeroRated")} amount={data.zeroRatedTurnover} />
          <Stat label={t("vat.summary.exempt")} amount={data.exemptTurnover} />
          <Stat label={t("vat.summary.depositBalance")} amount={data.depositBalance ?? "0.00"} />
        </div>
      </section>

      {data.byRate.length > 0 ? (
        <section aria-labelledby="by-rate-heading" className="space-y-2">
          <h2 id="by-rate-heading" className="text-lg font-semibold">
            {t("vat.summary.byRate")}
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {(["rate", "salesNet", "salesVat", "purchaseNet", "purchaseVat"] as const).map((column, index) => (
                    <th
                      key={column}
                      scope="col"
                      className={`px-3 py-2 font-medium ${index === 0 ? "text-left" : "text-right"}`}
                    >
                      {t(`vat.summary.col.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byRate.map((row) => (
                  <tr key={row.code} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {row.code} · {row.ratePercent}%
                    </th>
                    {[row.salesNet, row.salesVat, row.purchaseNet, row.purchaseVat].map((amount, index) => (
                      <td key={index} className="px-3 py-2 text-right">
                        <MoneyText amount={amount} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {data.explanation.length > 0 ? (
        <section aria-labelledby="explanation-heading" className="space-y-1">
          <h2 id="explanation-heading" className="flex items-center gap-1.5 text-sm font-medium">
            <Info className="size-4" aria-hidden="true" />
            {t("vat.summary.how")}
          </h2>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {data.explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  amount,
  extra,
  strong,
}: {
  label: string;
  amount: string;
  extra?: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <dl className="space-y-1">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className={strong ? "text-2xl font-semibold" : "text-xl font-medium"}>
            <MoneyText amount={amount} />
          </dd>
          {extra ? <dd>{extra}</dd> : null}
        </dl>
      </CardContent>
    </Card>
  );
}
