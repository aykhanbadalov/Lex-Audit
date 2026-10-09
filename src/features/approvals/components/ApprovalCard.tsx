import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { useAuthStore } from "@/shared/stores/authStore";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { MIN_COMMENT_LENGTH, useDecide, type ApprovalRequest } from "../api";

const STATUS_TONE: Record<ApprovalRequest["status"], BadgeTone> = {
  pending: "warning",
  approved: "success",
  denied: "danger",
  expired: "neutral",
};

export function ApprovalCard({ item }: { item: ApprovalRequest }) {
  const { t, i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const titleId = `approval-${item.id}`;
  return (
    <article aria-labelledby={titleId} className="space-y-3 rounded-lg border bg-card p-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">{t(`approvals.kind.${item.kind}`)}</Badge>
          <Badge tone={STATUS_TONE[item.status]}>{t(`approvals.status.${item.status}`)}</Badge>
          {item.riskLevel !== "read" ? <Badge tone="outline">{t(`assistant.risk.${item.riskLevel}`)}</Badge> : null}
        </div>
        <h2 id={titleId} className="text-base font-semibold">
          {item.title}
        </h2>
        <p className="text-sm text-muted-foreground">{item.summary}</p>
        <p className="text-xs text-muted-foreground">
          {t("approvals.requestedBy", { name: item.requestedBy.name, date: formatDateTime(item.requestedAt, tag) })}
          {" · "}
          {t(item.status === "pending" ? "approvals.deadline" : "approvals.deadlineWas", {
            date: formatDateTime(item.expiresAt, tag),
          })}
        </p>
      </header>

      {item.changes.length > 0 ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{t("approvals.changes")}</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">
                {t("approvals.change.what")}
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                {t("approvals.change.before")}
              </th>
              <th scope="col" className="py-1 font-medium">
                {t("approvals.change.after")}
              </th>
            </tr>
          </thead>
          <tbody>
            {item.changes.map((change) => (
              <tr key={change.label} className="border-t">
                <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                  {change.label}
                </th>
                <td className="py-1.5 pr-3 text-muted-foreground">{change.before ?? t("approvals.change.none")}</td>
                <td className="py-1.5 font-medium">{change.after ?? t("approvals.change.none")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {item.source ? (
        <Link
          to="/assistant/$id"
          params={{ id: item.source.id }}
          className="inline-block text-sm text-primary hover:underline"
        >
          {t("approvals.openConversation")}
        </Link>
      ) : null}

      <Decision item={item} />
    </article>
  );
}

function Decision({ item }: { item: ApprovalRequest }) {
  const { t, i18n } = useTranslation();
  const me = useAuthStore((state) => state.user?.id);
  const decide = useDecide();
  const [comment, setComment] = useState("");

  if (item.status !== "pending") {
    if (!item.decidedBy) return null;
    return (
      <p className="border-t pt-3 text-sm text-muted-foreground">
        {t("approvals.decidedBy", {
          name: item.decidedBy.name,
          date: formatDateTime(item.decidedAt ?? item.requestedAt, localeTag(i18n.language)),
        })}
        {item.comment ? `: ${item.comment}` : ""}
      </p>
    );
  }
  if (item.requestedBy.id === me) {
    return (
      <p role="status" className="flex items-start gap-1.5 border-t pt-3 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("assistant.approval.waitingOther")}
      </p>
    );
  }
  if (!item.canDecide) {
    return <p className="border-t pt-3 text-sm text-muted-foreground">{t("assistant.approval.waiting")}</p>;
  }

  const ready = comment.trim().length >= MIN_COMMENT_LENGTH && !decide.isPending;
  return (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor={`comment-${item.id}`}>{t("approvals.commentRequired")}</Label>
      <textarea
        id={`comment-${item.id}`}
        value={comment}
        rows={2}
        maxLength={500}
        onChange={(event) => setComment(event.target.value)}
        className="min-h-12 w-full resize-y rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!ready}
          onClick={() => decide.mutate({ id: item.id, decision: "approved", comment })}
        >
          {t("assistant.approval.approve")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!ready}
          onClick={() => decide.mutate({ id: item.id, decision: "denied", comment })}
        >
          {t("assistant.approval.deny")}
        </Button>
      </div>
    </div>
  );
}
