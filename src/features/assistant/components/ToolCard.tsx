import { ShieldAlert, Wrench } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePermission } from "@/shared/hooks/usePermission";
import { useAuthStore } from "@/shared/stores/authStore";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useDecideApproval } from "../api";
import type { Approval, ToolRun } from "../chatReducer";

const TONE: Record<ToolRun["status"], BadgeTone> = {
  proposed: "neutral",
  approval_required: "warning",
  running: "info",
  done: "success",
  failed: "danger",
  denied: "danger",
};

interface ToolCardProps {
  toolRun: ToolRun;
  approval: Approval | undefined;
  conversationId: string;
}

export function ToolCard({ toolRun, approval, conversationId }: ToolCardProps) {
  const { t } = useTranslation();
  return (
    <li className="space-y-2 rounded-lg border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Wrench className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">
          {t(`assistant.tool.${toolRun.toolName}`, { defaultValue: toolRun.toolName })}
        </span>
        <Badge tone={TONE[toolRun.status]}>{t(`assistant.toolStatus.${toolRun.status}`)}</Badge>
        {toolRun.riskLevel !== "read" ? <Badge tone="outline">{t(`assistant.risk.${toolRun.riskLevel}`)}</Badge> : null}
      </div>
      <p className="text-xs text-muted-foreground">{toolRun.argumentsSummary}</p>
      {toolRun.resultSummary ? <p className="text-xs">{toolRun.resultSummary}</p> : null}
      {approval ? <ApprovalSection approval={approval} conversationId={conversationId} /> : null}
    </li>
  );
}

/**
 * A write the assistant wants to make. It does nothing until a person other than the requester approves.
 * The buttons are hidden for the requester and for people without the permission; the server checks both again.
 */
function ApprovalSection({ approval, conversationId }: { approval: Approval; conversationId: string }) {
  const { t } = useTranslation();
  const canDecide = usePermission("approvals:decide");
  const me = useAuthStore((state) => state.user?.id);
  const decide = useDecideApproval(conversationId);
  const [comment, setComment] = useState("");

  if (approval.status !== "pending") {
    return (
      <p className="text-xs text-muted-foreground">
        {t(`assistant.approval.${approval.status}`)}
        {approval.comment ? `: ${approval.comment}` : ""}
      </p>
    );
  }
  if (approval.requestedBy.id === me) {
    return (
      <p role="status" className="flex items-start gap-1.5 text-xs">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t("assistant.approval.waitingOther")}
      </p>
    );
  }
  if (!canDecide) {
    return <p className="text-xs text-muted-foreground">{t("assistant.approval.waiting")}</p>;
  }
  return (
    <div className="space-y-2 border-t pt-2">
      <p className="text-xs">
        {t("assistant.approval.request", { name: approval.requestedBy.name, target: approval.targetResource })}
      </p>
      <div className="space-y-1">
        <Label htmlFor={`comment-${approval.id}`} className="text-xs">
          {t("assistant.approval.comment")}
        </Label>
        <Input
          id={`comment-${approval.id}`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={500}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: approval.id, decision: "approved", comment })}
        >
          {t("assistant.approval.approve")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: approval.id, decision: "denied", comment })}
        >
          {t("assistant.approval.deny")}
        </Button>
      </div>
    </div>
  );
}
