import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { useJournalEntry } from "@/features/ledger/api";
import { JournalEntryCard } from "@/features/ledger/components/JournalEntryCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/_app/ledger/$id")({
  component: JournalDetailPage,
});

function JournalDetailPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="ledger:read">
      <JournalDetailContent />
    </RequirePermission>
  );
}

function JournalDetailContent() {
  const { t, i18n } = useTranslation();
  const { id } = Route.useParams();
  const entry = useJournalEntry(id);
  const canSubmit = usePermission("ledger:write");

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/ledger">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("ledger.back")}
        </Link>
      </Button>
      {entry.isPending ? (
        <LoadingState />
      ) : entry.isError ? (
        entry.error instanceof ApiError && entry.error.code === "NOT_FOUND" ? (
          <EmptyState icon={FileQuestion} title={t("ledger.notFound")} description={t("ledger.notFoundHint")} />
        ) : (
          <ErrorState message={entry.error.message} onRetry={() => void entry.refetch()} />
        )
      ) : (
        <article className="space-y-4">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{entry.data.description}</h1>
            <p className="text-sm text-muted-foreground">{formatDate(entry.data.date, localeTag(i18n.language))}</p>
          </header>
          <JournalEntryCard entry={entry.data} canSubmit={canSubmit} showSourceLink />
        </article>
      )}
    </>
  );
}
