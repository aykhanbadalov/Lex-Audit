import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { accountName, useAccounts } from "@/shared/api/referenceData";
import { MoneyText } from "@/shared/components/MoneyText";
import { sameAmount, sumDecimals } from "@/shared/lib/decimal";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useSubmitJournal, type JournalView } from "../api";

type Shown = JournalView["status"] | "pending_approval";

const STATUS_TONE: Record<Shown, BadgeTone> = {
  proposed: "info",
  pending_approval: "warning",
  approved: "success",
  posted: "success",
};

/** An entry with an approval waiting is "proposed" on the backend; for a person it is "waiting for approval". */
export function journalState(entry: Pick<JournalView, "status" | "approvalId">): Shown {
  return entry.status === "proposed" && entry.approvalId ? "pending_approval" : entry.status;
}

export function JournalStatusBadge({ entry }: { entry: Pick<JournalView, "status" | "approvalId"> }) {
  const { t } = useTranslation();
  const state = journalState(entry);
  return <Badge tone={STATUS_TONE[state]}>{t(`invoices.journal.status.${state}`)}</Badge>;
}

interface JournalEntryCardProps {
  entry: JournalView;
  /** May this person send the entry for approval? The server checks again. */
  canSubmit: boolean;
  /** Offer a link back to the invoice the entry came from. */
  showSourceLink?: boolean;
}

/**
 * One journal entry: its state, its lines and what can be done with it. Used on the invoice and on the ledger.
 * The totals shown under the table are sums of the lines for reading only; the backend refuses an unbalanced entry.
 */
export function JournalEntryCard({ entry, canSubmit, showSourceLink = false }: JournalEntryCardProps) {
  const { t, i18n } = useTranslation();
  const accounts = useAccounts();
  const submit = useSubmitJournal(entry.id);
  const totalDebit = sumDecimals(entry.lines.map((line) => line.debit));
  const totalCredit = sumDecimals(entry.lines.map((line) => line.credit));
  const balanced = sameAmount(totalDebit, totalCredit);
  const state = journalState(entry);
  const nameOf = (code: string) => {
    const account = accounts.data?.find((candidate) => candidate.code === code);
    return account ? accountName(account, i18n.language) : "";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <JournalStatusBadge entry={entry} />
        <Badge tone={balanced ? "success" : "danger"}>
          {balanced ? t("invoices.journal.balanced") : t("invoices.journal.unbalanced")}
        </Badge>
        {entry.source === "ai" || entry.source === "invoice" ? (
          <span className="text-xs text-muted-foreground">{t("invoices.journal.aiNote")}</span>
        ) : null}
      </div>
      {showSourceLink && entry.sourceInvoiceId ? (
        <Link
          to="/invoices/$id"
          params={{ id: entry.sourceInvoiceId }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("ledger.openInvoice")}
        </Link>
      ) : null}
      {entry.explanation && entry.explanation.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {entry.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
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
                  <span className="font-medium">{line.accountCode}</span>
                  {nameOf(line.accountCode) ? ` · ${nameOf(line.accountCode)}` : ""}
                  {line.description ? (
                    <span className="block text-xs text-muted-foreground">{line.description}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  {!sameAmount(line.debit, "0") ? <MoneyText amount={line.debit} /> : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {!sameAmount(line.credit, "0") ? <MoneyText amount={line.credit} /> : "—"}
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
                <MoneyText amount={totalDebit} />
              </td>
              <td className="px-3 py-2 text-right">
                <MoneyText amount={totalCredit} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {state === "proposed" && canSubmit ? (
        <Button type="button" onClick={() => submit.mutate()} disabled={submit.isPending || !balanced}>
          {t("invoices.journal.submit")}
        </Button>
      ) : null}
      {state === "pending_approval" ? (
        <p className="text-sm text-muted-foreground">{t("invoices.journal.waiting")}</p>
      ) : null}
    </div>
  );
}
