import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { FileQuestion, Archive, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { useConversation, useUpdateConversation } from "@/features/assistant/api";
import { MessageView } from "@/features/assistant/components/MessageView";
import { fromLive, fromStored, type DisplayMessage } from "@/features/assistant/display";
import { Composer } from "@/features/assistant/components/Composer";
import { assistantSearchSchema, contextFromSearch } from "@/features/assistant/context";
import { useChat } from "@/features/assistant/useChat";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

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
  return <Chat key={id} id={id} title={conversation.data.title} stored={conversation.data.messages.map(fromStored)} />;
}

function Chat({ id, title, stored }: { id: string; title: string; stored: DisplayMessage[] }) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const pendingChat = useLocation({ select: (location) => location.state.pendingChat });
  const chat = useChat(id);
  const update = useUpdateConversation(id);
  const [attachments, setAttachments] = useState(() => contextFromSearch(search));
  const [renaming, setRenaming] = useState(false);
  const [title_, setTitle] = useState(title);
  const [archiving, setArchiving] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const sentFirst = useRef(false);

  // The first message typed on the "new conversation" screen is sent here, exactly once.
  useEffect(() => {
    if (pendingChat && !sentFirst.current) {
      sentFirst.current = true;
      void chat.send(pendingChat);
      void navigate({ to: "/assistant/$id", params: { id }, search: {}, state: {}, replace: true });
    }
  }, [pendingChat, chat, navigate, id]);

  const messages = useMemo<DisplayMessage[]>(() => {
    const list = [...stored];
    if (
      chat.pending &&
      !stored.some(
        (message) => message.role === "user" && message.content === chat.pending?.content && chat.live === null,
      )
    ) {
      list.push({
        id: null,
        role: "user",
        content: chat.pending.content,
        status: "complete",
        citations: [],
        toolRuns: [],
        approvals: [],
        modelVersion: null,
        feedback: null,
        live: true,
      });
    }
    if (chat.live) list.push(fromLive(chat.live));
    return list;
  }, [stored, chat.pending, chat.live]);

  // Keep the newest text in view, unless the reader has scrolled up to read something.
  useEffect(() => {
    const end = endRef.current;
    if (!end) return;
    const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
    if (nearBottom) end.scrollIntoView({ block: "end" });
  }, [messages.length, chat.live?.content]);

  const send = (content: string) => {
    void chat.send({ content, attachments });
    setAttachments([]);
  };
  const lastStored = stored[stored.length - 1];
  const lastQuestion = [...stored].reverse().find((message) => message.role === "user")?.content;
  const retryStored =
    lastStored?.role === "assistant" && lastStored.status === "failed" && lastQuestion
      ? () => send(lastQuestion)
      : undefined;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight break-words">{title}</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setTitle(title);
              setRenaming(true);
            }}
          >
            <Pencil className="size-4" aria-hidden="true" />
            {t("assistant.rename")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setArchiving(true)}>
            <Archive className="size-4" aria-hidden="true" />
            {t("assistant.archive")}
          </Button>
        </div>
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
                conversationId={id}
                onRetry={
                  message.live && message.status === "failed" && chat.pending
                    ? () => {
                        const request = chat.pending!;
                        chat.dismiss();
                        void chat.send(request);
                      }
                    : index === messages.length - 1
                      ? retryStored
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
          attachments={attachments}
          onRemoveAttachment={(target) => setAttachments((current) => current.filter((item) => item !== target))}
          onSend={send}
          onStop={chat.stop}
        />
        <p className="text-xs text-muted-foreground">{t("ai.disclaimer")}</p>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assistant.rename")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (title_.trim()) update.mutate({ title: title_.trim() }, { onSuccess: () => setRenaming(false) });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="conversation-title">{t("assistant.titleLabel")}</Label>
              <Input
                id="conversation-title"
                value={title_}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!title_.trim() || update.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={t("assistant.archiveConfirm.title")}
        description={t("assistant.archiveConfirm.description")}
        confirmLabel={t("assistant.archive")}
        busy={update.isPending}
        onConfirm={() =>
          update.mutate({ archived: true }, { onSuccess: () => void navigate({ to: "/assistant", search: {} }) })
        }
      />
    </div>
  );
}
