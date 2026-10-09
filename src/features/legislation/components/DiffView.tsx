import { useTranslation } from "react-i18next";
import type { DiffHunk } from "../api";

/**
 * Additions and removals are marked by underline / strike-through as well as colour,
 * so the difference is still readable for colour-blind users and in print.
 * Text is plain text on purpose: it comes from scraped sources.
 */
export function DiffView({ hunks, showUnchanged }: { hunks: DiffHunk[]; showUnchanged: boolean }) {
  const { t } = useTranslation();
  const visible = showUnchanged ? hunks : hunks.filter((hunk) => hunk.type !== "unchanged");

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("legislation.noDifferences")}</p>;
  }

  return (
    <ol className="space-y-3">
      {visible.map((hunk, index) => (
        <li key={index} className="rounded-lg border bg-card p-4 text-sm leading-relaxed">
          {hunk.type === "added" ? (
            <ins className="bg-emerald-100 text-emerald-950 underline decoration-emerald-600 decoration-2 dark:bg-emerald-950 dark:text-emerald-100">
              <span className="sr-only">{t("legislation.diffStatus.added")}: </span>
              {hunk.text}
            </ins>
          ) : hunk.type === "removed" ? (
            <del className="bg-red-100 text-red-950 decoration-red-600 decoration-2 dark:bg-red-950 dark:text-red-100">
              <span className="sr-only">{t("legislation.diffStatus.removed")}: </span>
              {hunk.text}
            </del>
          ) : (
            <span>{hunk.text}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
