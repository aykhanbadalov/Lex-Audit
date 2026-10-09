import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import type { AuditSearch } from "./filters";

export type AuditEvent = components["schemas"]["AuditEvent"];

export const PAGE_SIZE = 20;

const toQuery = (filters: AuditSearch) => ({
  q: filters.q?.trim() || undefined,
  outcome: filters.outcome,
  from: filters.from,
  to: filters.to,
});

export function useAuditEvents(filters: AuditSearch) {
  return useInfiniteQuery({
    queryKey: ["audit", "list", filters],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.GET("/audit-events", {
          signal,
          params: { query: { ...toQuery(filters), cursor: pageParam, limit: PAGE_SIZE } },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/** Exports exactly what the filters show. The result is a file under Files. */
export function useExportAudit() {
  return useMutation({
    mutationFn: async (filters: AuditSearch) =>
      unwrap(await api.POST("/audit-events/export", { body: toQuery(filters) })),
    onError: () => {
      toast.error(i18n.t("audit.exportFailed"));
    },
  });
}
