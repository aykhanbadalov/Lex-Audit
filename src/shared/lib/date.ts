const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Browsers ship incomplete Azerbaijani locale data: some Chrome builds print the month as "M10"
// even for { month: "long" }, and others print "okt". Month names are therefore kept here, not taken from Intl.
const AZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avqust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
] as const;

function isAzerbaijani(locale: string): boolean {
  return locale.toLowerCase().startsWith("az");
}

/**
 * Full month name ("9 oktyabr 2026", "9 октября 2026 г.", "October 9, 2026").
 *
 * A date without a time ("2000-07-11") is a calendar day, not an instant, so it is shown as that day in every
 * time zone instead of being shifted by the viewer's offset.
 */
export function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const dateOnly = DATE_ONLY.test(iso);

  if (isAzerbaijani(locale)) {
    const day = dateOnly ? date.getUTCDate() : date.getDate();
    const month = dateOnly ? date.getUTCMonth() : date.getMonth();
    const year = dateOnly ? date.getUTCFullYear() : date.getFullYear();
    return `${day} ${AZ_MONTHS[month]} ${year}`;
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: "long", ...(dateOnly ? { timeZone: "UTC" } : {}) }).format(date);
}

/** Date and time formatted separately: combined "long" styles insert an English "at" for some locales. */
export function formatDateTime(iso: string, locale: string): string {
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  return `${formatDate(iso, locale)}, ${time}`;
}

/** "sentyabr 2026" for a "YYYY-MM" period id, with the same Azerbaijani month names as formatDate. */
export function formatMonth(periodId: string, locale: string): string {
  const [year, month] = periodId.split("-").map(Number) as [number, number];
  if (isAzerbaijani(locale)) return `${AZ_MONTHS[month - 1]} ${year}`;
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}
