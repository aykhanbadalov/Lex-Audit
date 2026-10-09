import type { Approval, Citation, LiveMessage, Message, ToolRun } from "./chatReducer";

export interface DisplayMessage {
  id: string | null;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | Message["status"];
  citations: Citation[];
  toolRuns: ToolRun[];
  approvals: Approval[];
  modelVersion: string | null;
  feedback: Message["feedback"];
  /** True while this is the local copy being written, before the stored one replaces it. */
  live: boolean;
}

export const fromStored = (message: Message): DisplayMessage => ({ ...message, live: false });

export const fromLive = (state: LiveMessage): DisplayMessage => ({
  id: state.id,
  role: "assistant",
  content: state.content,
  status: state.status === "complete" ? "complete" : state.status,
  citations: state.citations,
  toolRuns: state.toolRuns,
  approvals: state.approvals,
  modelVersion: null,
  feedback: null,
  live: true,
});
