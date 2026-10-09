import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useJournalEntry } from "@/features/ledger/api";
import { JournalEntryCard } from "@/features/ledger/components/JournalEntryCard";
import { usePeople } from "@/shared/api/people";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { useAuthStore } from "@/shared/stores/authStore";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { MIN_COMMENT_LENGTH, kindParts, useDecide, type Approval } from "../api";

const STATUS_TONE: Record<Approval["status"], BadgeTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  expired: "neutral",
};

export function ApprovalCard({ item }: { item: Approval }) {
  const { t, i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const person = usePeople();
  const { base, detail } = kindParts(item.kind);
  const titleId = `approval-${item.id}`;
  return (
    <article aria-labelledby={titleId} className="space-y-3 rounded-lg border bg-card p-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">{t(`approvals.kind.${base}`, { defaultValue: item.kind })}</Badge>
          <Badge tone={STATUS_TONE[item.status]}>{t(`approvals.status.${item.status}`)}</Badge>
        </div>
        <h2 id={titleId} className="text-base font-semibold">
          {t(`approvals.title.${base}`, { defaultValue: item.kind, detail })}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("approvals.requestedBy", { name: person(item.requesterId), date: formatDateTime(item.createdAt, tag) })}
          {" · "}
          {t(item.status === "pending" ? "approvals.deadline" : "approvals.deadlineWas", {
            date: formatDateTime(item.expiresAt, tag),
          })}
        </p>
      </header>

      <Subject item={item} />

      {item.execution ? (
        <p role="status" className="text-sm">
          {t(`approvals.execution.${item.execution.status}`)}
          {item.execution.message ? `: ${item.execution.message}` : ""}
        </p>
      ) : null}

      <Decision item={item} />
    </article>
  );
}

/** What the approval is about, shown so a person can see what they are agreeing to. */
function Subject({ item }: { item: Approval }) {
  const { t } = useTranslation();
  const canReadJournal = usePermission("journal:read");
  const entry = useJournalEntry(item.kind === "journal_post" && canReadJournal ? item.resourceRef : null);
  if (item.kind === "journal_post") {
    return entry.data ? (
      <div className="space-y-2">
        <p className="text-sm font-medium">{entry.data.description}</p>
        <JournalEntryCard entry={entry.data} canSubmit={false} showSourceLink />
        <Link
          to="/ledger/$id"
          params={{ id: item.resourceRef }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("approvals.openEntry")}
        </Link>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">{t("approvals.noAccessToSubject")}</p>
    );
  }
  if (item.kind === "tax_rate_proposal") {
    return (
      <Link to="/admin" search={{ tab: "rates" }} className="text-sm text-primary underline-offset-4 hover:underline">
        {t("approvals.openRates")}
      </Link>
    );
  }
  if (item.kind === "import_commit") {
    return (
      <Link
        to="/integrations/$id"
        params={{ id: item.resourceRef }}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {t("approvals.openImport")}
      </Link>
    );
  }
  return <p className="font-mono text-xs text-muted-foreground">{item.resourceRef}</p>;
}

function Decision({ item }: { item: Approval }) {
  const { t, i18n } = useTranslation();
  const me = useAuthStore((state) => state.user?.id);
  const canDecide = usePermission("approvals:decide");
  const person = usePeople();
  const decide = useDecide();
  const [comment, setComment] = useState("");

  if (item.status !== "pending") {
    if (!item.decidedAt) return null;
    return (
      <p className="border-t pt-3 text-sm text-muted-foreground">
        {t("approvals.decidedBy", {
          name: person(item.approverId),
          date: formatDateTime(item.decidedAt, localeTag(i18n.language)),
        })}
        {item.comment ? `: ${item.comment}` : ""}
      </p>
    );
  }
  if (item.requesterId === me) {
    return (
      <p role="status" className="flex items-start gap-1.5 border-t pt-3 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("approvals.waitingOther")}
      </p>
    );
  }
  if (!canDecide) {
    return <p className="border-t pt-3 text-sm text-muted-foreground">{t("approvals.waiting")}</p>;
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
          onClick={() => decide.mutate({ id: item.id, decision: "approve", comment })}
        >
          {t("approvals.approve")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!ready}
          onClick={() => decide.mutate({ id: item.id, decision: "reject", comment })}
        >
          {t("approvals.reject")}
        </Button>
      </div>
    </div>
  );
}
