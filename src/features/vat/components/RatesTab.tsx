import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/api/client";
import { unwrap } from "@/api/unwrap";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";

/** Active and proposed VAT rates. A rate that is only proposed is not used until someone else approves it. */
export function RatesTab() {
  const { t, i18n } = useTranslation();
  const rates = useQuery({
    queryKey: ["tax-rates", "vat", "all"],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/tax-rates", { signal, params: { query: { taxType: "VAT" } } })),
    staleTime: 60_000,
  });
  const locale = localeTag(i18n.language);
  if (rates.isPending) return <LoadingState rows={3} />;
  if (rates.isError) return <ErrorState message={rates.error.message} onRetry={() => void rates.refetch()} />;

  const percent = (value: string) => `${i18n.language === "en" ? value : value.replace(".", ",")}%`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("vat.rates.intro")}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("vat.tab.rates")}</caption>
          <thead className="bg-muted">
            <tr>
              {(["code", "rate", "treatment", "valid", "status", "source"] as const).map((column) => (
                <th key={column} scope="col" className="px-3 py-2 text-left font-medium">
                  {t(`vat.rates.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.data.map((rate) => (
              <tr key={rate.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{rate.code}</td>
                <td className="px-3 py-2">{percent(rate.ratePercent)}</td>
                <td className="px-3 py-2">{t(`vat.rates.treatments.${rate.treatment}`)}</td>
                <td className="px-3 py-2">
                  {formatDate(rate.validFrom, locale)} –{" "}
                  {rate.validTo ? formatDate(rate.validTo, locale) : t("vat.rates.now")}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    tone={rate.status === "active" ? "success" : "warning"}
                    label={t(`vat.rates.statuses.${rate.status}`)}
                  />
                </td>
                <td className="px-3 py-2">
                  {rate.legalSourceId ? (
                    <Link
                      to="/legislation/$id"
                      params={{ id: rate.legalSourceId }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {t("vat.rates.openSource")}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
