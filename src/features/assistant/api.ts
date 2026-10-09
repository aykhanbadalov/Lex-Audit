import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";

export type Conversation = components["schemas"]["Conversation"];
export type ConversationDetail = components["schemas"]["ConversationDetail"];
export type Attachment = components["schemas"]["ContextAttachment"];

export const MAX_MESSAGE_LENGTH = 4000;

export const assistantKeys = {
  list: ["conversations", "list"] as const,
  detail: (id: string) => ["conversations", "detail", id] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: assistantKeys.list,
    queryFn: async ({ signal }) => unwrap(await api.GET("/conversations", { signal })),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: assistantKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/conversations/{id}", { signal, params: { path: { id } } })),
    retry: false,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/conversations", { body: {} })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assistantKeys.list }),
    onError: () => {
      toast.error(i18n.t("assistant.createFailed"));
    },
  });
}

export function useUpdateConversation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title?: string; archived?: boolean }) =>
      unwrap(await api.PATCH("/conversations/{id}", { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    onError: () => {
      toast.error(i18n.t("assistant.updateFailed"));
    },
  });
}

export function useSendFeedback(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { messageId: string; rating: "up" | "down"; correction?: string }) => {
      await api.POST("/messages/{id}/feedback", {
        params: { path: { id: vars.messageId } },
        body: { rating: vars.rating, correction: vars.correction || undefined },
      });
    },
    onSuccess: () => {
      toast.success(i18n.t("assistant.feedback.thanks"));
      return queryClient.invalidateQueries({ queryKey: assistantKeys.detail(conversationId) });
    },
    onError: () => {
      toast.error(i18n.t("assistant.feedback.failed"));
    },
  });
}
