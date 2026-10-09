const NBSP = "\u00A0";

const UNITS: Record<string, readonly string[]> = {
  ru: ["Б", "КБ", "МБ", "ГБ"],
  default: ["B", "KB", "MB", "GB"],
};

/** "1,5 MB" (Azerbaijani, Russian) or "1.5 MB" (English). Decimal comma is written by hand: browsers lack az number data. */
export function formatBytes(bytes: number, locale: string): string {
  const units = UNITS[locale.slice(0, 2).toLowerCase()] ?? UNITS.default!;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  const text = value.toFixed(digits).replace(/\.0$/, "");
  const decimalComma = !locale.toLowerCase().startsWith("en");
  return `${decimalComma ? text.replace(".", ",") : text}${NBSP}${units[unit]}`;
}
