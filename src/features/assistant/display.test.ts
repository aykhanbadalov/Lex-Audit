import { describe, expect, it } from "vitest";
import type { StoredMessage } from "./api";
import { fromStoredList } from "./display";

const message = (patch: Partial<StoredMessage>): StoredMessage => ({
  id: "m",
  role: "assistant",
  content: "",
  citations: [],
  toolCalls: null,
  modelVersion: null,
  createdAt: "2026-10-09T10:00:00Z",
  ...patch,
});

describe("fromStoredList", () => {
  it("shows a tool-only step on the answer that follows it, not as an empty message of its own", () => {
    const list = fromStoredList([
      message({ id: "q", role: "user", content: "ƏDV nədir?" }),
      message({ id: "step", toolCalls: [{ id: "c1", name: "legislation.search" }] }),
      message({ id: "answer", content: "18%", toolCalls: [{ id: "c2", name: "news.search" }] }),
    ]);
    expect(list.map((item) => item.id)).toEqual(["q", "answer"]);
    expect(list[1]!.tools).toEqual([{ tool: "legislation.search" }, { tool: "news.search" }]);
  });

  it("does not carry tools over to a later answer", () => {
    const list = fromStoredList([
      message({ id: "step", toolCalls: [{ id: "c1", name: "legislation.search" }] }),
      message({ id: "a1", content: "bir" }),
      message({ id: "a2", content: "iki" }),
    ]);
    expect(list[1]!.tools).toEqual([]);
  });

  it("keeps the statuses learned from a stream in place of bare names", () => {
    const known = {
      answer: [
        { callId: "c", tool: "legislation.search", status: "succeeded" as const, summary: null, approvalId: null },
      ],
    };
    const list = fromStoredList(
      [message({ id: "answer", content: "x", toolCalls: [{ id: "c", name: "legislation.search" }] })],
      known,
    );
    expect(list[0]!.tools).toEqual(known.answer);
  });
});
