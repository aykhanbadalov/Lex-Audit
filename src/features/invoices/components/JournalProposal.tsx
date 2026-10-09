import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useJournalEntry } from "@/features/ledger/api";
import { JournalEntryCard } from "@/features/ledger/components/JournalEntryCard";
import { usePermission } from "@/shared/hooks/usePermission";
import { Button } from "@/shared/ui/button";
import { useProposeEntries, type InvoiceDetail } from "../api";

/**
 * A suggested journal entry for a checked invoice. Asking for it writes nothing to the books: the entry is only
 * proposed, and a person sends it for approval from the journal.
 */
export function JournalProposal({ detail, canWrite }: { detail: InvoiceDetail; canWrite: boolean }) {
  const { t } = useTranslation();
  const propose = useProposeEntries(detail.id);
  const canSubmit = usePermission("journal:write");
  const proposal = propose.data;
  // Once it exists the entry is read from the journal, so sending it for approval shows up right here.
  const stored = useJournalEntry(proposal?.id ?? null);
  const entry = proposal ? { ...proposal, ...stored.data, explanation: proposal.explanation } : undefined;

  return (
    <section aria-labelledby="journal-heading" className="space-y-3">
      <h2 id="journal-heading" className="text-lg font-semibold">
        {t("invoices.journal.title")}
      </h2>

      {entry ? (
        <div className="space-y-2">
          <JournalEntryCard entry={entry} canSubmit={canSubmit} showSourceLink={false} />
          <Button asChild variant="outline" size="sm">
            <Link to="/ledger/$id" params={{ id: entry.id }}>
              {t("invoices.journal.open")}
            </Link>
          </Button>
        </div>
      ) : detail.status === "validated" || detail.status === "posted" ? (
        canWrite ? (
          <Button type="button" onClick={() => propose.mutate()} disabled={propose.isPending}>
            {t("invoices.journal.propose")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t("invoices.journal.none")}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">{t("invoices.journal.fixFirst")}</p>
      )}
    </section>
  );
}
