/**
 * Turns user input into the canonical folder path the API expects: a leading slash, single slashes, no trailing
 * slash (the root is "/"). Returns null when the path tries to climb out with "..", which the server also rejects.
 */
export function normalizeFolder(input: string): string | null {
  const segments = input
    .trim()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  return `/${segments.join("/")}`;
}

/** "a, b ,, a" → ["a", "b"]. Blank entries and repeats are dropped, order is kept. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(",")) {
    const tag = raw.trim();
    if (tag) seen.add(tag);
  }
  return [...seen];
}
