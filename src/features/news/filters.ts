import { z } from "zod";
import type { components } from "@/api/schema";

export const NEWS_CATEGORIES = [
  "tax",
  "vat",
  "accounting",
  "banking",
  "customs",
  "labor",
  "other",
] as const satisfies readonly components["schemas"]["NewsCategory"][];
export const RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "critical",
] as const satisfies readonly components["schemas"]["RiskLevel"][];
export const READ_FILTERS = ["all", "unread", "read"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Filters live in the URL so a filtered view can be bookmarked, shared and survives back/forward.
 * Each field falls back to `undefined` on bad input, so a hand-edited URL never crashes the page.
 * The router JSON-parses values ("?q=2025" arrives as a number), hence the string coercion.
 */
export const newsSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  sourceId: z.coerce.string().optional().catch(undefined),
  category: z.enum(NEWS_CATEGORIES).optional().catch(undefined),
  riskLevel: z.enum(RISK_LEVELS).optional().catch(undefined),
  read: z.enum(READ_FILTERS).optional().catch(undefined),
  bookmarked: z.boolean().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});

export type NewsSearch = z.infer<typeof newsSearchSchema>;

export interface NewsFilters {
  q?: string;
  sourceId?: string;
  category?: NewsSearch["category"];
  riskLevel?: NewsSearch["riskLevel"];
  publishedFrom?: string;
  publishedTo?: string;
  read?: NewsSearch["read"];
  bookmarked?: boolean;
}

/** Maps URL search params to API query params (the URL uses short names, the API uses explicit ones). */
export function toApiFilters(search: NewsSearch): NewsFilters {
  return {
    q: search.q?.trim() || undefined,
    sourceId: search.sourceId,
    category: search.category,
    riskLevel: search.riskLevel,
    publishedFrom: search.from,
    publishedTo: search.to,
    read: search.read && search.read !== "all" ? search.read : undefined,
    bookmarked: search.bookmarked || undefined,
  };
}

export function hasActiveFilters(search: NewsSearch): boolean {
  return Object.values(toApiFilters(search)).some((value) => value !== undefined);
}
