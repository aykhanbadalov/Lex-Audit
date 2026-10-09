import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { MoneyText } from "@/shared/components/MoneyText";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useJournalEntry, useProposeEntries, useSubmitJournal, type InvoiceDetail, type JournalEntry } from "../api";

const STATUS_TONE: Record<JournalEntry["status"], BadgeTone> = {
  proposed: "info",
  pending_approval: "warning",
  approved: "success",
  posted: "success",
  rejected: "danger",
};

export function JournalProposal({ detail, canWrite }: { detail: InvoiceDetail; canWrite: boolean }) {
  const { t } = useTranslation();
  const propose = useProposeEntries(detail.id);
  const entry = useJournalEntry(detail.journalEntryId);

  return (
    <section aria-labelledby="journal-heading" className="space-y-3">
      <h2 id="journal-heading" className="text-lg font-semibold">
        {t("invoices.journal.title")}
      </h2>

      {!detail.journalEntryId ? (
        detail.status === "validated" ? (
          canWrite ? (
            <Button type="button" onClick={() => propose.mutate()} disabled={propose.isPending}>
              {t("invoices.journal.propose")}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("invoices.journal.none")}</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">{t("invoices.journal.fixFirst")}</p>
        )
      ) : entry.isPending ? (
        <LoadingState rows={3} />
      ) : entry.isError ? (
        <ErrorState message={entry.error.message} onRetry={() => void entry.refetch()} />
      ) : (
        <EntryView entry={entry.data} currency={detail.currency} canWrite={canWrite} />
      )}
    </section>
  );
}

function EntryView({
  entry,
  currency,
  canWrite,
}: {
  entry: JournalEntry;
  currency: InvoiceDetail["currency"];
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const submit = useSubmitJournal(entry.id);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[entry.status]}>{t(`invoices.journal.status.${entry.status}`)}</Badge>
        <Badge tone={entry.balanced ? "success" : "danger"}>
          {entry.balanced ? t("invoices.journal.balanced") : t("invoices.journal.unbalanced")}
        </Badge>
        <span className="text-xs text-muted-foreground">{t("invoices.journal.aiNote")}</span>
      </div>
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
      {entry.status === "proposed" && canWrite ? (
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
