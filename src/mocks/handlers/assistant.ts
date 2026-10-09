import { http, HttpResponse } from "msw";
import type { components } from "@/api/schema";
import {
  answer,
  createConversation,
  decide,
  eventsOf,
  findConversation,
  findMessage,
  listConversations,
  setFeedback,
  type ScriptEvent,
} from "../fixtures/assistant";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

type SendRequest = components["schemas"]["SendMessageRequest"];

const PERMISSION = "assistant:use";

function sseText(list: ScriptEvent[]): string {
  return list
    .map((entry) => `id: ${entry.id}\nevent: ${entry.event}\ndata: ${JSON.stringify(entry.data)}\n\n`)
    .join("");
}

/** Sends the stream in small, awkward pieces, so the browser-side parser is exercised on every run. */
function streamOf(text: string): Response {
  const bytes = new TextEncoder().encode(text);
  const SIZE = 41;
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= bytes.length) return controller.close();
      if (import.meta.env.MODE !== "test") await new Promise((resolve) => setTimeout(resolve, 25));
      controller.enqueue(bytes.slice(offset, offset + SIZE));
      offset += SIZE;
    },
  });
  return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}

export const assistantHandlers = [
  http.get(apiPath("/conversations"), ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    return HttpResponse.json(listConversations());
  }),

  http.post(apiPath("/conversations"), async ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const { messages: _messages, ...created } = createConversation(body.title);
    void _messages;
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(apiPath("/conversations/:id/messages"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const conversation = findConversation(String(params.id));
    if (!conversation) return apiError(404, "NOT_FOUND", "Conversation not found");
    if (!request.headers.get("Idempotency-Key"))
      return apiError(422, "VALIDATION_FAILED", "Idempotency-Key header is required");

    const body = (await request.json()) as SendRequest;
    const content = body.content?.trim() ?? "";
    if (!content || content.length > 4000)
      return apiError(422, "VALIDATION_FAILED", "The message is empty or too long");

    const { events, dropAfter } = answer(conversation, content, body.attachments ?? [], auth.user);
    // A dropped connection: only the first part of the stream arrives, with no completing event.
    return streamOf(sseText(dropAfter ? events.slice(0, dropAfter) : events));
  }),

  http.get(apiPath("/conversations/:id"), ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const conversation = findConversation(String(params.id));
    return conversation ? HttpResponse.json(conversation) : apiError(404, "NOT_FOUND", "Conversation not found");
  }),

  http.patch(apiPath("/conversations/:id"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const conversation = findConversation(String(params.id));
    if (!conversation) return apiError(404, "NOT_FOUND", "Conversation not found");
    const body = (await request.json()) as { title?: string; archived?: boolean };
    if (body.title !== undefined) {
      if (!body.title.trim() || body.title.length > 120) return apiError(422, "VALIDATION_FAILED", "Invalid title");
      conversation.title = body.title.trim();
    }
    if (body.archived !== undefined) conversation.archived = body.archived;
    const { messages: _messages, ...summary } = conversation;
    void _messages;
    return HttpResponse.json(summary);
  }),

  http.get(apiPath("/messages/:id/events"), ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const all = eventsOf(String(params.id));
    if (!all) return apiError(404, "NOT_FOUND", "Message not found");
    const last = Number(request.headers.get("Last-Event-ID") ?? 0) || 0;
    // Resuming replays from the very start of the unseen part; anything the client already applied is ignored by it.
    return streamOf(sseText(all.filter((entry) => entry.id > last)));
  }),

  http.post(apiPath("/messages/:id/stop"), ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    return findMessage(String(params.id))
      ? new HttpResponse(null, { status: 204 })
      : apiError(404, "NOT_FOUND", "Message not found");
  }),

  http.post(apiPath("/messages/:id/feedback"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const message = findMessage(String(params.id));
    if (!message) return apiError(404, "NOT_FOUND", "Message not found");
    const body = (await request.json()) as { rating?: string; correction?: string };
    if (body.rating !== "up" && body.rating !== "down") return apiError(422, "VALIDATION_FAILED", "Invalid rating");
    setFeedback(message, body.rating);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(apiPath("/approvals/:id/decide"), async ({ request, params }) => {
    const auth = authorize(request, "approvals:decide");
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as { decision?: string; comment?: string };
    if (body.decision !== "approved" && body.decision !== "denied")
      return apiError(422, "VALIDATION_FAILED", "Invalid decision");
    const result = decide(String(params.id), body.decision, body.comment, auth.user);
    if (result.ok) return HttpResponse.json(result.approval);
    if (result.reason === "own-request") return apiError(403, "FORBIDDEN", "You cannot decide your own request");
    return result.reason === "not-found"
      ? apiError(404, "NOT_FOUND", "Approval not found")
      : apiError(409, "CONFLICT", "Already decided");
  }),
];
