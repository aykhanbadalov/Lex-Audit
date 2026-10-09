const TAGS: Record<string, string> = { az: "az-Latn-AZ", ru: "ru-RU", en: "en-US" };

/** BCP 47 tag used for Intl formatting, from the UI language code. */
export function localeTag(language: string): string {
  return TAGS[language] ?? TAGS.az!;
}
