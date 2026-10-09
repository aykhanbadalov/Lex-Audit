import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { useConversation, type StoredMessage } from "@/features/assistant/api";
import { Composer } from "@/features/assistant/components/Composer";
import { MessageView, type DisplayMessage } from "@/features/assistant/components/MessageView";
import { assistantSearchSchema, contextFromSearch, draftFor } from "@/features/assistant/context";
import { fromLive, fromStored } from "@/features/assistant/display";
import { useChat } from "@/features/assistant/useChat";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

export const Route = createFileRoute("/_app/assistant/$id")({
  validateSearch: assistantSearchSchema,
  component: ChatPage,
});

function ChatPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const conversation = useConversation(id);

  if (conversation.isPending) return <LoadingState />;
  if (conversation.isError) {
    return conversation.error instanceof ApiError && conversation.error.code === "NOT_FOUND" ? (
      <EmptyState icon={FileQuestion} title={t("assistant.notFound")} description={t("assistant.notFoundHint")} />
    ) : (
      <ErrorState message={conversation.error.message} onRetry={() => void conversation.refetch()} />
    );
  }
  // Keyed by id so switching conversations never carries one chat's stream or draft into another.
  return <Chat key={id} id={id} title={conversation.data.title} stored={conversation.data.messages} />;
}

function Chat({ id, title, stored }: { id: string; title: string | null; stored: StoredMessage[] }) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const pendingChat = useLocation({ select: (location) => location.state.pendingChat });
  const chat = useChat(id);
  const endRef = useRef<HTMLDivElement>(null);
  const sentFirst = useRef(false);
  const resource = contextFromSearch(search);

  // The first message typed on the "new conversation" screen is sent here, exactly once.
  useEffect(() => {
    if (pendingChat && !sentFirst.current) {
      sentFirst.current = true;
      void chat.send(pendingChat);
      void navigate({ to: "/assistant/$id", params: { id }, search: {}, state: {}, replace: true });
    }
  }, [pendingChat, chat, navigate, id]);

  const messages = useMemo<DisplayMessage[]>(() => {
    const list = stored.map((message) => fromStored(message, chat.toolsByMessage[message.id]));
    // While the answer is being written the backend has already stored the question; show it once, from the store.
    const alreadyStored = list.some((message) => message.role === "user" && message.content === chat.pending);
    if (chat.pending && !alreadyStored) {
      list.push({
        id: null,
        role: "user",
        content: chat.pending,
        status: "complete",
        citations: [],
        tools: [],
        modelVersion: null,
        error: null,
        live: true,
      });
    }
    if (chat.live) list.push(fromLive(chat.live));
    return list;
  }, [stored, chat.pending, chat.live, chat.toolsByMessage]);

  // Keep the newest text in view, unless the reader has scrolled up to read something.
  useEffect(() => {
    const end = endRef.current;
    if (!end) return;
    const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
    if (nearBottom) end.scrollIntoView({ block: "end" });
  }, [messages.length, chat.live?.content]);

  const retryQuestion = chat.pending;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight break-words">{title || t("assistant.untitled")}</h2>
      </header>

      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("assistant.emptyHint")}</p>
      ) : (
        <div role="log" aria-label={t("assistant.messages")}>
          <ol className="space-y-6">
            {messages.map((message, index) => (
              <MessageView
                key={message.id ?? `local-${index}`}
                message={message}
                onRetry={
                  message.live && message.status === "failed" && retryQuestion
                    ? () => {
                        chat.dismiss();
                        void chat.send(retryQuestion);
                      }
                    : undefined
                }
              />
            ))}
          </ol>
        </div>
      )}
      <div ref={endRef} />

      <div className="sticky bottom-0 space-y-2 bg-background pt-2">
        <Composer
          streaming={chat.streaming}
          initialText={resource ? draftFor(resource, t(`assistant.context.${resource.type}`)) : ""}
          onSend={(content) => void chat.send(content)}
          onStop={chat.stop}
        />
        <p className="text-xs text-muted-foreground">{t("ai.disclaimer")}</p>
      </div>
    </div>
  );
}
