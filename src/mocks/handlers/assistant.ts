import { http, HttpResponse } from "msw";
import { answer, createConversation, findConversation, listConversations } from "../fixtures/assistant";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

const PERMISSION = "assistant:use";
/** Small chunks make the browser parse the stream the way a slow network delivers it. */
const CHUNK_BYTES = 41;

const summary = (c: { id: string; title: string | null; createdAt: string; updatedAt: string }) => ({
  id: c.id,
  title: c.title,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

function sseBody(events: { event: string; data: unknown }[]): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(
    events.map((entry) => `event: ${entry.event}\ndata: ${JSON.stringify(entry.data)}\n\n`).join(""),
  );
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + CHUNK_BYTES));
      offset += CHUNK_BYTES;
    },
  });
}

export const assistantHandlers = [
  http.get(apiPath("/conversations"), ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    return HttpResponse.json(listConversations().map(summary));
  }),

  http.post(apiPath("/conversations"), async ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    return HttpResponse.json(summary(createConversation(body.title)), { status: 201 });
  }),

  http.get(apiPath("/conversations/:id"), ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const found = findConversation(String(params.id));
    return found
      ? HttpResponse.json({ ...summary(found), messages: found.messages })
      : apiError(404, "NOT_FOUND", "Conversation not found");
  }),

  http.post(apiPath("/conversations/:id/messages"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const found = findConversation(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "Conversation not found");
    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim() ?? "";
    if (content.length === 0 || content.length > 4000) return apiError(422, "VALIDATION_FAILED", "Invalid message");
    return new HttpResponse(sseBody(answer(found, content, auth.user)), {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }),

  http.post(apiPath("/messages/:id/feedback"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const exists = listConversations().some((c) =>
      c.messages.some((m) => m.id === params.id && m.role === "assistant"),
    );
    if (!exists) return apiError(404, "NOT_FOUND", "Message not found");
    const body = (await request.json()) as { kind?: string; value?: string; correction?: string };
    const valid =
      (body.kind === "thumbs" && (body.value === "up" || body.value === "down")) ||
      (body.kind === "correction" && Boolean(body.correction?.trim()));
    if (!valid) return apiError(422, "VALIDATION_FAILED", "Invalid feedback");
    return HttpResponse.json({ id: crypto.randomUUID() }, { status: 201 });
  }),
];
