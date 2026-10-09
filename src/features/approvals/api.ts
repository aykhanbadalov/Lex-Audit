import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import type { ApprovalsSearch } from "./filters";

export type ApprovalRequest = components["schemas"]["ApprovalRequest"];

export const MIN_COMMENT_LENGTH = 3;
export const PAGE_SIZE = 10;

export const approvalKeys = {
  all: ["approvals"] as const,
  list: (filters: ApprovalsSearch) => ["approvals", "list", filters] as const,
};

export function useApprovals(filters: ApprovalsSearch) {
  return useInfiniteQuery({
    queryKey: approvalKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.GET("/approvals", {
          signal,
          params: {
            query: {
              status: filters.status === "all" ? undefined : filters.status,
              kind: filters.kind,
              cursor: pageParam,
              limit: PAGE_SIZE,
            },
          },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/** One decision. The comment is required for both outcomes; the server checks it and the requester rule again. */
export function useDecide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; decision: "approved" | "denied"; comment: string }) =>
      unwrap(
        await api.POST("/approvals/{id}/decide", {
          params: { path: { id: vars.id } },
          body: { decision: vars.decision, comment: vars.comment.trim() },
        }),
      ),
    onSuccess: async () => {
      toast.success(i18n.t("approvals.decided"));
      // The chat shows the same approvals, and a decision also lands in the audit log.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: approvalKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["audit"] }),
      ]);
    },
    onError: () => {
      toast.error(i18n.t("approvals.decideFailed"));
    },
  });
}
