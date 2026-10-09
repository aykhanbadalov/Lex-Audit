import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/api/errors";
import { streamSse } from "@/api/sse";
import { assistantKeys } from "./api";
import { initialTurn, isFinished, reduce, type LiveTurn, type ToolCall } from "./chatReducer";

const isAbort = (error: unknown) => error instanceof Error && error.name === "AbortError";

/**
 * Sends a message and follows the answer as it streams in.
 * - Stopping closes the connection; the backend notices and stops generating (so it stops costing money).
 * - A dropped connection is not resumed: the backend has no way to continue a stream, so the question can be asked again.
 * - When it ends, the stored conversation is read again and replaces the local copy.
 */
export function useChat(conversationId: string) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<LiveTurn | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  /** What the tools did, kept after the stored answer replaces the live one: the backend stores only their names. */
  const [toolsByMessage, setToolsByMessage] = useState<Record<string, ToolCall[]>>({});
  const abort = useRef<AbortController | null>(null);

  const streaming = live?.status === "streaming";

  const send = useCallback(
    async (content: string) => {
      const controller = new AbortController();
      abort.current = controller;
      setPending(content);
      let state: LiveTurn = initialTurn;
      setLive(state);

      try {
        for await (const event of streamSse(`/conversations/${conversationId}/messages`, {
          method: "POST",
          body: { content },
          headers: { "Idempotency-Key": crypto.randomUUID() },
          signal: controller.signal,
        })) {
          state = reduce(state, event);
          setLive(state);
          if (isFinished(state) && event.event === "done") break;
        }
        if (!isFinished(state)) state = { ...state, status: "failed", error: { code: "NETWORK", message: "" } };
      } catch (error) {
        if (isAbort(error)) {
          state = { ...state, status: "stopped" };
        } else {
          const code = error instanceof ApiError ? error.code : "NETWORK";
          state = { ...state, status: "failed", error: { code, message: error instanceof Error ? error.message : "" } };
        }
      } finally {
        setLive(state);
        abort.current = null;
      }

      // The backend saves a finished answer; show the stored copy instead of the local one. An answer that failed or was
      // stopped is not saved, so the local copy stays: it keeps the words already written, the error and the retry button.
      await queryClient.invalidateQueries({ queryKey: assistantKeys.detail(conversationId) });
      if (state.status === "complete") {
        const savedId = state.messageId;
        if (savedId && state.tools.length > 0) setToolsByMessage((known) => ({ ...known, [savedId]: state.tools }));
        setLive(null);
        setPending(null);
      }
      void queryClient.invalidateQueries({ queryKey: assistantKeys.list });
      // A request the assistant opened shows up in the approval queue.
      if (state.tools.some((tool) => tool.status === "approval_required")) {
        void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      }
    },
    [conversationId, queryClient],
  );

  const stop = useCallback(() => abort.current?.abort(), []);
  const dismiss = useCallback(() => {
    setLive(null);
    setPending(null);
  }, []);

  return { live, pending, streaming, toolsByMessage, send, stop, dismiss };
}
