import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Citation } from "../chatReducer";

/**
 * The sources an answer was based on. The backend names each source (a law article, a news item) but gives no
 * address to open it, so they are listed, not linked. An answer without sources says so elsewhere.
 */
export function CitationList({ citations }: { citations: Citation[] }) {
  const { t } = useTranslation();
  if (citations.length === 0) return null;
  return (
    <section aria-label={t("assistant.sources.title")} className="mt-3 space-y-1">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <BookOpen className="size-3.5" aria-hidden="true" />
        {t("assistant.sources.title")}
      </h3>
      <ol className="list-decimal space-y-0.5 pl-5 text-sm">
        {citations.map((citation) => (
          <li key={citation.chunkId}>{citation.label}</li>
        ))}
      </ol>
    </section>
  );
}
