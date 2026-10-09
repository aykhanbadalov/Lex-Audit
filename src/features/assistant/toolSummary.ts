/**
 * The backend's tool summary is often a JSON text. A list of results becomes a count, a note is shown as it is,
 * and anything else is shown shortened, never as raw JSON in full.
 */
export function describeSummary(
  summary: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  try {
    const parsed: unknown = JSON.parse(summary);
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.results)) {
        return record.results.length === 0
          ? t("assistant.toolSummary.none")
          : t("assistant.toolSummary.results", { count: record.results.length });
      }
      if (typeof record.note === "string") return record.note;
      if (typeof record.error === "string") return record.error;
    }
  } catch {
    // Not JSON: it is already a sentence.
  }
  return summary.length > 200 ? `${summary.slice(0, 200)}…` : summary;
}
