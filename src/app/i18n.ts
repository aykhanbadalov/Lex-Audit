import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import az from "@/locales/az.json";
import en from "@/locales/en.json";
import ru from "@/locales/ru.json";
import { readPreference, writePreference } from "@/shared/lib/storage";

export const SUPPORTED_LOCALES = ["az", "ru", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_KEY = "lexaudit.locale";

function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function initialLocale(): Locale {
  const stored = readPreference(LOCALE_KEY);
  if (isLocale(stored)) return stored;
  const fallback = import.meta.env.VITE_DEFAULT_LOCALE;
  return isLocale(fallback) ? fallback : "az";
}

void i18n.use(initReactI18next).init({
  resources: { az: { translation: az }, ru: { translation: ru }, en: { translation: en } },
  lng: initialLocale(),
  fallbackLng: "az",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;

export function setLocale(locale: Locale): void {
  void i18n.changeLanguage(locale);
  writePreference(LOCALE_KEY, locale);
  document.documentElement.lang = locale;
}

export { i18n };
