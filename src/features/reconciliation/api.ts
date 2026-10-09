import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Body, Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";

export type ReconciliationRequest = Body<"/reconciliations">;
export type SourceSpec = ReconciliationRequest["left"];
export type Reconciliation = Json<"/reconciliations/{id}">;
export type Match = Item<Reconciliation["matches"]>;

export const reconKeys = { detail: (id: string) => ["reconciliations", id] as const };

export function useStartReconciliation() {
  return useMutation({
    mutationFn: async (body: ReconciliationRequest) => unwrap(await api.POST("/reconciliations", { body })),
    onError: () => {
      toast.error(i18n.t("reconciliation.failed"));
    },
  });
}

export function useReconciliation(id: string) {
  return useQuery({
    queryKey: reconKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/reconciliations/{id}", { signal, params: { path: { id } } })),
    retry: false,
  });
}

/** The matches are suggestions. A person confirms each one; the backend allows it once. */
export function useConfirmMatch(reconId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) =>
      unwrap(
        await api.POST("/reconciliations/{id}/matches/{m}/confirm", { params: { path: { id: reconId, m: matchId } } }),
      ),
    onSuccess: async () => {
      toast.success(i18n.t("reconciliation.confirmed"));
      await queryClient.invalidateQueries({ queryKey: reconKeys.detail(reconId) });
    },
    onError: () => {
      toast.error(i18n.t("reconciliation.confirmFailed"));
    },
  });
}

export interface ReconRef {
  ref: string;
  key: string;
  amount: string;
  date: string | null;
}

/** A side of a match is free-form JSON on the wire; only a well-formed one is shown. */
export function readRef(value: unknown): ReconRef | null {
  if (typeof value !== "object" || value === null) return null;
  const { ref, key, amount, date } = value as Record<string, unknown>;
  return typeof amount === "string" && /^-?\d+(\.\d+)?$/.test(amount)
    ? { ref: String(ref ?? ""), key: String(key ?? ""), amount, date: typeof date === "string" ? date : null }
    : null;
}

export interface ReconSummary {
  exact: number;
  amountMismatch: number;
  amountDate: number;
  unmatchedLeft: number;
  unmatchedRight: number;
  skipped: number;
  leftTotal: string;
  rightTotal: string;
}

export function readSummary(value: unknown): ReconSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === "number" ? x : 0);
  const money = (x: unknown) => (typeof x === "string" && /^-?\d+(\.\d+)?$/.test(x) ? x : "0.00");
  return {
    exact: n(v.exact),
    amountMismatch: n(v.amountMismatch),
    amountDate: n(v.amountDate),
    unmatchedLeft: n(v.unmatchedLeft),
    unmatchedRight: n(v.unmatchedRight),
    skipped: n(v.skipped),
    leftTotal: money(v.leftTotal),
    rightTotal: money(v.rightTotal),
  };
}
