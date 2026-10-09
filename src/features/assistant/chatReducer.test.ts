import { describe, expect, it } from "vitest";
import { initialTurn, reduce, type LiveTurn, type StreamedEvent } from "./chatReducer";

const ev = (event: string, data: unknown): StreamedEvent => ({ event, data: JSON.stringify(data) });
const run = (events: StreamedEvent[], from: LiveTurn = initialTurn) => events.reduce(reduce, from);

describe("assistant turn", () => {
  it("builds the answer from deltas, then the saved answer replaces it", () => {
    const state = run([
      ev("message.created", { messageId: "u1" }),
      ev("delta", { text: "ƏDV " }),
      ev("delta", { text: "18%" }),
    ]);
    expect(state.content).toBe("ƏDV 18%");
    expect(state.status).toBe("streaming");

    const done = run(
      [
        ev("final", {
          messageId: "a1",
          content: "ƏDV dərəcəsi 18%-dir.",
          citations: [{ label: "VM m.2", chunkId: "c1" }],
          model: "m-1",
        }),
        ev("done", {}),
      ],
      state,
    );
    expect(done).toMatchObject({ status: "complete", messageId: "a1", content: "ƏDV dərəcəsi 18%-dir.", model: "m-1" });
    expect(done.citations).toEqual([{ label: "VM m.2", chunkId: "c1" }]);
  });

  it("follows a tool from running to its outcome, including one that waits for approval", () => {
    const state = run([
      ev("tool.call", { callId: "t1", tool: "ledger.submit_entries", arguments: {} }),
      ev("tool.result", {
        callId: "t1",
        tool: "ledger.submit_entries",
        status: "approval_required",
        summary: "gözləyir",
        toolRunId: "r",
        approvalId: "ap1",
      }),
    ]);
    expect(state.tools).toEqual([
      {
        callId: "t1",
        tool: "ledger.submit_entries",
        status: "approval_required",
        summary: "gözləyir",
        approvalId: "ap1",
      },
    ]);
  });

  it("treats a stream that ends without an answer as a failure", () => {
    expect(run([ev("delta", { text: "yarım" }), ev("done", {})]).status).toBe("failed");
  });

  it("fails on a hard error, but keeps the answer when the agent only ran out of steps", () => {
    expect(run([ev("error", { code: "TIMEOUT", message: "x" }), ev("done", {})]).status).toBe("failed");
    const soft = run([
      ev("error", { code: "STEP_LIMIT", message: "limit" }),
      ev("final", { messageId: "a", content: "Bildiyimi yazıram", citations: [], model: "m" }),
      ev("done", {}),
    ]);
    expect(soft.status).toBe("complete");
    expect(soft.error?.code).toBe("STEP_LIMIT");
  });

  it("skips malformed or unknown events instead of crashing", () => {
    const state = run([
      { event: "delta", data: "{not json" },
      ev("delta", { text: 5 }),
      ev("tool.result", { callId: "x", status: "weird" }),
      ev("something.new", { a: 1 }),
      ev("delta", { text: "ok" }),
    ]);
    expect(state.content).toBe("ok");
    expect(state.tools).toEqual([]);
  });
});
