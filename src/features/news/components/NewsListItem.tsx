import { Link } from "@tanstack/react-router";
import { Bookmark, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { cn } from "@/shared/lib/cn";
import { RiskLabel } from "@/shared/components/RiskLabel";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import type { NewsItem } from "../api";
import type { NewsSearch } from "../filters";

interface NewsListItemProps {
  item: NewsItem;
  /** The list filters in effect, remembered so the detail page can return to the same view. */
  listSearch: NewsSearch;
  onToggleBookmark: (item: NewsItem) => void;
}

export function NewsListItem({ item, listSearch, onToggleBookmark }: NewsListItemProps) {
  const { t, i18n } = useTranslation();

  return (
    <article className="flex gap-3 rounded-lg border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!item.isRead ? (
            <span className="inline-flex items-center gap-1 font-medium text-sky-700 dark:text-sky-300">
              <span className="size-2 rounded-full bg-current" aria-hidden="true" />
              {t("news.unread")}
            </span>
          ) : null}
          <span className="text-muted-foreground">{item.sourceName}</span>
          <span className="text-muted-foreground" aria-hidden="true">
            ·
          </span>
          <time className="text-muted-foreground" dateTime={item.publishedAt}>
            {formatDate(item.publishedAt, localeTag(i18n.language))}
          </time>
        </div>

        <h2 className={cn("text-base leading-snug", item.isRead ? "font-normal" : "font-semibold")}>
          <Link
            to="/news/$id"
            params={{ id: item.id }}
            state={{ fromNewsSearch: listSearch }}
            className="hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {item.title}
          </Link>
        </h2>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          <Sparkles className="mr-1 inline size-3.5 align-text-bottom" aria-hidden="true" />
          <span className="sr-only">{t("ai.label")}: </span>
          {item.summary}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <RiskLabel level={item.riskLevel} />
          <Badge tone="outline">{t(`category.${item.category}`)}</Badge>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 self-start"
        aria-pressed={item.isBookmarked}
        aria-label={item.isBookmarked ? t("news.removeBookmark") : t("news.addBookmark")}
        onClick={() => onToggleBookmark(item)}
      >
        <Bookmark className={cn("size-4", item.isBookmarked && "fill-current")} aria-hidden="true" />
      </Button>
    </article>
  );
}
