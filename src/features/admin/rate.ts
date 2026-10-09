/**
 * "18" -> "0.18", "4,5" -> "0.045", "100" -> "1". Works on whole hundredths of a percent, so a rate is never a float.
 * Returns null for anything that is not a percentage between 0 and 100 with at most two decimals.
 */
export function percentToRate(input: string): string | null {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const hundredths = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (hundredths > 10_000) return null;
  const digits = String(hundredths).padStart(5, "0");
  const fraction = digits.slice(-4).replace(/0+$/, "");
  return `${digits.slice(0, -4)}${fraction ? `.${fraction}` : ""}`;
}
