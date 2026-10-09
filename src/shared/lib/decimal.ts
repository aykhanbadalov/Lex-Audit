/** Exact arithmetic on decimal strings, for showing totals only. Integers are used so no digit is lost to floats. */
const PATTERN = /^-?\d+(\.\d+)?$/;

function toUnits(value: string, scale: number): bigint {
  if (!PATTERN.test(value)) throw new TypeError(`Not a decimal string: "${value}"`);
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const units = BigInt(whole + fraction.padEnd(scale, "0").slice(0, scale));
  return negative ? -units : units;
}

/** Sums decimal strings and returns a decimal string with `scale` places (default 2). */
export function sumDecimals(values: readonly string[], scale = 2): string {
  const total = values.reduce((sum, value) => sum + toUnits(value, scale), 0n);
  const negative = total < 0n;
  const digits = (negative ? -total : total).toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale);
  return `${negative ? "-" : ""}${whole}${scale > 0 ? `.${fraction}` : ""}`;
}

/** True when both are the same amount, whatever the number of trailing zeros. */
export function sameAmount(a: string, b: string): boolean {
  return sumDecimals([a], 6) === sumDecimals([b], 6);
}
