import { Send, Square } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { MAX_MESSAGE_LENGTH } from "../api";

interface ComposerProps {
  streaming: boolean;
  disabled?: boolean;
  /** Text the box starts with, for example a line that names the resource the question is about. */
  initialText?: string;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function Composer({ streaming, disabled, initialText = "", onSend, onStop }: ComposerProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
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
