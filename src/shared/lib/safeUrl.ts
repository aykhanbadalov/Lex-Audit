/**
 * Returns the URL only if it is http(s). Links come from scraped sources, so a `javascript:` or `data:` URL
 * must never reach an href.
 */
export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
