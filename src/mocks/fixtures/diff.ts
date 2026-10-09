import type { components } from "../draft/schema";

type Segment = components["schemas"]["DiffSegment"];

/**
 * Word-level diff (longest common subsequence). Whitespace and punctuation are their own tokens, so text rebuilds
 * exactly and a changed full stop is not reported as a whole changed word.
 */
const TOKEN_SPLIT = /(\s+|[.,;:!?()"«»])/;

export function wordDiff(before: string, after: string): Segment[] {
  const a = before.split(TOKEN_SPLIT).filter(Boolean);
  const b = after.split(TOKEN_SPLIT).filter(Boolean);

  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const segments: Segment[] = [];
  const push = (type: Segment["type"], text: string) => {
    const last = segments[segments.length - 1];
    if (last?.type === type) last.text += text;
    else segments.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("equal", a[i]!);
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      push("removed", a[i]!);
      i++;
    } else {
      push("added", b[j]!);
      j++;
    }
  }
  while (i < a.length) push("removed", a[i++]!);
  while (j < b.length) push("added", b[j++]!);
  return segments;
}
