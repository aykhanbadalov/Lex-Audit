import { Download, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { MoneyText } from "@/shared/components/MoneyText";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import type { Currency } from "@/shared/lib/money";
import { Button } from "@/shared/ui/button";
import { exportVatDraft, useCreateVatDraft, useVatDraft, type ExportFormat, type VatPeriod } from "../api";

const FORMATS: ExportFormat[] = ["pdf", "xlsx", "xml"];

export function ReturnTab({ period }: { period: VatPeriod }) {
  const { t, i18n } = useTranslation();
  const draft = useVatDraft(period.id);
  const create = useCreateVatDraft(period.id);
  const canWrite = usePermission("vat:write");
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const locale = localeTag(i18n.language);

  async function download(format: ExportFormat) {
    setExporting(format);
    try {
      await exportVatDraft(period.id, format);
    } catch {
      toast.error(t("vat.return.export.failed"));
    } finally {
      setExporting(null);
    }
  }

  if (draft.isPending) return <LoadingState rows={3} />;
  if (draft.isError) return <ErrorState message={draft.error.message} onRetry={() => void draft.refetch()} />;

  const data = draft.data;
  const canPrepare = canWrite && period.status === "open";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("vat.return.disclaimer")}</p>

      {data ? (
        <>
          <p className="text-sm">
            {t("vat.return.generated", { date: formatDateTime(data.generatedAt, locale), name: data.generatedByName })}
          </p>
          {data.excludedInvoiceCount > 0 ? (
            <p role="status" className="flex items-start gap-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
              {t("vat.return.stale", { count: data.excludedInvoiceCount })}
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("vat.tab.return")}</caption>
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.code} className="border-t first:border-t-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {t(`vat.return.line.${line.code}`, { defaultValue: line.code })}
                    </th>
                    <td className="px-3 py-2 text-right">
                      <MoneyText amount={line.amount} currency={data.currency as Currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((format) => (
              <Button
                key={format}
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting !== null}
                onClick={() => void download(format)}
              >
                <Download className="size-4" aria-hidden="true" />
                {t(`vat.return.export.${format}`)}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm">{t("vat.return.none")}</p>
      )}

      {canPrepare ? (
        <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
          {data ? t("vat.return.prepareAgain") : t("vat.return.prepare")}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {period.status === "filed" ? t("vat.return.filedNote") : t("vat.return.readerNote")}
        </p>
      )}
    </div>
  );
}
