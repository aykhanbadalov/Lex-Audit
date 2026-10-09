import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const auditSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});

export type AuditSearch = z.infer<typeof auditSearchSchema>;

export const hasActiveAuditFilters = (search: AuditSearch): boolean =>
  Boolean(search.q?.trim() || search.from || search.to);

/** Translation key for an action such as "invoice.update" (dots would nest in the locale files). */
export const auditActionKey = (action: string): string => action.replaceAll(".", "_");
