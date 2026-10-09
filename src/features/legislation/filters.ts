import { z } from "zod";

export const LEGISLATION_TYPES = ["code", "law", "decree", "cabinet_decision", "standard"] as const;

export const legislationListSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  type: z.enum(LEGISLATION_TYPES).optional().catch(undefined),
});

export type LegislationListSearch = z.infer<typeof legislationListSearchSchema>;

/** Versions are named by their number in the URL, the way the backend names them. */
const versionNo = z.coerce.number().int().positive().optional().catch(undefined);

export const legislationDetailSearchSchema = z.object({
  view: z.enum(["text", "diff"]).optional().catch(undefined),
  version: versionNo,
  from: versionNo,
  to: versionNo,
  showUnchanged: z.boolean().optional().catch(undefined),
});

export type LegislationDetailSearch = z.infer<typeof legislationDetailSearchSchema>;
