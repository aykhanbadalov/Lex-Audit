import { useTranslation } from "react-i18next";
import { RiskBadge, type RiskLevel } from "./StatusBadge";

/** Risk is shown as text plus colour, never colour alone. */
export function RiskLabel({ level }: { level: RiskLevel }) {
  const { t } = useTranslation();
  return <RiskBadge level={level} label={t(`risk.${level}`)} />;
}
