/**
 * Exact decimal arithmetic for the mock API, standing in for what the real backend does with rust_decimal.
 * Values are BigInt "micro-units" (six decimal places), so there is no floating point anywhere.
 * The frontend itself never imports this: it only ever formats the strings the API returns.
 */
const SCALE = 6;
const ONE = 10n ** BigInt(SCALE);
const CENT = 10n ** BigInt(SCALE - 2);

export function parseDec(text: string): bigint {
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const value = BigInt(whole) * ONE + BigInt(fraction.padEnd(SCALE, "0").slice(0, SCALE));
  return negative ? -value : value;
}

function roundDiv(numerator: bigint, divisor: bigint): bigint {
  // Half away from zero.
  const half = divisor / 2n;
  return numerator >= 0n ? (numerator + half) / divisor : (numerator - half) / divisor;
}

export function mulDec(a: bigint, b: bigint): bigint {
  return roundDiv(a * b, ONE);
}

/** Rounds to whole cents, half away from zero. */
export function roundCents(value: bigint): bigint {
  return roundDiv(value, CENT) * CENT;
}

/** "1234.50": always two decimals. The value is rounded to cents first. */
export function formatDec(value: bigint): string {
  const cents = roundDiv(value, CENT);
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const text = `${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
  return negative && abs !== 0n ? `-${text}` : text;
}
