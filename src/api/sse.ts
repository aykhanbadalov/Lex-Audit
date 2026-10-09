import { ApiError, toApiError } from "./errors";
import { API_BASE_URL, refreshSession } from "./session";
import { useAuthStore } from "@/shared/stores/authStore";

export interface SseEvent {
  /** The last `id:` seen on the stream, as the SSE spec defines it. */
  id: string | null;
  event: string;
  data: string;
}

/**
 * Reads a Server-Sent Events body. It follows the SSE specification rather than splitting on blank lines, because the
 * bytes arrive in arbitrary chunks: a chunk can end in the middle of a line, in the middle of a multi-byte character
 * (Azerbaijani letters are two bytes) or between the "\r" and "\n" of one line break.
 */
export async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const decoder = new TextDecoder("utf-8");
  const reader = stream.getReader();
  let buffer = "";
  let eventName = "";
  let data: string[] = [];
  let lastId: string | null = null;

  /** Takes one complete line off the front of the buffer, or returns null if more bytes are needed. */
  const takeLine = (final: boolean): string | null => {
    const match = /\r\n|\n|\r/.exec(buffer);
    if (!match) return null;
    // A "\r" at the very end may be the first half of "\r\n": wait for the next chunk to find out.
    if (match[0] === "\r" && match.index + 1 === buffer.length && !final) return null;
    const line = buffer.slice(0, match.index);
    buffer = buffer.slice(match.index + match[0].length);
    return line;
  };

  const handle = (line: string): SseEvent | null => {
    if (line === "") {
      // A blank line ends the event. An event with no data is not delivered.
      const out = data.length > 0 ? { id: lastId, event: eventName || "message", data: data.join("\n") } : null;
      eventName = "";
      data = [];
      return out;
    }
    if (line.startsWith(":")) return null; // a comment, often used as a keep-alive
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value;
    else if (field === "data") data.push(value);
    else if (field === "id" && !value.includes("\u0000")) lastId = value;
    return null; // "retry" and unknown fields are ignored
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (let line = takeLine(false); line !== null; line = takeLine(false)) {
        const event = handle(line);
        if (event) yield event;
      }
    }
    buffer += decoder.decode();
    for (let line = takeLine(true); line !== null; line = takeLine(true)) {
      const event = handle(line);
      if (event) yield event;
    }
    // Whatever is left (an event that never got its blank line) was cut off, so it is dropped, not guessed at.
  } finally {
    reader.releaseLock();
  }
}

interface StreamInit {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  lastEventId?: string;
}

async function open(path: string, init: StreamInit): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "X-Request-Id": crypto.randomUUID(),
    ...init.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.lastEventId) headers["Last-Event-ID"] = init.lastEventId;
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "include",
      signal: init.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("NETWORK", error instanceof Error ? error.message : "Network error", 0, undefined, error);
  }
}

/** Opens an event stream with the session's token. An expired token is refreshed once, like any other request. */
export async function* streamSse(path: string, init: StreamInit = {}): AsyncGenerator<SseEvent> {
  let response = await open(path, init);
  if (response.status === 401 && (await refreshSession())) response = await open(path, init);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw toApiError(response.status, body);
  }
  if (!response.body) throw new ApiError("NETWORK", "The server sent no stream", 0);
  yield* parseSse(response.body);
}
