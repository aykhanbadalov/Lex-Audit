import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MoneyText } from "@/shared/components/MoneyText";
import { usePermission } from "@/shared/hooks/usePermission";
import { Button } from "@/shared/ui/button";
import { downloadDraft, useCreateVatDraft, type VatPeriod } from "../api";

/** The draft is a CSV for the accountant to check. Nothing is filed from here; filing happens on e-taxes.gov.az. */
export function ReturnTab({ period }: { period: VatPeriod }) {
  const { t } = useTranslation();
  const create = useCreateVatDraft(period.period);
  const canWrite = usePermission("vat:write");
  const [downloading, setDownloading] = useState(false);
  const draft = create.data;

  async function download() {
    if (!draft) return;
    setDownloading(true);
    try {
      await downloadDraft(draft.draftFileId, period.period, draft.version);
    } catch {
      toast.error(t("vat.return.export.failed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("vat.return.disclaimer")}</p>
      <p className="text-sm">
        {(period.latestDraftVersion ?? 0) > 0
          ? t("vat.return.latest", { version: period.latestDraftVersion ?? 0 })
          : t("vat.return.none")}
      </p>

      {draft ? (
        <section aria-label={t("vat.tab.return")} className="space-y-3 rounded-lg border bg-card p-4">
          <p className="text-sm font-medium">{t("vat.return.version", { version: draft.version })}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t("vat.summary.outputVat")}</dt>
              <dd>
                <MoneyText amount={draft.summary.outputVat} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("vat.summary.inputVat")}</dt>
              <dd>
                <MoneyText amount={draft.summary.inputVat} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("vat.summary.resultPayable")}</dt>
              <dd className="font-semibold">
                <MoneyText amount={draft.summary.payable} />
              </dd>
            </div>
          </dl>
          {!draft.summary.complete ? (
            <p role="status" className="text-sm">
              {t("vat.summary.incomplete")}
            </p>
          ) : null}
          <Button type="button" variant="outline" size="sm" disabled={downloading} onClick={() => void download()}>
            <Download className="size-4" aria-hidden="true" />
            {t("vat.return.export.csv")}
          </Button>
        </section>
      ) : null}

      {canWrite ? (
        <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
          {(period.latestDraftVersion ?? 0) > 0 || draft ? t("vat.return.prepareAgain") : t("vat.return.prepare")}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">{t("vat.return.readerNote")}</p>
      )}
    </div>
  );
}
