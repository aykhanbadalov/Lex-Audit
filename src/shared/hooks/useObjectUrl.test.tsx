import { render, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useObjectUrl } from "./useObjectUrl";

let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  let counter = 0;
  Object.assign(URL, {
    createObjectURL: vi.fn(() => {
      const url = `blob:test-${++counter}`;
      created.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => revoked.push(url)),
  });
});
afterEach(() => vi.restoreAllMocks());

describe("useObjectUrl", () => {
  it("returns nothing without a blob and creates no URL", () => {
    const { result } = renderHook(() => useObjectUrl(undefined));
    expect(result.current).toBeNull();
    expect(created).toEqual([]);
  });

  it("creates a URL for the blob and revokes it when the component goes away", () => {
    const blob = new Blob(["x"]);
    const { result, unmount } = renderHook(() => useObjectUrl(blob));
    expect(result.current).toBe("blob:test-1");
    expect(revoked).toEqual([]);

    unmount();
    expect(revoked).toEqual(["blob:test-1"]);
  });

  it("revokes the old URL and makes a new one when the blob changes", () => {
    const first = new Blob(["a"]);
    const second = new Blob(["b"]);
    const { result, rerender } = renderHook(({ blob }) => useObjectUrl(blob), { initialProps: { blob: first } });
    expect(result.current).toBe("blob:test-1");

    rerender({ blob: second });
    expect(result.current).toBe("blob:test-2");
    expect(revoked).toContain("blob:test-1");
  });

  it("still ends with a live URL when React mounts, unmounts and remounts it (StrictMode)", () => {
    const blob = new Blob(["x"]);
    let shown: string | null = null;
    function Probe() {
      shown = useObjectUrl(blob);
      return null;
    }
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    expect(shown).not.toBeNull();
    // The URL being shown is one that was created and not revoked afterwards.
    expect(created).toContain(shown);
    expect(revoked).not.toContain(shown);
  });
});
