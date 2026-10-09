import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-sm">{message ?? t("errors.generic")}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {t("errors.retry")}
        </Button>
      ) : null}
    </div>
  );
}
