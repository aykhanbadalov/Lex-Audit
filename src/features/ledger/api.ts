import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import type { JournalSearch } from "./filters";

export type JournalEntry = Json<"/journal/{id}">;
export type JournalEntrySummary = Item<Json<"/journal">>;
export type JournalLine = Item<JournalEntry["lines"]>;

/** What the card needs; a proposal made from an invoice has the same lines but fewer fields than a stored entry. */
export interface JournalView {
  id: string;
  status: "proposed" | "approved" | "posted";
  source?: JournalEntry["source"];
  sourceInvoiceId?: string | null;
  /** Set while an approval for posting the entry is waiting. */
  approvalId?: string | null;
  explanation?: string[];
  lines: { accountCode: string; debit: string; credit: string; description: string | null }[];
}

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
            query: { status: filters.status, from: filters.from, to: filters.to, cursor: pageParam, limit: PAGE_SIZE },
          },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
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

/** Posting needs approval from someone else: this only asks for it. The entry is not posted until it is granted. */
export function useSubmitJournal(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/journal/{id}/submit", { params: { path: { id: entryId } } })),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ledgerKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["approvals"] }),
      ]);
      toast.success(i18n.t("invoices.journal.submitted"));
    },
    onError: () => {
      toast.error(i18n.t("invoices.actionFailed"));
    },
  });
}
