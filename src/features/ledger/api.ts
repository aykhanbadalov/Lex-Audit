import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import type { JournalSearch } from "./filters";

export type JournalEntry = components["schemas"]["JournalEntry"];
export type JournalEntrySummary = components["schemas"]["JournalEntrySummary"];

export const PAGE_SIZE = 10;

export const ledgerKeys = {
  all: ["journal"] as const,
  list: (filters: JournalSearch) => ["journal", "list", filters] as const,
  entry: (id: string) => ["journal", "entry", id] as const,
};

export function useJournalList(filters: JournalSearch) {
  return useInfiniteQuery({
    queryKey: ledgerKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.GET("/journal", {
          signal,
          params: {
            query: {
              q: filters.q?.trim() || undefined,
              status: filters.status,
              from: filters.from,
              to: filters.to,
              cursor: pageParam,
              limit: PAGE_SIZE,
            },
          },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useJournalEntry(id: string | null) {
  return useQuery({
    queryKey: ledgerKeys.entry(id ?? ""),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/journal/{id}", { signal, params: { path: { id: id ?? "" } } })),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useSubmitJournal(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/journal/{id}/submit", { params: { path: { id: entryId } } })),
    onSuccess: async (entry) => {
      queryClient.setQueryData(ledgerKeys.entry(entryId), entry);
      await queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
      toast.success(i18n.t("invoices.journal.submitted"));
    },
    onError: () => {
      toast.error(i18n.t("invoices.actionFailed"));
    },
  });
}
