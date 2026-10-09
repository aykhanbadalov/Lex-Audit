import { z } from "zod";

export const JOURNAL_STATUSES = ["proposed", "approved", "posted"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const journalSearchSchema = z.object({
  status: z.enum(JOURNAL_STATUSES).optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});

export type JournalSearch = z.infer<typeof journalSearchSchema>;

export function hasActiveJournalFilters(search: JournalSearch): boolean {
  return Boolean(search.status || search.from || search.to);
}
