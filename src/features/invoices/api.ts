import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Body, Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { ledgerKeys } from "@/features/ledger/api";
import type { InvoicesSearch } from "./filters";

export type InvoicePage = Json<"/invoices">;
export type Invoice = Item<InvoicePage>;
export type InvoiceDetail = Json<"/invoices/{id}">;
export type InvoiceLine = Item<InvoiceDetail["lines"]>;
export type InvoiceIssue = Item<InvoiceDetail["issues"]>;
export type InvoiceUpdate = Body<"/invoices/{id}", "patch">;
export type JournalProposalResult = Json<"/invoices/{id}/propose-entries", "post">;

/** How many invoices one page holds. Tests change it to exercise paging with a small sample. */
export const invoiceListConfig = { pageSize: 10 };

/**
 * An uploaded document becomes an invoice a little later, when the backend has read it. For a short while after an
 * upload the list refreshes on its own so the new invoice appears without a reload. Tests shorten the interval.
 */
export const invoicePollConfig = { intervalMs: 3000, windowMs: 30_000 };
const lastUpload = { at: 0 };
export function markInvoiceUploaded(): void {
  lastUpload.at = Date.now();
}

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: ["invoices", "list"] as const,
  list: (filters: InvoicesSearch) => ["invoices", "list", filters] as const,
  detail: (id: string) => ["invoices", "detail", id] as const,
  source: (id: string) => ["invoices", "source", id] as const,
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
              status: filters.status,
              direction: filters.direction,
              from: filters.from,
              to: filters.to,
              cursor: pageParam,
              limit: invoiceListConfig.pageSize,
            },
          },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    refetchInterval: () =>
      Date.now() - lastUpload.at < invoicePollConfig.windowMs ? invoicePollConfig.intervalMs : false,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/invoices/{id}", { signal, params: { path: { id } } })),
    retry: false,
  });
}

/** The original document. An <img>/<iframe> cannot send the bearer token, so it is fetched and shown from memory. */
export function useInvoiceSource(id: string, enabled: boolean) {
  return useQuery({
    queryKey: invoiceKeys.source(id),
    queryFn: async ({ signal }) => {
      const { data } = await api.GET("/invoices/{id}/source", { signal, params: { path: { id } }, parseAs: "blob" });
      if (!data) throw new Error("Empty document");
      return data as Blob;
    },
    enabled,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

function useStoreDetail(id: string) {
  const queryClient = useQueryClient();
  return (detail: InvoiceDetail) => {
    queryClient.setQueryData(invoiceKeys.detail(id), detail);
    return queryClient.invalidateQueries({ queryKey: invoiceKeys.lists });
  };
}

/**
 * Saving a correction makes the backend forget that the invoice was checked, so the check is run again straight away:
 * what the person sees afterwards is the verdict on what they just saved.
 */
export function useSaveInvoice(id: string) {
  const store = useStoreDetail(id);
  return useMutation({
    mutationFn: async (body: InvoiceUpdate) => {
      await unwrap(await api.PATCH("/invoices/{id}", { params: { path: { id } }, body }));
      return unwrap(await api.POST("/invoices/{id}/validate", { params: { path: { id } } }));
    },
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
    mutationFn: async () =>
      unwrap(await api.POST("/invoices/{id}/propose-entries", { params: { path: { id } }, body: {} })),
    onSuccess: async (entry) => {
      await queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
      toast.success(i18n.t("invoices.journal.proposed"));
      return entry;
    },
    onError: () => {
      toast.error(i18n.t("invoices.actionFailed"));
    },
  });
}
