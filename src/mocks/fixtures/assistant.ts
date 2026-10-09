// DEMO CONTENT. Answers, sources and tool use are scripted from keywords; the real model, retrieval and tools belong
// to the backend. The shapes mirror the backend: conversations, stored messages, and the events of the SSE stream.
import { addApprovalRequest } from "./approvals";
import type { MockUser } from "../handlers/auth";

export interface StoredConversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: { label: string; chunkId: string }[];
  toolCalls: { id: string; name: string }[] | null;
  modelVersion: string | null;
  createdAt: string;
}

export interface ScriptEvent {
  event: string;
  data: unknown;
}

export const NO_SOURCE =
  "Bu sual üçün bazada mənbə tapılmadı. Qanunvericilik, xəbərlər və ya fayllar üzrə dəqiq sual verin.";

const seed = (): StoredConversation[] => [
  {
    id: "conv-1",
    title: "ƏDV depozit hesabı haqqında",
    createdAt: "2026-10-06T09:00:00Z",
    updatedAt: "2026-10-06T09:05:00Z",
    messages: [
      {
        id: "msg-1",
        role: "user",
        content: "ƏDV depozit hesabı nədir?",
        citations: [],
        toolCalls: null,
        modelVersion: null,
        createdAt: "2026-10-06T09:00:00Z",
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "ƏDV ödəyiciləri ödənişləri **depozit hesabı** vasitəsilə həyata keçirir [1].",
        citations: [{ label: "Vergi Məcəlləsi, maddə 3", chunkId: "11111111-1111-4111-8111-111111111111" }],
        toolCalls: [{ id: "call-1", name: "legislation.search" }],
        modelVersion: "lexaudit-llm-demo-0.1",
        createdAt: "2026-10-06T09:00:05Z",
      },
    ],
  },
  { id: "conv-2", title: null, createdAt: "2026-10-07T08:00:00Z", updatedAt: "2026-10-07T08:00:00Z", messages: [] },
];

let db = seed();
let counter = 0;

export function resetAssistant(): void {
  db = seed();
  counter = 0;
}

export const listConversations = (): StoredConversation[] =>
  [...db].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
export const findConversation = (id: string): StoredConversation | undefined => db.find((entry) => entry.id === id);

export function createConversation(title?: string): StoredConversation {
  const now = new Date().toISOString();
  const created: StoredConversation = {
    id: `conv-n${++counter}`,
    title: title ?? null,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  db = [created, ...db];
  return created;
}

const lower = (text: string) => text.toLocaleLowerCase("az");

/** Decides what the scripted "model" does, from the words of the question. */
export function answer(conversation: StoredConversation, content: string, user: MockUser): ScriptEvent[] {
  const text = lower(content);
  const n = ++counter;
  const userMessageId = `msg-u${n}`;
  const assistantId = `msg-a${n}`;
  const now = new Date().toISOString();
  const events: ScriptEvent[] = [{ event: "message.created", data: { messageId: userMessageId } }];
  const user_: StoredMessage = {
    id: userMessageId,
    role: "user",
    content,
    citations: [],
    toolCalls: null,
    modelVersion: null,
    createdAt: now,
  };
  conversation.messages.push(user_);
  conversation.title ??= content.slice(0, 40);
  conversation.updatedAt = now;

  const finish = (body: string, citations: StoredMessage["citations"], toolCalls: StoredMessage["toolCalls"]) => {
    events.push({
      event: "final",
      data: { messageId: assistantId, content: body, citations, model: "lexaudit-llm-demo-0.1" },
    });
    events.push({ event: "done", data: {} });
    conversation.messages.push({
      id: assistantId,
      role: "assistant",
      content: body,
      citations,
      toolCalls,
      modelVersion: "lexaudit-llm-demo-0.1",
      createdAt: new Date().toISOString(),
    });
  };
  const words = (body: string) => body.match(/.{1,24}(\s|$)/g) ?? [body];

  if (/xəta/.test(text)) {
    events.push({ event: "step", data: { n: 1 } }, { event: "delta", data: { text: "Cavab hazırlanır, " } });
    events.push(
      { event: "error", data: { code: "INTERNAL", message: "The assistant failed." } },
      { event: "done", data: {} },
    );
    return events;
  }

  if (/yazılış|təsdiqə göndər|arxivlə/.test(text)) {
    const approvalId = `appr-tool-${n}`;
    events.push({ event: "step", data: { n: 1 } });
    events.push({
      event: "tool.call",
      data: { callId: `call-${n}`, tool: "ledger.submit_entries", arguments: { entryId: "je-seed-3" } },
    });
    events.push({
      event: "tool.result",
      data: {
        callId: `call-${n}`,
        tool: "ledger.submit_entries",
        status: "approval_required",
        summary: "Yazılış təsdiq gözləyir",
        toolRunId: `run-${n}`,
        approvalId,
      },
    });
    addApprovalRequest({
      id: approvalId,
      kind: "tool:ledger.submit_entries",
      title: "Jurnal yazılışı təsdiqə göndərilsin",
      summary: "je-seed-3",
      riskLevel: "moderate-write",
      status: "pending",
      requestedBy: { id: user.id, name: user.name },
      requestedAt: now,
      expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
      decidedBy: null,
      decidedAt: null,
      comment: null,
      changes: [],
      source: { type: "tool_run", id: `run-${n}` } as never,
    });
    finish(
      "Yazılışı təsdiqə göndərmək üçün başqa şəxsin təsdiqi lazımdır. Təsdiq gələnə qədər heç nə dəyişməyəcək.",
      [],
      [{ id: `call-${n}`, name: "ledger.submit_entries" }],
    );
    return events;
  }

  if (/ədv|qaimə|vergi|depozit/.test(text) || /kəsil/.test(text)) {
    events.push({ event: "step", data: { n: 1 } });
    events.push({
      event: "tool.call",
      data: { callId: `call-${n}`, tool: "legislation.search", arguments: { query: content.slice(0, 80) } },
    });
    events.push({
      event: "tool.result",
      data: {
        callId: `call-${n}`,
        tool: "legislation.search",
        status: "succeeded",
        summary: '{"results":[{"id":1},{"id":2}]}',
        toolRunId: `run-${n}`,
      },
    });
    events.push({ event: "step", data: { n: 2 } });
    const body =
      "ƏDV ödəyiciləri qaimə-fakturanı vaxtında təqdim etməlidir [1] və ödənişləri ƏDV depozit hesabı vasitəsilə həyata keçirir [2].";
    for (const piece of words(body)) events.push({ event: "delta", data: { text: piece } });
    finish(
      body,
      [
        { label: "Vergi Məcəlləsi, maddə 2", chunkId: "22222222-2222-4222-8222-222222222222" },
        { label: "ƏDV depozit hesabı üzrə izahat", chunkId: "33333333-3333-4333-8333-333333333333" },
      ],
      [{ id: `call-${n}`, name: "legislation.search" }],
    );
    return events;
  }

  // Nothing relevant was found: the assistant says so instead of inventing a source.
  events.push({ event: "step", data: { n: 1 } });
  for (const piece of words(NO_SOURCE)) events.push({ event: "delta", data: { text: piece } });
  finish(NO_SOURCE, [], null);
  return events;
}
