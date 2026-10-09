import type { JournalView } from "./api";

export type JournalShown = JournalView["status"] | "pending_approval";

/** An entry with an approval waiting is "proposed" on the backend; for a person it is "waiting for approval". */
export function journalState(entry: Pick<JournalView, "status" | "approvalId">): JournalShown {
  return entry.status === "proposed" && entry.approvalId ? "pending_approval" : entry.status;
}
