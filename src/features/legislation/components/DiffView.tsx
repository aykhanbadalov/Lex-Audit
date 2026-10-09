import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import type { ArticleDiff } from "../api";

const STATUS_TONE: Record<ArticleDiff["status"], BadgeTone> = {
  unchanged: "neutral",
  changed: "warning",
  added: "success",
  removed: "danger",
};

/**
 * Additions and removals are marked by underline / strike-through as well as colour,
 * so the difference is still readable for colour-blind users and in print.
 */
export function DiffView({ articles, showUnchanged }: { articles: ArticleDiff[]; showUnchanged: boolean }) {
  const { t } = useTranslation();
  const visible = showUnchanged ? articles : articles.filter((article) => article.status !== "unchanged");

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("legislation.noDifferences")}</p>;
  }

  return (
    <ol className="space-y-4">
      {visible.map((article) => (
        <li key={article.ref} className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="font-medium">
              {t("legislation.article", { ref: article.ref })}. {article.title}
            </h3>
            <Badge tone={STATUS_TONE[article.status]}>{t(`legislation.diffStatus.${article.status}`)}</Badge>
          </div>
          <p className="text-sm leading-relaxed">
            {article.segments.map((segment, index) =>
              segment.type === "added" ? (
                <ins
                  key={index}
                  className="bg-emerald-100 text-emerald-950 underline decoration-emerald-600 decoration-2 dark:bg-emerald-950 dark:text-emerald-100"
                >
                  {segment.text}
                </ins>
              ) : segment.type === "removed" ? (
                <del
                  key={index}
                  className="bg-red-100 text-red-950 decoration-red-600 decoration-2 dark:bg-red-950 dark:text-red-100"
                >
                  {segment.text}
                </del>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}
