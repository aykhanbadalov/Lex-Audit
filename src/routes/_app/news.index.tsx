import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Newspaper, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNewsList, useNewsSources, useSetNewsBookmark } from "@/features/news/api";
import { NewsFilters } from "@/features/news/components/NewsFilters";
import { NewsListItem } from "@/features/news/components/NewsListItem";
import { hasActiveFilters, newsSearchSchema, toApiFilters, type NewsSearch } from "@/features/news/filters";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/_app/news/")({
  validateSearch: newsSearchSchema,
  component: NewsPage,
});

function NewsPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="news:read">
      <NewsPageContent />
    </RequirePermission>
  );
}

function NewsPageContent() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const filters = toApiFilters(search);
  const active = hasActiveFilters(search);

  const sources = useNewsSources();
  const list = useNewsList(filters);
  const { mutate: setBookmark } = useSetNewsBookmark();

  const items = list.data?.pages.flatMap((page) => page.items) ?? [];

  function updateSearch(patch: Partial<NewsSearch>) {
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  }

  return (
    <>
      <PageHeader title={t("nav.news")} description={t("modules.news")} />

      <div className="mb-6">
        <NewsFilters
          search={search}
          sources={sources.data}
          hasActiveFilters={active}
          onChange={updateSearch}
          onReset={() => void navigate({ search: {}, replace: true })}
        />
      </div>

      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        active ? (
          <EmptyState icon={SearchX} title={t("table.noResults")} description={t("table.noResultsHint")} />
        ) : (
          <EmptyState icon={Newspaper} title={t("news.empty")} description={t("news.emptyHint")} />
        )
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("news.shown", { count: items.length })}
          </p>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <NewsListItem
                  item={item}
                  listSearch={search}
                  onToggleBookmark={(target) => setBookmark({ id: target.id, value: !target.isBookmarked })}
                />
              </li>
            ))}
          </ul>
          {list.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? t("app.loading") : t("common.loadMore")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
