import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Body, Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { saveBlob } from "@/shared/lib/download";

export type VatPeriod = Item<Json<"/vat/periods">>;
export type VatSummary = Json<"/vat/periods/{p}/summary">;
export type VatDraft = Json<"/vat/periods/{p}/draft-return", "post">;
export type DepositStatement = Body<"/vat/deposit-statements">;
export type DepositLine = Item<DepositStatement["lines"]>;

export const vatKeys = {
  periods: ["vat", "periods"] as const,
  summary: (period: string) => ["vat", "summary", period] as const,
};

export function useVatPeriods() {
  return useQuery({
    queryKey: vatKeys.periods,
    queryFn: async ({ signal }) => unwrap(await api.GET("/vat/periods", { signal })),
    staleTime: 60_000,
  });
}

/** Totals come from the backend's accounting engine only. Anything it could not calculate is listed, never guessed. */
export function useVatSummary(period: string) {
  return useQuery({
    queryKey: vatKeys.summary(period),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/vat/periods/{p}/summary", { signal, params: { path: { p: period } } })),
    retry: false,
  });
}

/** Creates a new version of the draft. The draft is a file; nothing is filed and no invoice changes. */
export function useCreateVatDraft(period: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.POST("/vat/periods/{p}/draft-return", { params: { path: { p: period } } })),
    onSuccess: async () => {
      toast.success(i18n.t("vat.return.created"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: vatKeys.periods }),
        queryClient.invalidateQueries({ queryKey: ["files"] }),
      ]);
    },
    onError: () => {
      toast.error(i18n.t("vat.return.failed"));
    },
  });
}

/** Imports the rows of a VAT deposit account statement for a period. */
export function useImportDeposit(period: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lines: DepositLine[]) =>
      unwrap(await api.POST("/vat/deposit-statements", { body: { period, lines } })),
    onSuccess: async (result) => {
      toast.success(i18n.t("vat.deposit.imported", { count: result.lines }));
      await queryClient.invalidateQueries({ queryKey: vatKeys.summary(period) });
    },
    onError: () => {
      toast.error(i18n.t("vat.deposit.failed"));
    },
  });
}

/** The draft is stored as a file; an <a href> cannot send the bearer token, so it is fetched and saved from memory. */
export async function downloadDraft(fileId: string, period: string, version: number): Promise<void> {
  const { data } = await api.GET("/files/{id}/content", { params: { path: { id: fileId } }, parseAs: "blob" });
  if (!data) throw new Error("Empty download");
  saveBlob(data as Blob, `vat-draft-${period}-v${version}.csv`);
}
