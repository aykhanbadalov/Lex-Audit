import { describe, expect, it } from "vitest";
import { describeSummary } from "./toolSummary";

const t = (key: string, options?: Record<string, unknown>) =>
  `${key}${options?.count !== undefined ? `:${options.count}` : ""}`;

describe("describeSummary", () => {
  it("turns a list of results into a count, and an empty list into 'nothing found'", () => {
    expect(describeSummary('{"results":[{"a":1},{"a":2}]}', t)).toBe("assistant.toolSummary.results:2");
    expect(describeSummary('{"results":[],"note":"x"}', t)).toBe("assistant.toolSummary.none");
  });
  it("shows a note or an error as it is", () => {
    expect(describeSummary('{"note":"No source found"}', t)).toBe("No source found");
    expect(describeSummary('{"error":"TOO_MANY_TOOL_CALLS"}', t)).toBe("TOO_MANY_TOOL_CALLS");
  });
  it("leaves a plain sentence alone and shortens a very long one", () => {
    expect(describeSummary("Yazılış təsdiq gözləyir", t)).toBe("Yazılış təsdiq gözləyir");
    expect(describeSummary("x".repeat(300), t)).toHaveLength(201);
  });
});
