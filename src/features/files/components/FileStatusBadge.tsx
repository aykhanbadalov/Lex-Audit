import { CheckCircle2, CircleAlert, Clock, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import type { FileStatus } from "../filters";

const TONE: Record<FileStatus, BadgeTone> = {
  pending: "neutral",
  extracting: "info",
  ready: "success",
  failed: "danger",
};

/** The state is spelled out in words and an icon, never colour alone. */
export function FileStatusBadge({ status: raw }: { status: FileStatus | null }) {
  const status = raw ?? "pending";
  const { t } = useTranslation();
  const icon =
    status === "ready" ? (
      <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
    ) : status === "failed" ? (
      <CircleAlert className="mr-1 size-3" aria-hidden="true" />
    ) : status === "extracting" ? (
      <Loader2 className="mr-1 size-3 animate-spin" aria-hidden="true" />
    ) : (
      <Clock className="mr-1 size-3" aria-hidden="true" />
    );
  return (
    <Badge tone={TONE[status]}>
      {icon}
      {t(`files.status.${status}`)}
    </Badge>
  );
}
