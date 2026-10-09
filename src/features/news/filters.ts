import { z } from "zod";

export const READ_FILTERS = ["all", "unread"] as const;

/**
 * Filters live in the URL so a filtered view can be bookmarked, shared and survives back/forward.
 * Each field falls back to `undefined` on bad input, so a hand-edited URL never crashes the page.
 * The router JSON-parses values ("?q=2025" arrives as a number), hence the string coercion.
 */
export const newsSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  sourceId: z.coerce.string().optional().catch(undefined),
  read: z.enum(READ_FILTERS).optional().catch(undefined),
  bookmarked: z.boolean().optional().catch(undefined),
});

export type NewsSearch = z.infer<typeof newsSearchSchema>;

/** The query the backend understands (`unread` and `bookmarked` are the strings "true" / "false"). */
export interface NewsFilters {
  q?: string;
  sourceId?: string;
  unread?: "true";
  bookmarked?: "true";
}

export function toApiFilters(search: NewsSearch): NewsFilters {
  return {
    q: search.q?.trim() || undefined,
    sourceId: search.sourceId,
    unread: search.read === "unread" ? "true" : undefined,
    bookmarked: search.bookmarked ? "true" : undefined,
  };
}

export function hasActiveFilters(search: NewsSearch): boolean {
  return Object.values(toApiFilters(search)).some((value) => value !== undefined);
}
