import { z } from "zod";

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "expired", "all"] as const;

export const approvalsSearchSchema = z.object({
  // What people open the page for is the work waiting for them, so that is the default.
  status: z.enum(APPROVAL_STATUSES).catch("pending"),
});

export type ApprovalsSearch = z.infer<typeof approvalsSearchSchema>;
