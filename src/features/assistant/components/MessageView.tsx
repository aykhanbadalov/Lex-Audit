import { Bot, TriangleAlert, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { SafeMarkdown } from "../SafeMarkdown";
import type { DisplayMessage } from "../display";
import { CitationList } from "./CitationList";
import { FeedbackBar } from "./FeedbackBar";
import { ToolCard } from "./ToolCard";

interface MessageViewProps {
  message: DisplayMessage;
  conversationId: string;
  /** Offered on an answer that failed: ask the same question again. */
  onRetry?: () => void;
}

export function MessageView({ message, conversationId, onRetry }: MessageViewProps) {
  const { t } = useTranslation();
  const assistant = message.role === "assistant";
  const Icon = assistant ? Bot : User;

  return (
    <li className="flex gap-3">
      <span
        className={`mt-1 grid size-7 shrink-0 place-items-center rounded-full ${assistant ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {assistant ? t("assistant.roleAssistant") : t("assistant.roleUser")}
          {message.modelVersion ? <span className="font-normal"> · {message.modelVersion}</span> : null}
        </p>

        {assistant ? (
          message.content ? (
            <SafeMarkdown>{message.content}</SafeMarkdown>
          ) : message.status === "streaming" ? (
            <p className="text-sm text-muted-foreground">{t("assistant.thinking")}</p>
          ) : null
        ) : (
          // The user's own words are shown as plain text.
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}

        {message.status === "streaming" ? (
          <span role="status" className="sr-only">
            {t("assistant.writing")}
          </span>
        ) : null}
        {message.status === "stopped" ? (
          <p className="mt-1 text-xs text-muted-foreground">{t("assistant.stopped")}</p>
        ) : null}
        {message.status === "failed" ? (
          <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <TriangleAlert className="size-4 text-destructive" aria-hidden="true" />
            <span>{t("assistant.failed")}</span>
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                {t("assistant.retry")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {message.toolRuns.length > 0 ? (
          <ul aria-label={t("assistant.tools")} className="mt-3 space-y-2">
            {message.toolRuns.map((toolRun) => (
              <ToolCard
                key={toolRun.id}
                toolRun={toolRun}
                approval={message.approvals.find((approval) => approval.id === toolRun.approvalId)}
                conversationId={conversationId}
              />
            ))}
          </ul>
        ) : null}
        <CitationList citations={message.citations} />

        {assistant && !message.live && message.status === "complete" && message.id ? (
          <FeedbackBar
            message={{ ...message, id: message.id, createdAt: "", status: "complete" }}
            conversationId={conversationId}
          />
        ) : null}
      </div>
    </li>
  );
}
