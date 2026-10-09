import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCreateConversation } from "@/features/assistant/api";
import { Composer } from "@/features/assistant/components/Composer";
import { assistantSearchSchema, contextFromSearch } from "@/features/assistant/context";
import { EmptyState } from "@/shared/components/EmptyState";

export const Route = createFileRoute("/_app/assistant/")({
  validateSearch: assistantSearchSchema,
  component: NewConversation,
});

/** No conversation yet: the first message creates one, then the chat page sends it. */
function NewConversation() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const create = useCreateConversation();
  const [attachments, setAttachments] = useState(() => contextFromSearch(search));

  return (
    <div className="space-y-6">
      <EmptyState icon={Bot} title={t("assistant.emptyTitle")} description={t("assistant.emptyHint")} />
      <Composer
        streaming={false}
        disabled={create.isPending}
        attachments={attachments}
        onRemoveAttachment={(target) => setAttachments((current) => current.filter((item) => item !== target))}
        onStop={() => undefined}
        onSend={(content) =>
          create.mutate(undefined, {
            onSuccess: (conversation) =>
              void navigate({
                to: "/assistant/$id",
                params: { id: conversation.id },
                search: {},
                state: { pendingChat: { content, attachments } },
              }),
          })
        }
      />
      <p className="text-xs text-muted-foreground">{t("ai.disclaimer")}</p>
    </div>
  );
}
