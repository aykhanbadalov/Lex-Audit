/**
 * What the assistant's answer looks like while it is still being written, built from the events the backend streams:
 * message.created, step, delta, tool.call, tool.result, final, error, done.
 * Pure: the same events always give the same state, and a malformed event is skipped instead of crashing the chat.
 */
export type ToolStatus = "running" | "succeeded" | "rejected" | "approval_required" | "failed";

export interface ToolCall {
  callId: string;
  tool: string;
  status: ToolStatus;
  /** A short sentence from the backend about what the tool did. */
  summary: string | null;
  approvalId: string | null;
}

export interface Citation {
  label: string;
  chunkId: string;
}

export type TurnStatus = "streaming" | "complete" | "failed" | "stopped";

export interface TurnError {
  code: string;
  message: string;
}

export interface LiveTurn {
  status: TurnStatus;
  /** The id of the stored answer, known once the backend has saved it. */
  messageId: string | null;
  content: string;
  step: number;
  tools: ToolCall[];
  citations: Citation[];
  model: string | null;
  error: TurnError | null;
}

export const initialTurn: LiveTurn = {
  status: "streaming",
  messageId: null,
  content: "",
  step: 0,
  tools: [],
  citations: [],
  model: null,
  error: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

export interface StreamedEvent {
  event: string;
  data: string;
}

/** An error that comes with a final answer (the agent ran out of steps) is a warning on a finished answer. */
export const SOFT_ERRORS: readonly string[] = ["STEP_LIMIT"];

export function reduce(state: LiveTurn, incoming: StreamedEvent): LiveTurn {
  let data: unknown;
  try {
    data = JSON.parse(incoming.data);
  } catch {
    return state;
  }
  if (!isRecord(data)) return state;

  switch (incoming.event) {
    case "delta": {
      const text = str(data.text);
      return text === null ? state : { ...state, content: state.content + text };
    }
    case "step": {
      return typeof data.n === "number" ? { ...state, step: data.n } : state;
    }
    case "tool.call": {
      const callId = str(data.callId);
      const tool = str(data.tool);
      if (!callId || !tool) return state;
      const call: ToolCall = { callId, tool, status: "running", summary: null, approvalId: null };
      return { ...state, tools: [...state.tools.filter((existing) => existing.callId !== callId), call] };
    }
    case "tool.result": {
      const callId = str(data.callId);
      const status = str(data.status);
      if (!callId || !status || !["succeeded", "rejected", "approval_required", "failed"].includes(status))
        return state;
      const known = state.tools.some((existing) => existing.callId === callId);
      const patch = { status: status as ToolStatus, summary: str(data.summary), approvalId: str(data.approvalId) };
      return {
        ...state,
        tools: known
          ? state.tools.map((existing) => (existing.callId === callId ? { ...existing, ...patch } : existing))
          : [...state.tools, { callId, tool: str(data.tool) ?? "unknown", ...patch }],
      };
    }
    case "final": {
      const content = str(data.content);
      if (content === null) return state;
      const citations = Array.isArray(data.citations)
        ? data.citations.flatMap((item): Citation[] =>
            isRecord(item) && str(item.label) && str(item.chunkId)
              ? [{ label: item.label as string, chunkId: item.chunkId as string }]
              : [],
          )
        : [];
      // The saved answer replaces what was streamed. A soft error that came before it is kept as a note.
      const failed = state.error !== null && !SOFT_ERRORS.includes(state.error.code);
      return {
        ...state,
        status: failed ? "failed" : "complete",
        content,
        citations,
        messageId: str(data.messageId),
        model: str(data.model),
      };
    }
    case "error": {
      const code = str(data.code) ?? "INTERNAL";
      const error = { code, message: str(data.message) ?? "" };
      return { ...state, error, status: SOFT_ERRORS.includes(code) ? state.status : "failed" };
    }
    case "done": {
      // The stream is over. If no answer was saved and nothing failed explicitly, something went wrong on the way.
      if (state.status === "streaming") {
        return { ...state, status: "failed", error: state.error ?? { code: "INTERNAL", message: "" } };
      }
      return state;
    }
    default:
      return state;
  }
}

export const isFinished = (state: LiveTurn): boolean => state.status !== "streaming";
