import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/ui/skeleton";

export function LoadingState({ rows = 5 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{t("app.loading")}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
