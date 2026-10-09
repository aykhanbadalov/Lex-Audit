import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { useAdminRates, useProposeRate, useRequestActivation, type NewRate } from "../api";
import { normalizePercent } from "../rate";

const TAX_TYPES: NewRate["taxType"][] = ["VAT", "PROFIT", "INCOME", "WITHHOLDING", "SIMPLIFIED", "SOCIAL"];

export function RatesTab() {
  const { t, i18n } = useTranslation();
  const rates = useAdminRates();
  const activate = useRequestActivation();
  const [proposing, setProposing] = useState(false);
  const tag = localeTag(i18n.language);

  if (rates.isPending) return <LoadingState />;
  if (rates.error) return <ErrorState message={rates.error.message} onRetry={() => void rates.refetch()} />;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("admin.rates.hint")}</p>
        <Button type="button" size="sm" onClick={() => setProposing(true)}>
          {t("admin.rates.propose")}
        </Button>
      </div>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {(["tax", "code", "rate", "validFrom", "status"] as const).map((column) => (
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
              <tr key={rate.id} className="border-t">
                <td className="px-3 py-2">{rate.taxType}</td>
                <td className="px-3 py-2 font-mono text-xs">{rate.code}</td>
                <td className="px-3 py-2">{rate.rate}%</td>
                <td className="px-3 py-2">{formatDate(rate.validFrom, tag)}</td>
                <td className="px-3 py-2">
                  <Badge tone={rate.status === "active" ? "success" : "warning"}>
                    {t(`vat.rates.statuses.${rate.status}`)}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  {rate.status === "proposed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={activate.isPending}
                      onClick={() => activate.mutate(rate.id)}
                    >
                      {t("admin.rates.requestActivation")}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {proposing ? <ProposeDialog onClose={() => setProposing(false)} /> : null}
    </>
  );
}

function ProposeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const propose = useProposeRate();
  const [taxType, setTaxType] = useState<NewRate["taxType"]>("VAT");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const normalized = normalizePercent(percent);
  const showError = percent !== "" && normalized === null;
  const valid = code.trim().length > 0 && normalized !== null && /^\d{4}-\d{2}-\d{2}$/.test(validFrom);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.rates.propose")}</DialogTitle>
          <DialogDescription>{t("admin.rates.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && normalized) {
              propose.mutate(
                { taxType, code: code.trim(), ratePercent: normalized, validFrom },
                { onSuccess: onClose },
              );
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="rate-type">{t("admin.rates.tax")}</Label>
            <Select
              id="rate-type"
              value={taxType}
              onChange={(event) => setTaxType(event.target.value as typeof taxType)}
            >
              {TAX_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-code">{t("admin.rates.code")}</Label>
            <Input id="rate-code" value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-percent">{t("admin.rates.newRate")}</Label>
            <Input
              id="rate-percent"
              inputMode="decimal"
              value={percent}
              aria-invalid={showError}
              onChange={(event) => setPercent(event.target.value)}
            />
            {showError ? (
              <p role="alert" className="text-xs text-destructive">
                {t("admin.rates.invalid")}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-from">{t("admin.rates.validFrom")}</Label>
            <Input
              id="rate-from"
              type="date"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || propose.isPending}>
              {t("admin.rates.propose")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
