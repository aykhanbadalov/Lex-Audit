import { describe, expect, it } from "vitest";
import type { SseEvent } from "@/api/sse";
import { initialLive, isTerminal, reduce, type LiveMessage } from "./chatReducer";

const ev = (id: number | null, event: string, data: unknown): SseEvent => ({
  id: id === null ? null : String(id),
  event,
  data: JSON.stringify(data),
});
const run = (events: SseEvent[], from: LiveMessage = initialLive) => events.reduce(reduce, from);
const citation = (id: string) => ({
  id,
  resourceType: "legislation",
  resourceId: "leg-tax-code",
  title: "Vergi Məcəlləsi",
  locationLabel: "Maddə 2",
  excerpt: "…",
});
const toolRun = (status: string) => ({
  id: "t1",
  toolName: "legislation.search",
  riskLevel: "read",
  status,
  argumentsSummary: "ƏDV",
  resultSummary: null,
  approvalId: null,
});

describe("chat reducer", () => {
  it("builds the answer from deltas, in order", () => {
    const state = run([
      ev(1, "message.started", { messageId: "m1" }),
      ev(2, "message.delta", { text: "ƏDV " }),
      ev(3, "message.delta", { text: "18%-dir." }),
    ]);
    expect(state).toMatchObject({ id: "m1", content: "ƏDV 18%-dir.", status: "streaming", lastEventId: 3 });
    expect(isTerminal(state)).toBe(false);
  });

  it("ignores events it has already applied, so resuming a dropped stream cannot duplicate text", () => {
    const first = run([
      ev(1, "message.started", { messageId: "m1" }),
      ev(2, "message.delta", { text: "A" }),
      ev(3, "message.delta", { text: "B" }),
    ]);
    // The server replays from the start on resume; ids 1-3 are old news.
    const resumed = run(
      [
        ev(2, "message.delta", { text: "A" }),
        ev(3, "message.delta", { text: "B" }),
        ev(4, "message.delta", { text: "C" }),
      ],
      first,
    );
    expect(resumed.content).toBe("ABC");
    expect(resumed.lastEventId).toBe(4);
  });

  it("collects each citation once, even when it is announced twice", () => {
    const state = run([
      ev(1, "citation.added", { citation: citation("c1") }),
      ev(2, "citation.added", { citation: citation("c1") }),
      ev(3, "citation.added", { citation: citation("c2") }),
    ]);
    expect(state.citations.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("follows a tool run through its states without duplicating it", () => {
    const state = run([
      ev(1, "tool.requested", { toolRun: toolRun("proposed") }),
      ev(2, "tool.started", { toolRun: toolRun("running") }),
      ev(3, "tool.completed", { toolRun: { ...toolRun("done"), resultSummary: "2 nəticə" } }),
    ]);
    expect(state.toolRuns).toHaveLength(1);
    expect(state.toolRuns[0]).toMatchObject({ status: "done", resultSummary: "2 nəticə" });
  });

  it("keeps the approval that a write tool is waiting for", () => {
    const approval = { id: "a1", toolRunId: "t1", status: "pending" };
    const state = run([ev(1, "tool.approval_required", { toolRun: toolRun("approval_required"), approval })]);
    expect(state.approvals).toEqual([approval]);
    expect(state.toolRuns[0]?.status).toBe("approval_required");
  });

  it("lets the stored message replace what was assembled, and finishes", () => {
    const message = { id: "m1", content: "Son mətn.", citations: [citation("c9")], toolRuns: [], approvals: [] };
    const state = run([
      ev(1, "message.started", { messageId: "m1" }),
      ev(2, "message.delta", { text: "yarımçıq" }),
      ev(3, "message.completed", { message }),
    ]);
    expect(state).toMatchObject({ content: "Son mətn.", status: "complete" });
    expect(state.citations.map((c) => c.id)).toEqual(["c9"]);
    expect(isTerminal(state)).toBe(true);
  });

  it("keeps the partial text and the reason when the model fails", () => {
    const state = run([
      ev(1, "message.delta", { text: "Yarım" }),
      ev(2, "message.failed", { code: "UPSTREAM_UNAVAILABLE", message: "x" }),
    ]);
    expect(state).toMatchObject({ content: "Yarım", status: "failed", error: { code: "UPSTREAM_UNAVAILABLE" } });
  });

  it("skips malformed or unknown events instead of breaking the stream", () => {
    const state = run([
      { id: "1", event: "message.delta", data: "not json" },
      ev(2, "message.delta", { text: 42 }),
      ev(3, "something.new", { x: 1 }),
      ev(4, "message.delta", { text: "ok" }),
    ]);
    expect(state.content).toBe("ok");
    expect(state.status).toBe("streaming");
  });

  it("applies events that carry no id (they cannot be deduplicated)", () => {
    expect(run([ev(null, "message.delta", { text: "a" }), ev(null, "message.delta", { text: "b" })]).content).toBe(
      "ab",
    );
  });
});
