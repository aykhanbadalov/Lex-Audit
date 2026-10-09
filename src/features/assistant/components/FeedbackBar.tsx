import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { useSendFeedback } from "../api";

/**
 * A rating, and for a thumbs-down the right answer: this is what the model is later improved with.
 * The backend keeps feedback but does not send it back, so what was given is remembered here for the session.
 */
export function FeedbackBar({ messageId }: { messageId: string }) {
  const { t } = useTranslation();
  const send = useSendFeedback();
  const [given, setGiven] = useState<"up" | "down" | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");

  return (
    <div className="mt-2 flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={given === "up"}
        aria-label={t("assistant.feedback.up")}
        disabled={send.isPending || given !== null}
        onClick={() =>
          send.mutate({ messageId, body: { kind: "thumbs", value: "up" } }, { onSuccess: () => setGiven("up") })
        }
      >
        <ThumbsUp className={given === "up" ? "size-4 fill-current" : "size-4"} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={given === "down"}
        aria-label={t("assistant.feedback.down")}
        disabled={send.isPending || given !== null}
        onClick={() => setCorrecting(true)}
      >
        <ThumbsDown className={given === "down" ? "size-4 fill-current" : "size-4"} aria-hidden="true" />
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
              maxLength={4000}
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
              onClick={async () => {
                try {
                  // A thumbs-down is always recorded; the right answer, when given, is recorded with it.
                  await send.mutateAsync({ messageId, body: { kind: "thumbs", value: "down" } });
                  if (correction.trim()) {
                    await send.mutateAsync({ messageId, body: { kind: "correction", correction: correction.trim() } });
                  }
                  setGiven("down");
                  setCorrecting(false);
                  setCorrection("");
                } catch {
                  // The hook already told the person; the dialog stays open so nothing typed is lost.
                }
              }}
            >
              {t("assistant.feedback.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
