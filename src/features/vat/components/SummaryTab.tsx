import { Link } from "@tanstack/react-router";
import { Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { MoneyText } from "@/shared/components/MoneyText";
import type { Currency } from "@/shared/lib/money";
import { Card, CardContent } from "@/shared/ui/card";
import { useVatSummary, type VatSummary } from "../api";

type Bucket = VatSummary["breakdown"][number]["bucket"];

export function SummaryTab({ periodId }: { periodId: string }) {
  const { t } = useTranslation();
  const summary = useVatSummary(periodId);
  if (summary.isPending) return <LoadingState rows={4} />;
  if (summary.isError) return <ErrorState message={summary.error.message} onRetry={() => void summary.refetch()} />;

  const data = summary.data;
  const currency = data.currency as Currency;
  const count = (bucket: Bucket) => data.breakdown.find((item) => item.bucket === bucket)?.invoiceCount ?? 0;
  const resultLabel =
    data.resultKind === "payable"
      ? t("vat.summary.resultPayable")
      : data.resultKind === "refundable"
        ? t("vat.summary.resultRefundable")
        : t("vat.summary.resultZero");

  const drill = (bucket: Bucket): ReactNode =>
    count(bucket) > 0 ? (
      <Link
        to="/invoices"
        search={{ vatPeriod: periodId, vatBucket: bucket }}
        className="text-xs text-primary underline-offset-4 hover:underline"
      >
        {t("vat.summary.invoices", { count: count(bucket) })}
      </Link>
    ) : (
      <span className="text-xs text-muted-foreground">{t("vat.summary.invoices", { count: 0 })}</span>
    );

  return (
    <div className="space-y-6">
      {data.excludedInvoiceCount > 0 ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            {t("vat.summary.excluded", { count: data.excludedInvoiceCount })}{" "}
            <Link to="/invoices" search={{ vatPeriod: periodId, status: "extracted" }} className="underline">
              {t("vat.summary.excludedLink")}
            </Link>
          </p>
        </div>
      ) : null}
      {data.convertedInvoiceCount > 0 ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("vat.summary.converted", { count: data.convertedInvoiceCount })}
        </p>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("vat.summary.outputVat")} amount={data.outputVat} currency={currency} extra={drill("output")} />
        <Stat label={t("vat.summary.inputVat")} amount={data.inputVat} currency={currency} extra={drill("input")} />
        <Stat label={resultLabel} amount={data.result} currency={currency} strong />
      </dl>

      <section aria-labelledby="turnover-heading" className="space-y-3">
        <h2 id="turnover-heading" className="text-lg font-semibold">
          {t("vat.summary.turnover")}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("vat.summary.taxable")} amount={data.taxableTurnover} currency={currency} />
          <Stat
            label={t("vat.summary.zeroRated")}
            amount={data.zeroRatedTurnover}
            currency={currency}
            extra={drill("zeroRated")}
          />
          <Stat
            label={t("vat.summary.exempt")}
            amount={data.exemptTurnover}
            currency={currency}
            extra={drill("exempt")}
          />
        </dl>
      </section>
    </div>
  );
}

function Stat({
  label,
  amount,
  currency,
  extra,
  strong,
}: {
  label: string;
  amount: string;
  currency: Currency;
  extra?: ReactNode;
  strong?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className={strong ? "text-2xl font-semibold" : "text-xl font-medium"}>
          <MoneyText amount={amount} currency={currency} />
        </dd>
        {extra ? <dd>{extra}</dd> : null}
      </CardContent>
    </Card>
  );
}
