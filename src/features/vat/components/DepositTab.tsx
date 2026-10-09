import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { MoneyText } from "@/shared/components/MoneyText";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import type { Currency } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useMatchDepositLine, useVatDeposit, type DepositLine } from "../api";

export function DepositTab({ periodId }: { periodId: string }) {
  const { t, i18n } = useTranslation();
  const deposit = useVatDeposit(periodId);
  const canWrite = usePermission("vat:write");
  const match = useMatchDepositLine(periodId);
  const [pending, setPending] = useState<DepositLine | null>(null);
  const locale = localeTag(i18n.language);

  if (deposit.isPending) return <LoadingState rows={4} />;
  if (deposit.isError) return <ErrorState message={deposit.error.message} onRetry={() => void deposit.refetch()} />;
  const data = deposit.data;
  const currency = data.currency as Currency;

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-4">
        {(
          [
            ["opening", data.openingBalance],
            ["closing", data.closingBalance],
            ["ledger", data.ledgerBalance],
            ["difference", data.difference],
          ] as const
        ).map(([key, amount]) => (
          <div key={key} className="rounded-lg border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{t(`vat.deposit.${key}`)}</dt>
            <dd className="text-lg font-medium">
              <MoneyText amount={amount} currency={currency} />
            </dd>
          </div>
        ))}
      </dl>
      {data.unmatchedCount === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t("vat.deposit.reconciled")}
        </p>
      ) : (
        <p role="status" className="text-sm">
          {t("vat.deposit.unmatchedNote", { count: data.unmatchedCount })}
        </p>
      )}

      {data.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("vat.deposit.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("vat.tab.deposit")}</caption>
            <thead className="bg-muted">
              <tr>
                {(["date", "description", "direction", "amount", "status"] as const).map((column) => (
                  <th key={column} scope="col" className="px-3 py-2 text-left font-medium">
                    {t(`vat.deposit.columns.${column}`)}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">{t("vat.deposit.columns.action")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(line.date, locale)}</td>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2">{t(`vat.deposit.direction.${line.direction}`)}</td>
                  <td className="px-3 py-2 text-right">
                    <MoneyText amount={line.amount} currency={currency} />
                  </td>
                  <td className="px-3 py-2">
                    {line.matchStatus === "matched" ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone="success">{t("vat.deposit.status.matched")}</Badge>
                        {line.matchedInvoiceId ? (
                          <Link
                            to="/invoices/$id"
                            params={{ id: line.matchedInvoiceId }}
                            className="text-xs text-primary underline-offset-4 hover:underline"
                          >
                            {t("vat.deposit.invoice", { number: line.matchedInvoiceNumber ?? line.matchedInvoiceId })}
                          </Link>
                        ) : null}
                      </span>
                    ) : (
                      <Badge tone="warning">{t("vat.deposit.status.unmatched")}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {line.matchStatus === "unmatched" && line.suggestedInvoiceId && canWrite ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setPending(line)}>
                        {t("vat.deposit.match", { number: line.suggestedInvoiceNumber ?? line.suggestedInvoiceId })}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={t("vat.deposit.confirmTitle")}
        description={t("vat.deposit.confirmDescription", { number: pending?.suggestedInvoiceNumber ?? "" })}
        confirmLabel={t("vat.deposit.confirm")}
        busy={match.isPending}
        onConfirm={() => {
          if (pending?.suggestedInvoiceId)
            match.mutate(
              { lineId: pending.id, invoiceId: pending.suggestedInvoiceId },
              { onSettled: () => setPending(null) },
            );
        }}
      />
    </div>
  );
}
