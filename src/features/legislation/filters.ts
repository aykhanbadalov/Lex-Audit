import { z } from "zod";
import type { components } from "@/api/schema";

export const LEGISLATION_TYPES = [
  "code",
  "law",
  "decree",
  "cabinet_decision",
  "standard",
] as const satisfies readonly components["schemas"]["LegislationType"][];

export const legislationListSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  type: z.enum(LEGISLATION_TYPES).optional().catch(undefined),
});

export type LegislationListSearch = z.infer<typeof legislationListSearchSchema>;

export const legislationDetailSearchSchema = z.object({
  view: z.enum(["text", "diff"]).optional().catch(undefined),
  version: z.coerce.string().optional().catch(undefined),
  from: z.coerce.string().optional().catch(undefined),
  to: z.coerce.string().optional().catch(undefined),
  showUnchanged: z.boolean().optional().catch(undefined),
});

export type LegislationDetailSearch = z.infer<typeof legislationDetailSearchSchema>;
