import { CheckCircle2, CircleAlert, FileSearch, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import type { InvoiceStatus } from "../filters";

const TONE: Record<InvoiceStatus, BadgeTone> = {
  extracted: "info",
  needs_review: "warning",
  validated: "success",
  posted: "success",
};

/** The state is spelled out in words and an icon, never colour alone. */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  const cls = "mr-1 size-3";
  const icon =
    status === "posted" ? (
      <ShieldCheck className={cls} aria-hidden="true" />
    ) : status === "validated" ? (
      <CheckCircle2 className={cls} aria-hidden="true" />
    ) : status === "needs_review" ? (
      <CircleAlert className={cls} aria-hidden="true" />
    ) : (
      <FileSearch className={cls} aria-hidden="true" />
    );
  return (
    <Badge tone={TONE[status]}>
      {icon}
      {t(`invoices.status.${status}`)}
    </Badge>
  );
}
