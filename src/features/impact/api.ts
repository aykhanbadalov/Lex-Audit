import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { usePermission } from "@/shared/hooks/usePermission";

export type ImpactFinding = Item<Json<"/impact-findings">>;
export type ImpactStatus = ImpactFinding["status"];

export const impactKeys = {
  all: ["impact"] as const,
  list: (status?: ImpactStatus) => ["impact", "list", status] as const,
};

/** What a news item or a law change may mean for this company's own files. Needs `impact:read`. */
export function useImpactFindings(status?: ImpactStatus) {
  const allowed = usePermission("impact:read");
  return useQuery({
    queryKey: impactKeys.list(status),
    enabled: allowed,
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/impact-findings", { signal, params: { query: { status, limit: 100 } } })),
  });
}

export function useSetImpactStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; status: "seen" | "dismissed" | "actioned" }) =>
      unwrap(
        await api.PUT("/impact-findings/{id}/status", {
          params: { path: { id: vars.id } },
          body: { status: vars.status },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: impactKeys.all }),
    onError: () => {
      toast.error(i18n.t("impact.failed"));
    },
  });
}

/** The backend sends the score as a decimal string between 0 and 1. */
export function scorePercent(score: string): number {
  const value = Number(score);
  return Number.isFinite(value) ? Math.round(Math.min(Math.max(value, 0), 1) * 100) : 0;
}
