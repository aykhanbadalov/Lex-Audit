import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";

export const MIN_REASON_LENGTH = 3;

interface RequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Extra fields shown above the reason. */
  children?: ReactNode;
  /** False while the extra fields are invalid. */
  valid?: boolean;
  busy?: boolean;
  onSubmit: (reason: string) => void;
}

/** Everything in the admin area that changes the system asks for a reason and then goes to approval. */
export function RequestDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  valid = true,
  busy,
  onSubmit,
}: RequestDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const ready = valid && reason.trim().length >= MIN_REASON_LENGTH && !busy;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) onSubmit(reason.trim());
          }}
        >
          {children}
          <div className="space-y-1.5">
            <Label htmlFor="request-reason">{t("admin.reason")}</Label>
            <textarea
              id="request-reason"
              value={reason}
              rows={3}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              className="w-full resize-y rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!ready}>
              {t("admin.sendForApproval")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
