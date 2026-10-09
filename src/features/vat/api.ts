import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { saveBlob } from "@/shared/lib/download";

export type VatPeriod = components["schemas"]["VatPeriod"];
export type VatSummary = components["schemas"]["VatSummary"];
export type DepositReconciliation = components["schemas"]["DepositReconciliation"];
export type DepositLine = components["schemas"]["DepositLine"];
export type VatReturnDraft = components["schemas"]["VatReturnDraft"];
export type ExportFormat = "pdf" | "xlsx" | "xml";

export const vatKeys = {
  periods: ["vat", "periods"] as const,
  summary: (id: string) => ["vat", "summary", id] as const,
  deposit: (id: string) => ["vat", "deposit", id] as const,
  draft: (id: string) => ["vat", "draft", id] as const,
};

export function useVatPeriods() {
  return useQuery({
    queryKey: vatKeys.periods,
    queryFn: async ({ signal }) => unwrap(await api.GET("/vat/periods", { signal })),
    staleTime: 5 * 60_000,
  });
}

export function useVatSummary(periodId: string) {
  return useQuery({
    queryKey: vatKeys.summary(periodId),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/vat/periods/{periodId}/summary", { signal, params: { path: { periodId } } })),
    retry: false,
  });
}

export function useVatDeposit(periodId: string) {
  return useQuery({
    queryKey: vatKeys.deposit(periodId),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/vat/periods/{periodId}/deposit", { signal, params: { path: { periodId } } })),
    retry: false,
  });
}

/** "No draft yet" is an ordinary state, not an error: the server's 404 becomes null. */
export function useVatDraft(periodId: string) {
  return useQuery({
    queryKey: vatKeys.draft(periodId),
    queryFn: async ({ signal }): Promise<VatReturnDraft | null> => {
      try {
        return unwrap(
          await api.GET("/vat/periods/{periodId}/draft-return", { signal, params: { path: { periodId } } }),
        );
      } catch (error) {
        if (error instanceof ApiError && error.code === "NOT_FOUND") return null;
        throw error;
      }
    },
    retry: false,
  });
}

export function useMatchDepositLine(periodId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { lineId: string; invoiceId: string }) =>
      unwrap(
        await api.POST("/vat/deposit-lines/{lineId}/match", {
          params: { path: { lineId: vars.lineId } },
          body: { invoiceId: vars.invoiceId },
        }),
      ),
    onSuccess: (reconciliation) => {
      queryClient.setQueryData(vatKeys.deposit(periodId), reconciliation);
      toast.success(i18n.t("vat.deposit.matched"));
    },
    onError: () => {
      toast.error(i18n.t("vat.deposit.failed"));
    },
  });
}

export function useCreateVatDraft(periodId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.POST("/vat/periods/{periodId}/draft-return", { params: { path: { periodId } } })),
    onSuccess: (draft) => {
      queryClient.setQueryData(vatKeys.draft(periodId), draft);
      toast.success(i18n.t("vat.return.created"));
    },
    onError: () => {
      toast.error(i18n.t("vat.return.failed"));
    },
  });
}

export async function exportVatDraft(periodId: string, format: ExportFormat): Promise<void> {
  const { data } = await api.GET("/vat/periods/{periodId}/draft-return/export", {
    params: { path: { periodId }, query: { format } },
    parseAs: "blob",
  });
  if (!data) throw new Error("Empty export");
  saveBlob(data, `vat-draft-${periodId}.${format}`);
}
