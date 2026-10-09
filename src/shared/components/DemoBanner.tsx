import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Shown whenever the app runs on mock data, so nobody mistakes invented news or laws for real ones. */
export function DemoBanner() {
  const { t } = useTranslation();
  if (import.meta.env.VITE_ENABLE_MSW !== "true") return null;
  return (
    <div
      role="note"
      className="flex items-center gap-2 bg-amber-100 px-4 py-1.5 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
      {t("demo.banner")}
    </div>
  );
}
