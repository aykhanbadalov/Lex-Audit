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

/**
 * The backend stores an assistant step that only calls tools as a message of its own, with no text. For a reader that
 * is one answer: the steps' tools are shown on the answer that follows them, and the empty message is not listed.
 * `known` holds what the tools of a just-finished answer did, which the stored copy no longer carries.
 */
export function fromStoredList(messages: StoredMessage[], known: Record<string, ToolCall[]> = {}): DisplayMessage[] {
  const list: DisplayMessage[] = [];
  let carried: { tool: string }[] = [];
  for (const message of messages) {
    if (message.role === "assistant" && message.content.trim() === "") {
      carried = [...carried, ...(message.toolCalls ?? []).map((call) => ({ tool: call.name }))];
      continue;
    }
    const shown = fromStored(message, known[message.id]);
    if (message.role === "assistant" && !known[message.id]) shown.tools = [...carried, ...shown.tools];
    if (message.role === "assistant") carried = [];
    list.push(shown);
  }
  return list;
}
