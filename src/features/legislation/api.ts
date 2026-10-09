import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import type { LegislationListSearch } from "./filters";

export type LegislationSummary = components["schemas"]["LegislationSummary"];
export type LegislationDetail = components["schemas"]["LegislationDetail"];
export type LegislationVersion = components["schemas"]["LegislationVersion"];
export type ArticleDiff = components["schemas"]["ArticleDiff"];

export const PAGE_SIZE = 10;

export const legislationKeys = {
  all: ["legislation"] as const,
  list: (filters: LegislationListSearch) => ["legislation", "list", filters] as const,
  detail: (id: string) => ["legislation", "detail", id] as const,
  version: (id: string, versionId: string) => ["legislation", "version", id, versionId] as const,
  diff: (id: string, from: string, to: string) => ["legislation", "diff", id, from, to] as const,
};

export function useLegislationList(filters: LegislationListSearch) {
  return useInfiniteQuery({
    queryKey: legislationKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.GET("/legislation", {
          signal,
          params: {
            query: { q: filters.q?.trim() || undefined, type: filters.type, cursor: pageParam, limit: PAGE_SIZE },
          },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

export function useLegislation(id: string) {
  return useQuery({
    queryKey: legislationKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/legislation/{id}", { signal, params: { path: { id } } })),
    retry: false,
  });
}

export function useVersionText(id: string, versionId: string | undefined) {
  return useQuery({
    queryKey: legislationKeys.version(id, versionId ?? ""),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/legislation/{id}/versions/{versionId}", {
          signal,
          params: { path: { id, versionId: versionId ?? "" } },
        }),
      ),
    enabled: Boolean(versionId),
    retry: false,
  });
}

export function useVersionDiff(id: string, from: string | undefined, to: string | undefined) {
  return useQuery({
    queryKey: legislationKeys.diff(id, from ?? "", to ?? ""),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/legislation/{id}/diff", {
          signal,
          params: { path: { id }, query: { from: from ?? "", to: to ?? "" } },
        }),
      ),
    enabled: Boolean(from && to),
    retry: false,
  });
}
