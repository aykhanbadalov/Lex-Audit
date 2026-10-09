// DEMO RATES. They stand in for the Central Bank's official rates and are not real.
import { formatDec, mulDec, parseDec, roundCents } from "../decimal";

export const BASE_CURRENCY = "AZN";

const RATES: Record<string, string> = { AZN: "1", USD: "1.70", EUR: "1.85", RUB: "0.0190", TRY: "0.0500" };

/** The rate that turns one unit of `currency` into the base currency, or null when no conversion is needed. */
export function rateFor(currency: string): string | null {
  return currency === BASE_CURRENCY ? null : (RATES[currency] ?? null);
}

/** Converts a decimal string to the base currency, rounded to cents. */
export function toBase(amount: string, currency: string): string {
  const rate = rateFor(currency);
  return rate ? formatDec(roundCents(mulDec(parseDec(amount), parseDec(rate)))) : amount;
}
