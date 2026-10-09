import { useTranslation } from "react-i18next";
import { formatMoney, type Currency } from "@/shared/lib/money";

const LOCALE_TAG: Record<string, string> = { az: "az-Latn-AZ", ru: "ru-RU", en: "en-US" };

/** Renders an API decimal string as currency. Right-aligned tabular digits keep columns readable. */
export function MoneyText({ amount, currency = "AZN" }: { amount: string; currency?: Currency }) {
  const { i18n } = useTranslation();
  return (
    <span className="tabular-nums">{formatMoney(amount, currency, LOCALE_TAG[i18n.language] ?? "az-Latn-AZ")}</span>
  );
}
