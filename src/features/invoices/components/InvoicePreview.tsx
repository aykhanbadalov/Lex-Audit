import { FileQuestion } from "lucide-react";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { useObjectUrl } from "@/shared/hooks/useObjectUrl";
import { useInvoiceSource } from "../api";

// pdf.js is large and only needed on this screen, so it loads on demand.
const PdfPreview = lazy(() => import("./PdfPreview"));

/** The original document next to the extracted fields, so every value can be checked against the source. */
export function InvoicePreview({ invoiceId, fileName }: { invoiceId: string; fileName: string }) {
  const { t } = useTranslation();
  const source = useInvoiceSource(invoiceId, true);
  const blob = source.data;
  const url = useObjectUrl(blob);

  if (source.isPending) return <LoadingState rows={3} />;
  if (source.isError)
    return <ErrorState message={t("invoices.preview.failed")} onRetry={() => void source.refetch()} />;
  if (!blob || !url) return <LoadingState rows={3} />;

  if (blob.type === "application/pdf") {
    return (
      <Suspense fallback={<LoadingState rows={3} />}>
        <PdfPreview url={url} />
      </Suspense>
    );
  }
  if (blob.type.startsWith("image/")) {
    return (
      <img src={url} alt={t("invoices.preview.alt", { name: fileName })} className="max-w-full rounded-md border" />
    );
  }
  return <EmptyState icon={FileQuestion} title={t("invoices.preview.unavailable")} description={fileName} />;
}
