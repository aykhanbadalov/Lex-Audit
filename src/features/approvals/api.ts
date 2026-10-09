import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";

export type Approval = Item<Json<"/approvals">>;
export type Execution = NonNullable<Approval["execution"]>;

export const MIN_COMMENT_LENGTH = 3;

export const approvalKeys = { all: ["approvals"] as const, list: ["approvals", "list"] as const };

/** Every request of the company, newest first. The backend sends one plain list, so filtering happens here. */
export function useApprovals() {
  return useQuery({
    queryKey: approvalKeys.list,
    queryFn: async ({ signal }) => unwrap(await api.GET("/approvals", { signal })),
  });
}

/**
 * One decision. The backend allows an empty comment; this screen asks for a few words anyway, because the decision is
 * recorded under the person's name. The backend refuses the requester (403) and a request that was decided (409).
 */
export function useDecide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; decision: "approve" | "reject"; comment: string }) =>
      unwrap(
        await api.POST("/approvals/{id}/decide", {
          params: { path: { id: vars.id } },
          body: { decision: vars.decision, comment: vars.comment.trim() },
        }),
      ),
    onSuccess: async (approval) => {
      toast.success(i18n.t("approvals.decided"));
      if (approval.execution?.status === "failed") toast.error(approval.execution.message);
      // A decision can post an entry, activate a rate or run an assistant's action, and it lands in the audit log.
      await Promise.all(
        [["approvals"], ["journal"], ["conversations"], ["tax-rates"], ["imports"], ["audit"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
    onError: () => {
      toast.error(i18n.t("approvals.decideFailed"));
    },
  });
}

/** `tool:legislation.search` → "legislation.search"; the other kinds are known names. */
export function kindParts(kind: string): { base: string; detail: string | null } {
  return kind.startsWith("tool:") ? { base: "tool", detail: kind.slice(5) } : { base: kind, detail: null };
}
