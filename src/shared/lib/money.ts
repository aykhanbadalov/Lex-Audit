// Money arrives from the API as a decimal string ("12500.00"). The frontend only formats it
// and never does arithmetic on it as a number, so no precision is lost to floating point.

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;
const NBSP = " ";

export type Currency = "AZN" | "USD" | "EUR" | "RUB" | "TRY";

const AZ_SYMBOLS: Record<Currency, string> = { AZN: "₼", USD: "$", EUR: "€", RUB: "₽", TRY: "₺" };

export function isDecimalString(value: string): boolean {
  return DECIMAL_PATTERN.test(value);
}

/** Rounds a decimal string to whole cents (half away from zero) using integers only, so it is exact at any size. */
function toCents(amount: string): { negative: boolean; cents: bigint } {
  const negative = amount.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? amount.slice(1) : amount).split(".");
  const padded = `${fraction}000`;
  let cents = BigInt(whole + padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1n;
  return { negative: negative && cents !== 0n, cents };
}

/**
 * Azerbaijani convention: "1.234.567,80 ₼" (dot groups thousands, comma marks decimals, symbol after the amount).
 * Written by hand because browsers ship incomplete az data: Chrome falls back to "AZN 1,234,567.80".
 */
function formatAzerbaijani(amount: string, currency: Currency): string {
  const { negative, cents } = toCents(amount);
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = (cents % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole},${fraction}${NBSP}${AZ_SYMBOLS[currency]}`;
}

export function formatMoney(amount: string, currency: Currency, locale: string): string {
  if (!isDecimalString(amount)) {
    throw new TypeError(`Not a decimal string: "${amount}"`);
  }

  if (locale.toLowerCase().startsWith("az")) {
    return formatAzerbaijani(amount, currency);
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
