import type { SseEvent } from "@/api/sse";
import type { components } from "@/api/schema";

export type Citation = components["schemas"]["Citation"];
export type ToolRun = components["schemas"]["ToolRun"];
export type Approval = components["schemas"]["Approval"];
export type Message = components["schemas"]["Message"];

/** The assistant message as it is being written. Once finished it is replaced by the stored one. */
export interface LiveMessage {
  id: string | null;
  content: string;
  citations: Citation[];
  toolRuns: ToolRun[];
  approvals: Approval[];
  status: "streaming" | "complete" | "failed" | "stopped";
  error: { code: string; message: string } | null;
  /** The highest event id applied. Replayed events at or below it are ignored. */
  lastEventId: number;
}

export const initialLive: LiveMessage = {
  id: null,
  content: "",
  citations: [],
  toolRuns: [],
  approvals: [],
  status: "streaming",
  error: null,
  lastEventId: 0,
};

export function isTerminal(state: LiveMessage): boolean {
  return state.status !== "streaming";
}

const upsert = <T extends { id: string }>(list: readonly T[], item: T): T[] =>
  list.some((existing) => existing.id === item.id)
    ? list.map((existing) => (existing.id === item.id ? item : existing))
    : [...list, item];

function parse(event: SseEvent): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(event.data);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null; // a malformed event is skipped; it must not break the stream
  }
}

/**
 * Applies one server event. Pure, so every behaviour here is testable without a network.
 * Events are idempotent: when a dropped stream is resumed, anything already applied is ignored.
 */
export function reduce(state: LiveMessage, event: SseEvent): LiveMessage {
  const id = event.id !== null && /^\d+$/.test(event.id) ? Number(event.id) : null;
  if (id !== null && id <= state.lastEventId) return state;
  const next: LiveMessage = id !== null ? { ...state, lastEventId: id } : state;
  const data = parse(event);
  if (!data) return next;

  switch (event.event) {
    case "message.started":
      return typeof data.messageId === "string" ? { ...next, id: data.messageId } : next;
    case "message.delta":
      return typeof data.text === "string" ? { ...next, content: next.content + data.text } : next;
    case "citation.added": {
      const citation = data.citation as Citation | undefined;
      return citation?.id ? { ...next, citations: upsert(next.citations, citation) } : next;
    }
    case "tool.requested":
    case "tool.started":
    case "tool.completed":
    case "tool.failed": {
      const toolRun = data.toolRun as ToolRun | undefined;
      return toolRun?.id ? { ...next, toolRuns: upsert(next.toolRuns, toolRun) } : next;
    }
    case "tool.approval_required": {
      const toolRun = data.toolRun as ToolRun | undefined;
      const approval = data.approval as Approval | undefined;
      if (!toolRun?.id) return next;
      return {
        ...next,
        toolRuns: upsert(next.toolRuns, toolRun),
        approvals: approval?.id ? upsert(next.approvals, approval) : next.approvals,
      };
    }
    case "message.completed": {
      const message = data.message as Message | undefined;
      // The stored message is authoritative: it replaces what was assembled from the deltas.
      return message
        ? {
            ...next,
            id: message.id,
            content: message.content,
            citations: message.citations,
            toolRuns: message.toolRuns,
            approvals: message.approvals,
            status: "complete",
          }
        : next;
    }
    case "message.failed":
      return {
        ...next,
        status: "failed",
        error: { code: String(data.code ?? "INTERNAL"), message: String(data.message ?? "") },
      };
    default:
      return next;
  }
}
