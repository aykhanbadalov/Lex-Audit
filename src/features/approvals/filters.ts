import { z } from "zod";
import type { components } from "@/api/schema";

export const APPROVAL_STATUSES = ["pending", "approved", "denied", "expired", "all"] as const;
export const APPROVAL_KINDS = [
  "tool_action",
  "access_request",
  "tax_rate_change",
  "model_release",
] as const satisfies readonly components["schemas"]["ApprovalKind"][];

export const approvalsSearchSchema = z.object({
  // What people open the page for is the work waiting for them, so that is the default.
  status: z.enum(APPROVAL_STATUSES).catch("pending"),
  kind: z.enum(APPROVAL_KINDS).optional().catch(undefined),
});

export type ApprovalsSearch = z.infer<typeof approvalsSearchSchema>;
