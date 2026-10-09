/**
 * A percentage as the backend wants it: "18", "4,5" and "4.5" are accepted, the result has a decimal point.
 * Returns null for anything that is not between 0 and 100 with at most two decimals.
 */
export function normalizePercent(input: string): string | null {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const hundredths = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (hundredths > 10_000) return null;
  return match[2] ? `${match[1]}.${match[2]}` : match[1]!;
}
