import { useTranslation } from "react-i18next";
import { setLocale, SUPPORTED_LOCALES, type Locale } from "@/app/i18n";
import { Select } from "@/shared/ui/select";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t("language")}</span>
      <Select
        className="h-8 w-[4.5rem]"
        value={i18n.language}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {locale.toUpperCase()}
          </option>
        ))}
      </Select>
    </label>
  );
}
