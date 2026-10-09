import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import type { NewsFilters } from "./filters";

export type NewsItem = components["schemas"]["NewsItem"];
export type NewsDetail = components["schemas"]["NewsDetail"];
export type NewsPage = components["schemas"]["NewsPage"];

export const PAGE_SIZE = 8;

export const newsKeys = {
  all: ["news"] as const,
  sources: ["news", "sources"] as const,
  lists: ["news", "list"] as const,
  list: (filters: NewsFilters) => ["news", "list", filters] as const,
  detail: (id: string) => ["news", "detail", id] as const,
};

export function useNewsSources() {
  return useQuery({
    queryKey: newsKeys.sources,
    queryFn: async ({ signal }) => unwrap(await api.GET("/news/sources", { signal })),
    staleTime: 5 * 60_000,
  });
}

export function useNewsList(filters: NewsFilters) {
  return useInfiniteQuery({
    queryKey: newsKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.GET("/news", { signal, params: { query: { ...filters, cursor: pageParam, limit: PAGE_SIZE } } }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useNewsDetail(id: string) {
  return useQuery({
    queryKey: newsKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/news/{id}", { signal, params: { path: { id } } })),
    // A missing item will not appear by retrying.
    retry: false,
  });
}

/** Applies a change to one item everywhere it is cached: every list page and the detail view. */
function patchCachedItem(queryClient: QueryClient, id: string, patch: Partial<NewsItem>): void {
  queryClient.setQueriesData<InfiniteData<NewsPage>>(
    { queryKey: newsKeys.lists },
    (old) =>
      old && {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),
      },
  );
  queryClient.setQueryData<NewsDetail>(newsKeys.detail(id), (old) => old && { ...old, ...patch });
}

/** Optimistic update with rollback: the UI reacts instantly and is restored if the server refuses. */
function useOptimisticItemMutation(
  mutationFn: (variables: { id: string; value: boolean }) => Promise<unknown>,
  toPatch: (value: boolean) => Partial<NewsItem>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async ({ id, value }) => {
      await queryClient.cancelQueries({ queryKey: newsKeys.all });
      const snapshot = queryClient.getQueriesData({ queryKey: newsKeys.all });
      patchCachedItem(queryClient, id, toPatch(value));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(i18n.t("news.updateFailed"));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: newsKeys.lists }),
  });
}

export function useSetNewsRead() {
  return useOptimisticItemMutation(
    async ({ id, value }) =>
      unwrap(await api.PUT("/news/{id}/read", { params: { path: { id } }, body: { isRead: value } })),
    (value) => ({ isRead: value }),
  );
}

export function useSetNewsBookmark() {
  return useOptimisticItemMutation(
    async ({ id, value }) =>
      unwrap(await api.PUT("/news/{id}/bookmark", { params: { path: { id } }, body: { isBookmarked: value } })),
    (value) => ({ isBookmarked: value }),
  );
}
