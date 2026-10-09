/**
 * "0.18" -> "18", "0.045" -> "4.5", "1" -> "100". The decimal point is moved by hand on the string, so a rate is never
 * turned into a float and cannot pick up noise such as 17.999999999999996.
 */
export function ratePercent(rate: string): string {
  const [whole = "0", fraction = ""] = rate.split(".");
  const digits = `${fraction}00`.slice(0, Math.max(fraction.length, 2));
  const integer = `${whole}${digits.slice(0, 2)}`.replace(/^0+(?=\d)/, "");
  const rest = digits.slice(2).replace(/0+$/, "");
  return rest ? `${integer}.${rest}` : integer;
}
