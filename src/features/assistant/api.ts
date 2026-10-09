import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Body, Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";

export type Conversation = Item<Json<"/conversations">>;
export type ConversationDetail = Json<"/conversations/{id}">;
export type StoredMessage = Item<ConversationDetail["messages"]>;
export type FeedbackBody = Body<"/messages/{id}/feedback">;

export const MAX_MESSAGE_LENGTH = 4000;

export const assistantKeys = {
  list: ["conversations", "list"] as const,
  detail: (id: string) => ["conversations", "detail", id] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: assistantKeys.list,
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/conversations", { signal, params: { query: { limit: 50 } } })),
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

/** A rating, or the right answer. Both are kept with the answer they are about: this is what the model learns from. */
export function useSendFeedback() {
  return useMutation({
    mutationFn: async (vars: { messageId: string; body: FeedbackBody }) =>
      unwrap(await api.POST("/messages/{id}/feedback", { params: { path: { id: vars.messageId } }, body: vars.body })),
    onSuccess: () => {
      toast.success(i18n.t("assistant.feedback.thanks"));
    },
    onError: () => {
      toast.error(i18n.t("assistant.feedback.failed"));
    },
  });
}
