import type { LiveTurn, ToolCall } from "./chatReducer";
import type { StoredMessage } from "./api";
import type { DisplayMessage } from "./components/MessageView";

export const fromStored = (message: StoredMessage, known?: ToolCall[]): DisplayMessage => ({
  id: message.id,
  role: message.role === "user" ? "user" : "assistant",
  content: message.content,
  status: "complete",
  citations: message.citations,
  tools: known ?? (message.toolCalls ?? []).map((call) => ({ tool: call.name })),
  modelVersion: message.modelVersion,
  error: null,
  live: false,
});

export const fromLive = (turn: LiveTurn): DisplayMessage => ({
  id: turn.messageId,
  role: "assistant",
  content: turn.content,
  status: turn.status,
  citations: turn.citations,
  tools: turn.tools,
  modelVersion: turn.model,
  error: turn.error,
  live: true,
});
