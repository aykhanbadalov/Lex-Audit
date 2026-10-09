// DEMO CONTENT. Answers, sources and tool runs are scripted; the real model, retrieval and tools belong to the backend.
import type { components } from "@/api/schema";
import { addApprovalRequest } from "./approvals";

type Conversation = components["schemas"]["Conversation"];
type Message = components["schemas"]["Message"];
type Citation = components["schemas"]["Citation"];
type ToolRun = components["schemas"]["ToolRun"];
type Approval = components["schemas"]["Approval"];
type Attachment = components["schemas"]["ContextAttachment"];
type User = components["schemas"]["User"];

export interface ScriptEvent {
  id: number;
  event: string;
  data: unknown;
}

interface StoredConversation extends Conversation {
  messages: Message[];
}

const MODEL = "lexaudit-llm-demo-0.1";
const NO_SOURCE = "Bu sual üçün bazada mənbə tapılmadı. Hüquqi məsələdə mənbəsiz cavab vermirəm.";

const seed = (): StoredConversation[] => [
  {
    id: "conv-1",
    title: "ƏDV depozit hesabı",
    updatedAt: "2026-10-08T10:00:00Z",
    archived: false,
    messages: [
      {
        id: "msg-s1",
        role: "user",
        content: "ƏDV depozit hesabı nə üçündür?",
        createdAt: "2026-10-08T09:59:00Z",
        status: "complete",
        citations: [],
        toolRuns: [],
        approvals: [],
        modelVersion: null,
        feedback: null,
      },
      {
        id: "msg-s2",
        role: "assistant",
        content: "ƏDV ödəyiciləri ödənişləri **ƏDV depozit hesabı** vasitəsilə həyata keçirir [1].",
        createdAt: "2026-10-08T10:00:00Z",
        status: "complete",
        citations: [
          {
            id: "c-s1",
            resourceType: "legislation",
            resourceId: "leg-tax-code",
            title: "Vergi Məcəlləsi",
            locationLabel: "Maddə 3",
            excerpt: "ƏDV ödəyiciləri ödənişləri ƏDV depozit hesabı vasitəsilə həyata keçirir.",
          },
        ],
        toolRuns: [],
        approvals: [],
        modelVersion: MODEL,
        feedback: null,
      },
    ],
  },
  { id: "conv-2", title: "Boş söhbət", updatedAt: "2026-10-07T08:00:00Z", archived: false, messages: [] },
];

let db = seed();
let counter = 0;
const approvals = new Map<string, Approval>();
const events = new Map<string, ScriptEvent[]>();

export function resetAssistant(): void {
  db = seed();
  counter = 0;
  approvals.clear();
  events.clear();
}

