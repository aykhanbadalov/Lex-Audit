import { z } from "zod";

export const VAT_TABS = ["summary", "deposit", "return", "rates"] as const;

export const vatSearchSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  tab: z.enum(VAT_TABS).optional().catch(undefined),
});

export type VatSearch = z.infer<typeof vatSearchSchema>;
