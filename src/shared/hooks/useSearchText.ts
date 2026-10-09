import { useEffect, useRef, useState } from "react";

/**
 * A search box whose value is mirrored into the URL after a short pause.
 *
 * - Typing stays instant: the text is local state; only the (debounced) commit touches the URL and the API.
 * - An outside change to the URL (back button, "reset filters") updates the text.
 * - The echo of our own commit does NOT overwrite the text, so characters typed while the URL was updating
 *   are never lost.
 */
export function useSearchText(
  urlValue: string | undefined,
  commit: (value: string | undefined) => void,
  delayMs = 300,
) {
  const external = urlValue ?? "";
  const [text, setText] = useState(external);
  const [seen, setSeen] = useState(external);
  const [committed, setCommitted] = useState(external);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestCommit = useRef(commit);

  useEffect(() => {
    latestCommit.current = commit;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  // Adjust state while rendering when the URL value changed (the pattern React recommends over an effect).
  if (external !== seen) {
    setSeen(external);
    if (external !== committed) {
      setText(external);
      setCommitted(external);
    }
  }

  function onTextChange(value: string) {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const trimmed = value.trim();
      setCommitted(trimmed);
      latestCommit.current(trimmed || undefined);
    }, delayMs);
  }

  return { text, onTextChange };
}
