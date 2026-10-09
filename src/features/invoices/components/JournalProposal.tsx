import { useTranslation } from "react-i18next";
import { useJournalEntry } from "@/features/ledger/api";
import { JournalEntryCard } from "@/features/ledger/components/JournalEntryCard";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { usePermission } from "@/shared/hooks/usePermission";
import { Button } from "@/shared/ui/button";
import { useProposeEntries, type InvoiceDetail } from "../api";

export function JournalProposal({ detail, canWrite }: { detail: InvoiceDetail; canWrite: boolean }) {
  const { t } = useTranslation();
  const propose = useProposeEntries(detail.id);
  const entry = useJournalEntry(detail.journalEntryId);
  const canSubmit = usePermission("ledger:write");

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
        <JournalEntryCard entry={entry.data} canSubmit={canSubmit} showSourceLink={false} />
      )}
    </section>
  );
}
