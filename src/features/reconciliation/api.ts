import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { polling } from "@/shared/api/polling";
import { extensionOf } from "@/shared/upload/limits";

export type Reconciliation = components["schemas"]["Reconciliation"];
export type ReconciliationRow = components["schemas"]["ReconciliationRow"];
export type RowStatus = components["schemas"]["ReconciliationRowStatus"];
export type Kind = components["schemas"]["ReconciliationKind"];

export const KINDS = ["bank_ledger", "invoices_etaxes"] as const satisfies readonly Kind[];
export const ROW_STATUSES = ["confirmed", "suggested", "unmatched", "rejected"] as const satisfies readonly RowStatus[];
export const PAGE_SIZE = 10;

export const reconKeys = {
  all: ["reconciliation"] as const,
  list: ["reconciliation", "list"] as const,
  detail: (id: string) => ["reconciliation", "detail", id] as const,
  rows: (id: string, status: RowStatus | undefined) => ["reconciliation", "rows", id, status] as const,
  files: ["reconciliation", "ready-files"] as const,
};

export function useReconciliations() {
  return useQuery({
    queryKey: reconKeys.list,
    queryFn: async ({ signal }) => unwrap(await api.GET("/reconciliations", { signal })),
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.status === "running") ? polling.intervalMs : false,
  });
}

export function useReconciliation(id: string) {
  return useQuery({
    queryKey: reconKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/reconciliations/{id}", { signal, params: { path: { id } } })),
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === "running" ? polling.intervalMs : false),
  });
}

export function useReconciliationRows(id: string, status: RowStatus | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: reconKeys.rows(id, status),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.GET("/reconciliations/{id}/rows", {
          signal,
          params: { path: { id }, query: { status, cursor: pageParam, limit: PAGE_SIZE } },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

/** Only files that have finished processing can be compared; anything else would silently compare nothing. */
export function useReadyStatementFiles() {
  return useQuery({
    queryKey: reconKeys.files,
    queryFn: async ({ signal }) => {
      const page = unwrap(await api.GET("/files", { signal, params: { query: { status: "ready", limit: 100 } } }));
      return page.items.filter((file) => ["csv", "xlsx", "xls", "xml"].includes(extensionOf(file.name)));
    },
  });
}

export function useCreateReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["ReconciliationRequest"]) =>
      unwrap(await api.POST("/reconciliations", { body })),
    onSuccess: () => {
      toast.success(i18n.t("reconciliation.created"));
      return queryClient.invalidateQueries({ queryKey: reconKeys.list });
    },
    onError: () => {
      toast.error(i18n.t("reconciliation.createFailed"));
    },
  });
}

export function useDecideRow(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rowId, decision }: { rowId: string; decision: "confirm" | "reject" }) =>
      decision === "confirm"
        ? unwrap(await api.POST("/reconciliations/{id}/rows/{rowId}/confirm", { params: { path: { id, rowId } } }))
        : unwrap(await api.POST("/reconciliations/{id}/rows/{rowId}/reject", { params: { path: { id, rowId } } })),
    // The server recomputes the summary, so the counts are read again instead of adjusted here.
    onSettled: () => queryClient.invalidateQueries({ queryKey: reconKeys.all }),
    onError: () => {
      toast.error(i18n.t("reconciliation.decideFailed"));
    },
  });
}
