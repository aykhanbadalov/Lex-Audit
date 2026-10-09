import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { components } from "@/api/schema";
import { useTaxRates } from "@/shared/api/referenceData";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { ratePercent } from "@/shared/lib/percent";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useProposeRate } from "../api";
import { percentToRate } from "../rate";
import { RequestDialog } from "./RequestDialog";

type TaxRate = components["schemas"]["TaxRate"];

export function RatesTab() {
  const { t, i18n } = useTranslation();
  const rates = useTaxRates();
  const tag = localeTag(i18n.language);
  const [editing, setEditing] = useState<TaxRate | null>(null);

  if (rates.isPending) return <LoadingState />;
  if (rates.error) return <ErrorState message={rates.error.message} onRetry={() => void rates.refetch()} />;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        {t("admin.rates.hint")}{" "}
        <Link to="/approvals" search={{ status: "pending" }} className="text-primary hover:underline">
          {t("nav.approvals")}
        </Link>
      </p>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {(["label", "rate", "validFrom"] as const).map((column) => (
                <th key={column} scope="col" className="px-3 py-2 font-medium">
                  {t(`admin.rates.${column}`)}
                </th>
              ))}
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">{t("admin.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rates.data.map((rate) => (
              <tr key={rate.code} className="border-t">
                <td className="px-3 py-2">
                  <span className="block font-medium">{rate.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{rate.code}</span>
                </td>
                <td className="px-3 py-2">{ratePercent(rate.rate).replace(".", ",")}%</td>
                <td className="px-3 py-2">{formatDate(rate.validFrom, tag)}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(rate)}>
                    {t("admin.rates.change")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? <RateDialog key={editing.code} rate={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function RateDialog({ rate, onClose }: { rate: TaxRate; onClose: () => void }) {
  const { t } = useTranslation();
  const propose = useProposeRate();
  const [percent, setPercent] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const parsed = percentToRate(percent);
  const showError = percent !== "" && parsed === null;

  return (
    <RequestDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("admin.rates.dialogTitle", { label: rate.label })}
      description={t("admin.rates.dialogDescription")}
      valid={parsed !== null && /^\d{4}-\d{2}-\d{2}$/.test(validFrom)}
      busy={propose.isPending}
      onSubmit={(reason) =>
        parsed && propose.mutate({ code: rate.code, rate: parsed, validFrom, reason }, { onSuccess: onClose })
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="rate-percent">{t("admin.rates.newRate")}</Label>
        <Input
          id="rate-percent"
          inputMode="decimal"
          value={percent}
          aria-invalid={showError}
          aria-describedby={showError ? "rate-percent-error" : undefined}
          onChange={(event) => setPercent(event.target.value)}
        />
        {showError ? (
          <p id="rate-percent-error" role="alert" className="text-xs text-destructive">
            {t("admin.rates.invalid")}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rate-from">{t("admin.rates.validFrom")}</Label>
        <Input id="rate-from" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
      </div>
    </RequestDialog>
  );
}
