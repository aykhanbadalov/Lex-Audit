import { CheckCircle2, CircleAlert, Clock, FileSearch, Loader2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import type { Invoice } from "../api";

const TONE: Record<Invoice["status"], BadgeTone> = {
  uploaded: "neutral",
  extracting: "info",
  extracted: "warning",
  validated: "success",
  posted: "success",
  rejected: "danger",
  failed: "danger",
};

/** The state is spelled out in words and an icon, never colour alone. */
export function InvoiceStatusBadge({ status }: { status: Invoice["status"] }) {
  const { t } = useTranslation();
  const cls = "mr-1 size-3";
  const icon =
    status === "validated" || status === "posted" ? (
      <CheckCircle2 className={cls} aria-hidden="true" />
    ) : status === "failed" || status === "rejected" ? (
      <XCircle className={cls} aria-hidden="true" />
    ) : status === "extracting" ? (
      <Loader2 className={`${cls} animate-spin`} aria-hidden="true" />
    ) : status === "extracted" ? (
      <FileSearch className={cls} aria-hidden="true" />
    ) : status === "uploaded" ? (
      <Clock className={cls} aria-hidden="true" />
    ) : (
      <CircleAlert className={cls} aria-hidden="true" />
    );
  return (
    <Badge tone={TONE[status]}>
      {icon}
      {t(`invoices.status.${status}`)}
    </Badge>
  );
}
