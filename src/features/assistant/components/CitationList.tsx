import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { citationTarget } from "../citations";
import type { Citation } from "../chatReducer";

export function CitationList({ citations }: { citations: Citation[] }) {
  const { t } = useTranslation();
  if (citations.length === 0) return null;
  return (
    <section aria-label={t("assistant.sources.title")} className="mt-3 space-y-1.5">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <BookOpen className="size-3.5" aria-hidden="true" />
        {t("assistant.sources.title")}
      </h3>
      <ol className="space-y-1.5">
        {citations.map((citation, index) => {
          const target = citationTarget(citation);
          const title = `${citation.title}${citation.locationLabel ? ` — ${citation.locationLabel}` : ""}`;
          return (
            <li key={citation.id} className="rounded-md border bg-muted/40 p-2 text-xs">
              <span className="font-medium">[{index + 1}] </span>
              {target ? (
                <Link
                  to={target.to}
                  params={{ id: target.id }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {title}
                </Link>
              ) : (
                <span>{title}</span>
              )}
              {/* Plain text on purpose: the excerpt is retrieved content, never HTML. */}
              <blockquote className="mt-1 border-l-2 pl-2 text-muted-foreground">{citation.excerpt}</blockquote>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
