import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { isProcessing, type InvoicesSearch } from "./filters";

export type Invoice = components["schemas"]["Invoice"];
export type InvoiceDetail = components["schemas"]["InvoiceDetail"];
export type InvoiceIssue = components["schemas"]["InvoiceIssue"];
export type InvoiceUpdate = components["schemas"]["InvoiceUpdate"];
export type JournalEntry = components["schemas"]["JournalEntry"];

export const PAGE_SIZE = 10;

/** How often a screen re-reads invoices that are still being read. Tests shorten it. */
export const invoicePollConfig = { intervalMs: 3000 };

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: ["invoices", "list"] as const,
  list: (filters: InvoicesSearch) => ["invoices", "list", filters] as const,
  detail: (id: string) => ["invoices", "detail", id] as const,
  source: (id: string) => ["invoices", "source", id] as const,
  journal: (id: string) => ["journal", id] as const,
  accounts: ["accounts"] as const,
  taxRates: ["tax-rates"] as const,
};

export function useInvoiceList(filters: InvoicesSearch) {
  return useInfiniteQuery({
    queryKey: invoiceKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.GET("/invoices", {
          signal,
          params: {
            query: {
              q: filters.q?.trim() || undefined,
              status: filters.status,
              direction: filters.direction,
              hasIssues: filters.hasIssues || undefined,
              cursor: pageParam,
              limit: PAGE_SIZE,
            },
          },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: (query) => {
      const pages = (query.state.data as InfiniteData<components["schemas"]["InvoicePage"]> | undefined)?.pages ?? [];
      return pages.some((page) => page.items.some((invoice) => isProcessing(invoice.status)))
        ? invoicePollConfig.intervalMs
        : false;
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/invoices/{id}", { signal, params: { path: { id } } })),
    retry: false,
    refetchInterval: (query) =>
      query.state.data && isProcessing(query.state.data.status) ? invoicePollConfig.intervalMs : false,
  });
}

/** The original document. An <img>/<iframe> cannot send the bearer token, so it is fetched and shown from memory. */
export function useInvoiceSource(id: string, enabled: boolean) {
  return useQuery({
    queryKey: invoiceKeys.source(id),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/invoices/{id}/source", { signal, params: { path: { id } }, parseAs: "blob" })),
    enabled,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: invoiceKeys.accounts,
    queryFn: async ({ signal }) => unwrap(await api.GET("/accounts", { signal })),
    staleTime: 10 * 60_000,
  });
}

export function useTaxRates() {
  return useQuery({
    queryKey: invoiceKeys.taxRates,
    queryFn: async ({ signal }) => unwrap(await api.GET("/tax-rates", { signal, params: { query: { type: "VAT" } } })),
    staleTime: 10 * 60_000,
  });
}

export function useJournalEntry(id: string | null) {
  return useQuery({
    queryKey: invoiceKeys.journal(id ?? ""),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/journal/{id}", { signal, params: { path: { id: id ?? "" } } })),
    enabled: Boolean(id),
    retry: false,
  });
}

function useStoreDetail(id: string) {
  const queryClient = useQueryClient();
  return (detail: InvoiceDetail) => {
    queryClient.setQueryData(invoiceKeys.detail(id), detail);
    return queryClient.invalidateQueries({ queryKey: invoiceKeys.lists });
  };
}

export function useUpdateInvoice(id: string) {
  const store = useStoreDetail(id);
  return useMutation({
    mutationFn: async (body: InvoiceUpdate) =>
      unwrap(await api.PATCH("/invoices/{id}", { params: { path: { id } }, body })),
    onSuccess: async (detail) => {
      await store(detail);
      toast.success(i18n.t("invoices.saved"));
    },
    onError: () => {
      toast.error(i18n.t("invoices.saveFailed"));
    },
  });
}

export function useValidateInvoice(id: string) {
  const store = useStoreDetail(id);
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/invoices/{id}/validate", { params: { path: { id } } })),
    onSuccess: async (detail) => {
      await store(detail);
      toast.success(i18n.t("invoices.revalidated"));
    },
    onError: () => {
      toast.error(i18n.t("invoices.actionFailed"));
    },
  });
}

export function useProposeEntries(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/invoices/{id}/propose-entries", { params: { path: { id } } })),
    onSuccess: async (entry) => {
      queryClient.setQueryData(invoiceKeys.journal(entry.id), entry);
      await queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      toast.success(i18n.t("invoices.journal.proposed"));
    },
    onError: () => {
      toast.error(i18n.t("invoices.actionFailed"));
    },
  });
}

export function useSubmitJournal(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/journal/{id}/submit", { params: { path: { id: entryId } } })),
    onSuccess: async (entry) => {
      queryClient.setQueryData(invoiceKeys.journal(entryId), entry);
      toast.success(i18n.t("invoices.journal.submitted"));
    },
    onError: () => {
      toast.error(i18n.t("invoices.actionFailed"));
    },
  });
}
