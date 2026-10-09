import { Bot, TriangleAlert, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { SafeMarkdown } from "../SafeMarkdown";
import type { Citation, ToolCall, TurnError, TurnStatus } from "../chatReducer";
import { CitationList } from "./CitationList";
import { FeedbackBar } from "./FeedbackBar";
import { ToolCard } from "./ToolCard";

export interface DisplayMessage {
  /** The stored id; null while the answer is only being written locally. */
  id: string | null;
  role: "user" | "assistant";
  content: string;
  status: TurnStatus;
  citations: Citation[];
  /** Live tools carry a status; tools of a stored message only have names. */
  tools: Pick<ToolCall, "tool">[] | ToolCall[];
  modelVersion: string | null;
  error: TurnError | null;
  live: boolean;
}

interface MessageViewProps {
  message: DisplayMessage;
  /** Offered on an answer that failed: ask the same question again. */
  onRetry?: () => void;
}

const isLiveTool = (tool: Pick<ToolCall, "tool"> | ToolCall): tool is ToolCall => "callId" in tool;

export function MessageView({ message, onRetry }: MessageViewProps) {
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
        {message.status === "complete" && message.error?.code === "STEP_LIMIT" ? (
          <p className="mt-1 text-xs text-muted-foreground">{t("assistant.stepLimit")}</p>
        ) : null}
        {message.status === "failed" ? (
          <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <TriangleAlert className="size-4 text-destructive" aria-hidden="true" />
            <span>
              {t(`assistant.errors.${message.error?.code ?? "INTERNAL"}`, { defaultValue: t("assistant.failed") })}
            </span>
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                {t("assistant.retry")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {message.tools.length > 0 ? (
          <ul aria-label={t("assistant.tools")} className="mt-3 space-y-2">
            {message.tools.map((tool, index) =>
              isLiveTool(tool) ? (
                <ToolCard
                  key={tool.callId}
                  tool={tool.tool}
                  status={tool.status}
                  summary={tool.summary}
                  approvalId={tool.approvalId}
                />
              ) : (
                <ToolCard key={`${tool.tool}-${index}`} tool={tool.tool} />
              ),
            )}
          </ul>
        ) : null}
        <CitationList citations={message.citations} />
        {assistant && message.status === "complete" && !message.live && message.id ? (
          <FeedbackBar messageId={message.id} />
        ) : null}
      </div>
    </li>
  );
}