export const listConversations = (): Conversation[] =>
  db
    .filter((entry) => !entry.archived)
    .map(({ messages: _messages, ...summary }) => {
      void _messages;
      return summary;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const findConversation = (id: string) => db.find((entry) => entry.id === id);

export function createConversation(title?: string): StoredConversation {
  const created: StoredConversation = {
    id: `conv-n${++counter}`,
    title: title?.trim() || "Yeni söhbət",
    updatedAt: new Date().toISOString(),
    archived: false,
    messages: [],
  };
  db = [created, ...db];
  return created;
}

export function findMessage(id: string): Message | undefined {
  return db.flatMap((entry) => entry.messages).find((message) => message.id === id);
}

export function eventsOf(messageId: string): ScriptEvent[] | undefined {
  return events.get(messageId);
}

const link = (
  type: Attachment["type"],
  id: string,
  title: string,
  excerpt: string,
  location: string | null = null,
): Citation => ({
  id: `c-${id}`,
  resourceType: type,
  resourceId: id,
  title,
  locationLabel: location,
  excerpt,
});

const lower = (text: string) => text.toLocaleLowerCase("az");

/** Decides what the scripted "model" does, from the words of the question. */
export function answer(conversation: StoredConversation, content: string, attachments: Attachment[], user: User) {
  const messageId = `msg-a${++counter}`;
  const text = lower(content);
  const list: ScriptEvent[] = [];
  const push = (event: string, data: unknown) => list.push({ id: list.length + 1, event, data });
  push("message.started", { messageId });

  let body = NO_SOURCE;
  let citations: Citation[] = [];
  let toolRuns: ToolRun[] = [];
  let approvalList: Approval[] = [];
  let status: Message["status"] = "complete";
  let failAfterText = false;
  let dropAfter: number | null = null;

  if (/yazılış|təsdiqə göndər|arxivlə/.test(text)) {
    const run: ToolRun = {
      id: `t-${counter}`,
      toolName: "ledger.submit_entries",
      riskLevel: "moderate-write",
      status: "approval_required",
      argumentsSummary: "je-seed-3 yazılışını təsdiqə göndər",
      resultSummary: null,
      approvalId: `appr-${counter}`,
    };
    const approval: Approval = {
      id: run.approvalId!,
      toolRunId: run.id,
      toolName: run.toolName,
      argumentsSummary: run.argumentsSummary,
      targetResource: "Jurnal yazılışı je-seed-3",
      riskLevel: "moderate-write",
      requestedBy: { id: user.id, name: user.name },
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
      comment: null,
    };
    approvals.set(approval.id, approval);
    addApprovalRequest({
      id: approval.id,
      kind: "tool_action",
      title: "Jurnal yazılışı təsdiqə göndərilsin",
      summary: approval.argumentsSummary,
      riskLevel: approval.riskLevel,
      status: "pending",
      requestedBy: approval.requestedBy,
      requestedAt: new Date().toISOString(),
      expiresAt: approval.expiresAt,
      decidedBy: null,
      decidedAt: null,
      comment: null,
      changes: [{ label: "Yazılış je-seed-3", before: "Təklif", after: "Təsdiq gözləyir" }],
      source: { type: "conversation", id: conversation.id },
    });
    toolRuns = [run];
    approvalList = [approval];
    push("tool.requested", { toolRun: { ...run, status: "proposed" } });
    push("tool.approval_required", { toolRun: run, approval });
    body = "Yazılışı təsdiqə göndərmək üçün baş mühasibin təsdiqi lazımdır. Təsdiq gələnə qədər heç nə dəyişməyəcək.";
  } else if (attachments.length > 0 || /ədv|qaimə|vergi/.test(text) || /kəsil/.test(text)) {
    const search: ToolRun = {
      id: `t-${counter}`,
      toolName: "legislation.search",
      riskLevel: "read",
      status: "done",
      argumentsSummary: "ƏDV və qaimə-faktura",
      resultSummary: "2 nəticə tapıldı",
      approvalId: null,
    };
    toolRuns = [search];
    push("tool.requested", { toolRun: { ...search, status: "proposed", resultSummary: null } });
    push("tool.started", { toolRun: { ...search, status: "running", resultSummary: null } });
    push("tool.completed", { toolRun: search });
    citations =
      attachments.length > 0
        ? attachments.map((item) =>
            link(item.type, item.id, item.title, `Əlavə etdiyiniz «${item.title}» sənədindən parça.`),
          )
        : [
            link(
              "legislation",
              "leg-tax-code",
              "Vergi Məcəlləsi",
              "ƏDV ödəyiciləri mal və xidmətlərin təqdimatı zamanı elektron qaimə-fakturanı vaxtında təqdim edir.",
              "Maddə 2",
            ),
            link(
              "news",
              "news-vat-deposit-clarification",
              "ƏDV depozit hesabı üzrə izahat dərc olunub",
              "İzahatda ƏDV depozit hesabından istifadə qaydaları barədə suallar cavablandırılır.",
            ),
          ];
    citations.forEach((citation) => push("citation.added", { citation }));
    body =
      attachments.length > 0
        ? "Əlavə etdiyiniz sənədə əsasən: onun məzmunu sualınıza aiddir [1]."
        : "ƏDV ödəyiciləri qaimə-fakturanı vaxtında təqdim etməlidir [1]. Ödənişlər ƏDV depozit hesabı vasitəsilə aparılır [2].";
    if (/kəsil/.test(text)) dropAfter = 8;
  } else if (/xəta/.test(text)) {
    body = "Cavabı hazırlayarkən";
    failAfterText = true;
    status = "failed";
  }

  // Stream the text in small pieces, like a model does.
  const words = body.split(/(?<= )/);
  for (const piece of words) push("message.delta", { text: piece });

  const message: Message = {
    id: messageId,
    role: "assistant",
    content: body,
    createdAt: new Date().toISOString(),
    status,
    citations,
    toolRuns,
    approvals: approvalList,
    modelVersion: MODEL,
    feedback: null,
  };
  if (failAfterText)
    push("message.failed", { code: "UPSTREAM_UNAVAILABLE", message: "The model service is unavailable" });
  else push("message.completed", { message });

  events.set(messageId, list);
  const userMessage: Message = {
    id: `msg-u${counter}`,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
    status: "complete",
    citations: [],
    toolRuns: [],
    approvals: [],
    modelVersion: null,
    feedback: null,
  };
  conversation.messages.push(userMessage, message);
  conversation.updatedAt = new Date().toISOString();
  return { messageId, events: list, dropAfter };
}

export function setFeedback(message: Message, rating: "up" | "down"): void {
  message.feedback = rating;
}

/** Keeps the chat's own copy in step after the queue has accepted a decision. */
export function syncToolApproval(id: string, decision: "approved" | "denied", comment: string | null): void {
  const approval = approvals.get(id);
  if (!approval) return;
  approval.status = decision;
  approval.comment = comment;
  const run = db
    .flatMap((entry) => entry.messages)
    .flatMap((message) => message.toolRuns)
    .find((candidate) => candidate.id === approval.toolRunId);
  if (run) {
    run.status = decision === "approved" ? "done" : "denied";
    run.resultSummary = decision === "approved" ? "Yazılış təsdiqə göndərildi (demo)" : "Əməliyyat rədd edildi";
  }
}
