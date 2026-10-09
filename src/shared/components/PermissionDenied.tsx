import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "./EmptyState";

export function PermissionDenied() {
  const { t } = useTranslation();
  return <EmptyState icon={ShieldAlert} title={t("errors.forbidden")} description={t("errors.forbiddenHint")} />;
}
