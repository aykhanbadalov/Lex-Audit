import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";

// The worker runs from our own origin, so the Content-Security-Policy needs only `worker-src 'self'`.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export default function PdfPreview({ url }: { url: string }) {
  const { t } = useTranslation();
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(480);
  const box = useRef<HTMLDivElement>(null);

  // Fit the page to the available width, and follow resizes.
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (failed)
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {t("invoices.preview.failed")}
      </p>
    );

  return (
    <div ref={box} className="space-y-2">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setPages(numPages)}
        onLoadError={() => setFailed(true)}
        loading={<p className="p-4 text-sm text-muted-foreground">{t("app.loading")}</p>}
      >
        <Page pageNumber={page} width={width} renderTextLayer={false} renderAnnotationLayer={false} />
      </Document>
      {pages > 1 ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("invoices.preview.previous")}
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span aria-live="polite">{t("invoices.preview.page", { page, pages })}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("invoices.preview.next")}
            disabled={page >= pages}
            onClick={() => setPage((current) => current + 1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
