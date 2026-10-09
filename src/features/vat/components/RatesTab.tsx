import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useTaxRates } from "@/shared/api/referenceData";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { ratePercent } from "@/shared/lib/percent";

export function RatesTab() {
  const { t, i18n } = useTranslation();
  const rates = useTaxRates();
  const locale = localeTag(i18n.language);
  if (rates.isPending) return <LoadingState rows={3} />;
  if (rates.isError) return <ErrorState message={rates.error.message} onRetry={() => void rates.refetch()} />;

  const percent = (rate: string) =>
    `${i18n.language === "en" ? ratePercent(rate) : ratePercent(rate).replace(".", ",")}%`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("vat.rates.intro")}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("vat.tab.rates")}</caption>
          <thead className="bg-muted">
            <tr>
              {(["name", "code", "rate", "valid", "source"] as const).map((column) => (
                <th key={column} scope="col" className="px-3 py-2 text-left font-medium">
                  {t(`vat.rates.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.data.map((rate) => (
              <tr key={rate.code} className="border-t">
                <td className="px-3 py-2 font-medium">{rate.label}</td>
                <td className="px-3 py-2 font-mono text-xs">{rate.code}</td>
                <td className="px-3 py-2">{percent(rate.rate)}</td>
                <td className="px-3 py-2">
                  {formatDate(rate.validFrom, locale)} –{" "}
                  {rate.validTo ? formatDate(rate.validTo, locale) : t("vat.rates.now")}
                </td>
                <td className="px-3 py-2">
                  {rate.legalSource ? (
                    <Link
                      to="/legislation/$id"
                      params={{ id: rate.legalSource.id }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {rate.legalSource.title}
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
