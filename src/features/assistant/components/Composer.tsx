import { Send, Square, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { MAX_MESSAGE_LENGTH, type Attachment } from "../api";

interface ComposerProps {
  streaming: boolean;
  disabled?: boolean;
  attachments: Attachment[];
  onRemoveAttachment: (attachment: Attachment) => void;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function Composer({ streaming, disabled, attachments, onRemoveAttachment, onSend, onStop }: ComposerProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH && !streaming && !disabled;

  function submit() {
    if (!canSend) return;
    onSend(trimmed);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter writes a new line. Enter while an input method is composing a character is not a send.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {attachments.length > 0 ? (
        <ul aria-label={t("assistant.context.title")} className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <li key={`${attachment.type}-${attachment.id}`}>
              <Badge tone="info" className="gap-1">
                {t(`assistant.context.${attachment.type}`)}: {attachment.title}
                <button
                  type="button"
                  aria-label={t("assistant.context.remove", { title: attachment.title })}
                  className="ml-1 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => onRemoveAttachment(attachment)}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor="assistant-message" className="sr-only">
          {t("assistant.messageLabel")}
        </label>
        <textarea
          id="assistant-message"
          value={text}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          placeholder={t("assistant.placeholder")}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-48 min-h-12 flex-1 resize-y rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        />
        {streaming ? (
          <Button type="button" variant="outline" onClick={onStop}>
            <Square className="size-4" aria-hidden="true" />
            {t("assistant.stop")}
          </Button>
        ) : (
          <Button type="submit" disabled={!canSend}>
            <Send className="size-4" aria-hidden="true" />
            {t("assistant.send")}
          </Button>
        )}
      </div>
      {text.length > MAX_MESSAGE_LENGTH - 500 ? (
        <p className="text-xs text-muted-foreground">
          {text.length} / {MAX_MESSAGE_LENGTH}
        </p>
      ) : null}
    </form>
  );
}
