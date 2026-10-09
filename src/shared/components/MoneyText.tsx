import { useTranslation } from "react-i18next";
import { localeTag } from "@/shared/lib/locale";
import { formatMoney, type Currency } from "@/shared/lib/money";

/** Renders an API decimal string as currency. Right-aligned tabular digits keep columns readable. */
export function MoneyText({ amount, currency = "AZN" }: { amount: string; currency?: Currency | string }) {
  const { i18n } = useTranslation();
  return <span className="tabular-nums">{formatMoney(amount, currency as Currency, localeTag(i18n.language))}</span>;
}
