import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import type { LegislationListSearch } from "./filters";

export type LegislationSummary = Item<Json<"/legislation">>;
export type LegislationDetail = Json<"/legislation/{id}">;
export type LegislationVersion = Item<Json<"/legislation/{id}/versions">>;
export type DiffHunk = Item<Json<"/legislation/{id}/diff">["hunks"]>;

export const PAGE_SIZE = 20;

export const legislationKeys = {
  all: ["legislation"] as const,
  list: (filters: LegislationListSearch) => ["legislation", "list", filters] as const,
  detail: (id: string, date: string) => ["legislation", "detail", id, date] as const,
  versions: (id: string) => ["legislation", "versions", id] as const,
  diff: (id: string, from: number, to: number) => ["legislation", "diff", id, from, to] as const,
};

/** The list is paged by offset: the next page starts where the loaded ones end, and a short page is the last. */
export function useLegislationList(filters: LegislationListSearch) {
  return useInfiniteQuery({
    queryKey: legislationKeys.list(filters),
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.GET("/legislation", {
          signal,
          params: {
            query: { q: filters.q?.trim() || undefined, type: filters.type, offset: pageParam, limit: PAGE_SIZE },
          },
        }),
      ),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.reduce((sum, page) => sum + page.length, 0),
    placeholderData: keepPreviousData,
  });
}

/** The document and the text that was in force on `date` (today when omitted). */
export function useLegislation(id: string, date?: string) {
  return useQuery({
    queryKey: legislationKeys.detail(id, date ?? ""),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/legislation/{id}", { signal, params: { path: { id }, query: { date } } })),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useVersions(id: string) {
  return useQuery({
    queryKey: legislationKeys.versions(id),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/legislation/{id}/versions", { signal, params: { path: { id } } })),
    retry: false,
  });
}

export function useVersionDiff(id: string, from: number | undefined, to: number | undefined) {
  return useQuery({
    queryKey: legislationKeys.diff(id, from ?? 0, to ?? 0),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/legislation/{id}/diff", {
          signal,
          params: { path: { id }, query: { from: from ?? 0, to: to ?? 0 } },
        }),
      ),
    enabled: from !== undefined && to !== undefined,
    retry: false,
  });
}
