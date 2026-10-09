import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/api/errors";
import { api } from "@/api/client";
import { streamSse, type SseEvent } from "@/api/sse";
import { assistantKeys, type Attachment } from "./api";
import { initialLive, isTerminal, reduce, type LiveMessage } from "./chatReducer";

/** How the client behaves when a stream breaks. Tests shorten the pause. */
export const chatConfig = { maxResumes: 3, resumeDelayMs: 600 };

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(new DOMException("Aborted", "AbortError"))), {
      once: true,
    });
  });

// By name: the error can come from another realm (browser internals, test environments), where instanceof fails.
const isAbort = (error: unknown) => error instanceof Error && error.name === "AbortError";

export interface ChatSend {
  content: string;
  attachments: Attachment[];
}

/**
 * Sends a message and follows the answer as it streams in.
 * - A stream that breaks is resumed from the last event seen, so the answer is neither lost nor repeated.
 * - Stopping keeps what was written and tells the server to stop spending.
 * - When it ends, the stored conversation is read again and replaces the local copy.
 */
export function useChat(conversationId: string) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<LiveMessage | null>(null);
  const [pending, setPending] = useState<ChatSend | null>(null);
  const abort = useRef<AbortController | null>(null);

  const streaming = live?.status === "streaming";

  const send = useCallback(
    async (request: ChatSend) => {
      const controller = new AbortController();
      abort.current = controller;
      setPending(request);
      let state: LiveMessage = initialLive;
      setLive(state);

      const consume = async (events: AsyncGenerator<SseEvent>) => {
        for await (const event of events) {
          state = reduce(state, event);
          setLive(state);
          if (isTerminal(state)) return;
        }
      };

      try {
        await consume(
          streamSse(`/conversations/${conversationId}/messages`, {
            method: "POST",
            body: request,
            headers: { "Idempotency-Key": crypto.randomUUID() },
            signal: controller.signal,
          }),
        );

        // The connection ended without a final event: resume from where it stopped.
        for (let attempt = 1; !isTerminal(state) && state.id && attempt <= chatConfig.maxResumes; attempt++) {
          await sleep(chatConfig.resumeDelayMs, controller.signal);
          try {
            await consume(
              streamSse(`/messages/${state.id}/events`, {
                lastEventId: String(state.lastEventId),
                signal: controller.signal,
              }),
            );
          } catch (error) {
            if (isAbort(error)) throw error; // anything else: try again, up to the limit
          }
        }
        if (!isTerminal(state)) state = { ...state, status: "failed", error: { code: "NETWORK", message: "" } };
      } catch (error) {
        if (isAbort(error)) {
          state = { ...state, status: "stopped" };
          if (state.id)
            void api.POST("/messages/{id}/stop", { params: { path: { id: state.id } } }).catch(() => undefined);
        } else {
          const code = error instanceof ApiError ? error.code : "NETWORK";
          state = { ...state, status: "failed", error: { code, message: error instanceof Error ? error.message : "" } };
        }
      } finally {
        setLive(state);
        abort.current = null;
      }

      // We gave up reconnecting: keep the local copy with its error so the person can retry, rather than guess what the server holds.
      if (state.status === "failed" && state.error?.code === "NETWORK") return;

      // The server stored the message (it has an id): show the stored copy instead of the local one.
      if (state.id) {
        await queryClient.invalidateQueries({ queryKey: assistantKeys.detail(conversationId) });
        setLive(null);
        setPending(null);
      }
      void queryClient.invalidateQueries({ queryKey: assistantKeys.list });
    },
    [conversationId, queryClient],
  );

  const stop = useCallback(() => abort.current?.abort(), []);
  const dismiss = useCallback(() => {
    setLive(null);
    setPending(null);
  }, []);

  return { live, pending, streaming, send, stop, dismiss };
}
