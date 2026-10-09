import { describe, expect, it } from "vitest";
import { wordDiff } from "./diff";

const join = (segments: ReturnType<typeof wordDiff>, keep: Array<"equal" | "added" | "removed">) =>
  segments
    .filter((segment) => keep.includes(segment.type))
    .map((segment) => segment.text)
    .join("");

describe("wordDiff", () => {
  it("reports identical text as a single equal segment", () => {
    expect(wordDiff("eyni mətn", "eyni mətn")).toEqual([{ type: "equal", text: "eyni mətn" }]);
  });

  it("marks replaced words as removed and added", () => {
    const segments = wordDiff("müddət on gündür", "müddət beş gündür");
    expect(segments.some((s) => s.type === "removed" && s.text.includes("on"))).toBe(true);
    expect(segments.some((s) => s.type === "added" && s.text.includes("beş"))).toBe(true);
  });

  it("can rebuild both sides exactly", () => {
    const before = "ƏDV ödəyiciləri qaimə-fakturanı təqdim edir.";
    const after = "ƏDV ödəyiciləri elektron qaimə-fakturanı vaxtında təqdim edir.";
    const segments = wordDiff(before, after);
    expect(join(segments, ["equal", "removed"])).toBe(before);
    expect(join(segments, ["equal", "added"])).toBe(after);
  });

  it("handles an empty side", () => {
    expect(wordDiff("", "yeni")).toEqual([{ type: "added", text: "yeni" }]);
    expect(wordDiff("köhnə", "")).toEqual([{ type: "removed", text: "köhnə" }]);
  });

  it("does not report a whole word as changed when only the full stop moved", () => {
    const segments = wordDiff("qaimə edir.", "qaimə edir və təqdim edir.");
    const removed = segments.filter((segment) => segment.type === "removed");
    expect(removed).toEqual([]);
    expect(join(segments, ["equal", "added"])).toBe("qaimə edir və təqdim edir.");
  });
});
