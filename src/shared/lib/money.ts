// Money arrives from the API as a decimal string ("12500.00"). The frontend only formats it
// and never does arithmetic on it, so no precision is lost to floating point.

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

export type Currency = "AZN" | "USD" | "EUR" | "RUB" | "TRY";

export function isDecimalString(value: string): boolean {
  return DECIMAL_PATTERN.test(value);
}

export function formatMoney(amount: string, currency: Currency, locale: string): string {
  if (!isDecimalString(amount)) {
    throw new TypeError(`Not a decimal string: "${amount}"`);
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Intl.NumberFormat formats decimal strings exactly, without converting them to a float.
  return formatter.format(amount as unknown as number);
}
