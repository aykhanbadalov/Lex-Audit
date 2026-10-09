import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { useSendFeedback } from "../api";
import type { Message } from "../chatReducer";

/** A rating, and for a thumbs-down the right answer: this is what the model is later improved with. */
export function FeedbackBar({ message, conversationId }: { message: Message; conversationId: string }) {
  const { t } = useTranslation();
  const send = useSendFeedback(conversationId);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");

  return (
    <div className="mt-2 flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={message.feedback === "up"}
        aria-label={t("assistant.feedback.up")}
        disabled={send.isPending}
        onClick={() => send.mutate({ messageId: message.id, rating: "up" })}
      >
        <ThumbsUp className={message.feedback === "up" ? "size-4 fill-current" : "size-4"} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={message.feedback === "down"}
        aria-label={t("assistant.feedback.down")}
        disabled={send.isPending}
        onClick={() => setCorrecting(true)}
      >
        <ThumbsDown className={message.feedback === "down" ? "size-4 fill-current" : "size-4"} aria-hidden="true" />
      </Button>
      <Dialog open={correcting} onOpenChange={setCorrecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assistant.feedback.title")}</DialogTitle>
            <DialogDescription>{t("assistant.feedback.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="correction">{t("assistant.feedback.correction")}</Label>
            <textarea
              id="correction"
              value={correction}
              maxLength={2000}
              rows={4}
              onChange={(event) => setCorrection(event.target.value)}
              className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCorrecting(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={send.isPending}
              onClick={() =>
                send.mutate(
                  { messageId: message.id, rating: "down", correction: correction.trim() },
                  {
                    onSuccess: () => {
                      setCorrecting(false);
                      setCorrection("");
                    },
                  },
                )
              }
            >
              {t("assistant.feedback.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
