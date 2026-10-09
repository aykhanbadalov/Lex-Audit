import { Link } from "@tanstack/react-router";
import { Check, Loader2, ShieldAlert, Wrench, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import type { ToolStatus } from "../chatReducer";
import { describeSummary } from "../toolSummary";

const TONE: Record<ToolStatus, BadgeTone> = {
  running: "info",
  succeeded: "success",
  rejected: "danger",
  approval_required: "warning",
  failed: "danger",
};

interface ToolCardProps {
  tool: string;
  /** Not known for a tool listed from a stored message: only its name is kept there. */
  status?: ToolStatus;
  summary?: string | null;
  approvalId?: string | null;
}

/** One tool the assistant used. A tool that changes something stops at an approval, which another person must give. */
export function ToolCard({ tool, status, summary, approvalId }: ToolCardProps) {
  const { t } = useTranslation();
  const Icon =
    status === "running"
      ? Loader2
      : status === "succeeded"
        ? Check
        : status === "approval_required"
          ? ShieldAlert
          : status
            ? X
            : Wrench;
  return (
    <li className="space-y-1 rounded-lg border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Icon
          className={`size-4 text-muted-foreground ${status === "running" ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        <span className="font-medium">{t(`assistant.tool.${tool.replaceAll(".", "_")}`, { defaultValue: tool })}</span>
        {status ? <Badge tone={TONE[status]}>{t(`assistant.toolStatus.${status}`)}</Badge> : null}
      </div>
      {summary ? <p className="text-xs text-muted-foreground">{describeSummary(summary, t)}</p> : null}
      {status === "approval_required" ? (
        <p className="flex flex-wrap items-center gap-2 text-xs">
          {t("assistant.approvalNote")}
          {approvalId ? (
            <Link
              to="/approvals"
              search={{ status: "pending" }}
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("assistant.openApprovals")}
            </Link>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}
