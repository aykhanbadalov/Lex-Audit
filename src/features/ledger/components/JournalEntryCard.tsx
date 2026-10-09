import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MoneyText } from "@/shared/components/MoneyText";
import type { Currency } from "@/shared/lib/money";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useSubmitJournal, type JournalEntry } from "../api";

const STATUS_TONE: Record<JournalEntry["status"], BadgeTone> = {
  proposed: "info",
  pending_approval: "warning",
  approved: "success",
  posted: "success",
  rejected: "danger",
};

export function JournalStatusBadge({ status }: { status: JournalEntry["status"] }) {
  const { t } = useTranslation();
  return <Badge tone={STATUS_TONE[status]}>{t(`invoices.journal.status.${status}`)}</Badge>;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  /** May this person send the entry for approval? The server checks again. */
  canSubmit: boolean;
  /** Offer a link back to the invoice the entry came from. */
  showSourceLink?: boolean;
}

/** One journal entry: its state, its lines and what can be done with it. Used on the invoice and on the ledger. */
export function JournalEntryCard({ entry, canSubmit, showSourceLink = false }: JournalEntryCardProps) {
  const { t, i18n } = useTranslation();
  const submit = useSubmitJournal(entry.id);
  const currency = entry.currency as Currency;
  // A rate is a decimal string; only the decimal mark is adapted to the language.
  const rate = entry.exchangeRate
    ? i18n.language === "en"
      ? entry.exchangeRate
      : entry.exchangeRate.replace(".", ",")
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <JournalStatusBadge status={entry.status} />
        <Badge tone={entry.balanced ? "success" : "danger"}>
          {entry.balanced ? t("invoices.journal.balanced") : t("invoices.journal.unbalanced")}
        </Badge>
        {entry.source === "ai" || entry.source === "invoice" ? (
          <span className="text-xs text-muted-foreground">{t("invoices.journal.aiNote")}</span>
        ) : null}
      </div>
      {rate ? (
        <p className="text-xs text-muted-foreground">
          {t("invoices.journal.rate", { rate, currency: entry.currency })}
        </p>
      ) : null}
      {showSourceLink && entry.sourceInvoiceId ? (
        <Link
          to="/invoices/$id"
          params={{ id: entry.sourceInvoiceId }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("ledger.openInvoice")}
        </Link>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("invoices.journal.title")}</caption>
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {t("invoices.journal.account")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("invoices.journal.debit")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("invoices.journal.credit")}
              </th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line, index) => (
              <tr key={index} className="border-t">
                <td className="px-3 py-2">
                  <span className="font-medium">{line.accountCode}</span> · {line.accountName}
                  {line.description ? (
                    <span className="block text-xs text-muted-foreground">{line.description}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  {line.debit !== "0.00" ? <MoneyText amount={line.debit} currency={currency} /> : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {line.credit !== "0.00" ? <MoneyText amount={line.credit} currency={currency} /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted font-medium">
            <tr className="border-t">
              <th scope="row" className="px-3 py-2 text-left">
                {t("invoices.journal.total")}
              </th>
              <td className="px-3 py-2 text-right">
                <MoneyText amount={entry.totalDebit} currency={currency} />
              </td>
              <td className="px-3 py-2 text-right">
                <MoneyText amount={entry.totalCredit} currency={currency} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {entry.status === "proposed" && canSubmit ? (
        <Button type="button" onClick={() => submit.mutate()} disabled={submit.isPending || !entry.balanced}>
          {t("invoices.journal.submit")}
        </Button>
      ) : null}
      {entry.status === "pending_approval" ? (
        <p className="text-sm text-muted-foreground">{t("invoices.journal.waiting")}</p>
      ) : null}
    </div>
  );
}
