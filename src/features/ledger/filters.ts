import { z } from "zod";
import type { components } from "@/api/schema";

export const JOURNAL_STATUSES = [
  "proposed",
  "pending_approval",
  "approved",
  "posted",
  "rejected",
] as const satisfies readonly components["schemas"]["JournalStatus"][];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const journalSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  status: z.enum(JOURNAL_STATUSES).optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});

export type JournalSearch = z.infer<typeof journalSearchSchema>;

export function hasActiveJournalFilters(search: JournalSearch): boolean {
  return Boolean(search.q?.trim() || search.status || search.from || search.to);
}
