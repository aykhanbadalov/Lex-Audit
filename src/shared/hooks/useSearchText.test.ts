import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchText } from "./useSearchText";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useSearchText", () => {
  it("updates the text immediately but commits once, after the pause", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useSearchText(undefined, commit));

    act(() => result.current.onTextChange("Ə"));
    act(() => result.current.onTextChange("ƏD"));
    act(() => result.current.onTextChange("ƏDV"));
    expect(result.current.text).toBe("ƏDV");
    expect(commit).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("ƏDV");
  });

  it("commits undefined for blank text, so the filter is removed from the URL", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useSearchText("ƏDV", commit));
    act(() => result.current.onTextChange("   "));
    act(() => vi.advanceTimersByTime(300));
    expect(commit).toHaveBeenCalledWith(undefined);
  });

  it("follows an outside change to the URL, such as 'reset filters'", () => {
    const { result, rerender } = renderHook(({ url }) => useSearchText(url, vi.fn()), {
      initialProps: { url: "ƏDV" as string | undefined },
    });
    expect(result.current.text).toBe("ƏDV");
    rerender({ url: undefined });
    expect(result.current.text).toBe("");
  });

  it("does not overwrite characters typed while its own commit was still reaching the URL", () => {
    const { result, rerender } = renderHook(({ url }) => useSearchText(url, vi.fn()), {
      initialProps: { url: undefined as string | undefined },
    });

    act(() => result.current.onTextChange("ab"));
    act(() => vi.advanceTimersByTime(300)); // "ab" is committed
    act(() => result.current.onTextChange("abc")); // user keeps typing before the URL echo arrives
    rerender({ url: "ab" }); // the echo of the first commit arrives

    expect(result.current.text).toBe("abc");
  });
});
