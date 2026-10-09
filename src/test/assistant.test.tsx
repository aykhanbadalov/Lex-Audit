import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "@/api/client";
import { apiPath } from "@/mocks/handlers/base";
import { setMockRefreshUser } from "@/mocks/refreshCookie";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/shared/stores/authStore";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();
afterEach(() => server.events.removeAllListeners());

const box = () => screen.findByLabelText("Mesajınız");
async function ask(text: string) {
  await userEvent.type(await box(), `${text}{Enter}`);
}
const answers = () => screen.queryAllByText(/qaimə-fakturanı vaxtında təqdim etməlidir/);

/** Records the JSON body of every request that matches. */
function record(match: (request: Request) => boolean) {
  const bodies: unknown[] = [];
  server.events.on("request:start", async ({ request }) => {
    if (match(request))
      bodies.push(
        await request
          .clone()
          .json()
          .catch(() => null),
      );
  });
  return bodies;
}
const posted = (suffix: string) => (request: Request) =>
  request.method === "POST" && new URL(request.url).pathname.endsWith(suffix);

const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const stream = (...parts: string[]) =>
  new HttpResponse(parts.join(""), { headers: { "Content-Type": "text/event-stream" } });

describe("a grounded answer", () => {
  it("streams in with the tool that was used and its sources, and the stored copy replaces the live one", async () => {
    signInAs();
    renderApp("/assistant/conv-2");
    await ask("ƏDV qaimə haqqında soruşuram");

    expect(await screen.findByText(/qaimə-fakturanı vaxtında təqdim etməlidir \[1\]/)).toBeInTheDocument();
    const sources = await screen.findByRole("region", { name: "Mənbələr" });
    expect(within(sources).getByText("Vergi Məcəlləsi, maddə 2")).toBeInTheDocument();
    expect(within(sources).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Qanunvericilikdə axtarış")).toBeInTheDocument();
    expect(screen.getByText("2 nəticə tapıldı")).toBeInTheDocument();

    // After the stream ends the stored messages take over: still one question and one answer, with feedback offered.
    await waitFor(() => expect(screen.getByRole("button", { name: "Cavab faydalı oldu" })).toBeInTheDocument());
    expect(answers()).toHaveLength(1);
    expect(within(screen.getByRole("log")).getAllByText("ƏDV qaimə haqqında soruşuram")).toHaveLength(1);
  });

  it("says it found no source when nothing matches, instead of inventing one", async () => {
    signInAs();
    renderApp("/assistant/conv-2");
    await ask("Hava necə olacaq?");
    expect(await screen.findByText(/mənbə tapılmadı/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Mənbələr" })).not.toBeInTheDocument();
  });

  it("starts the question about a news item, a law or an invoice with its name and id, so the assistant's tools can read it", async () => {
    signInAs();
    renderApp(
      "/assistant/conv-2?contextType=news&contextId=news-einvoice-bill&contextTitle=E-qaim%C9%99%20layih%C9%99si",
    );
    expect(await box()).toHaveValue("Xəbər «E-qaimə layihəsi» (id: news-einvoice-bill): ");
  });
});

describe("starting a conversation", () => {
  it("creates it from the first message and sends that message exactly once", async () => {
    signInAs();
    const sends = record(posted("/messages"));
    const { router } = renderApp("/assistant");

    await ask("ƏDV haqqında");

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/assistant\/conv-n/));
    expect(await screen.findByText(/qaimə-fakturanı vaxtında təqdim etməlidir/)).toBeInTheDocument();
    expect(sends).toHaveLength(1);
    expect((sends[0] as { content: string }).content).toBe("ƏDV haqqında");
  });
});

describe("keyboard", () => {
  it("sends on Enter, writes a new line on Shift+Enter, and never sends an empty message", async () => {
    signInAs();
    const bodies = record(posted("/messages"));
    renderApp("/assistant/conv-2");
    const field = await box();

    await userEvent.type(field, "{Enter}");
    await userEvent.type(field, "   {Enter}");
    expect(bodies).toHaveLength(0);
    await userEvent.clear(field);

    await userEvent.type(field, "birinci{Shift>}{Enter}{/Shift}ikinci");
    expect(field).toHaveValue("birinci\nikinci");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect((bodies[0] as { content: string }).content).toBe("birinci\nikinci");
  });

  it("does not send while an input method is still composing a character", async () => {
    signInAs();
    const bodies = record(posted("/messages"));
    renderApp("/assistant/conv-2");
    const field = await box();
    await userEvent.type(field, "ə");
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }));
    expect(bodies).toHaveLength(0);
  });
});

describe("when the stream does not go to plan", () => {
  it("stops on request: the connection is closed, what was written stays, and the box is free again", async () => {
    signInAs();
    server.use(
      http.post(apiPath("/conversations/:id/messages"), () => {
        return new HttpResponse(
          new ReadableStream({
            start: (controller) =>
              controller.enqueue(
                new TextEncoder().encode(
                  event("message.created", { messageId: "u" }) + event("delta", { text: "Yazılır" }),
                ),
              ),
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }),
    );
    renderApp("/assistant/conv-2");
    await ask("uzun sual");
    expect(await screen.findByText("Yazılır")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Dayandır" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Göndər" })).toBeInTheDocument());
    expect(screen.getByText("Yazılır")).toBeInTheDocument();
    expect(screen.getByText("Cavab dayandırıldı.")).toBeInTheDocument();
  });

  it("shows an error event as a failed answer, keeps what was written and asks again on request", async () => {
    signInAs();
    const bodies = record(posted("/messages"));
    renderApp("/assistant/conv-2");
    await ask("xəta olsun");

    expect(await screen.findByRole("alert")).toHaveTextContent("Cavab yarımçıq qaldı.");
    expect(screen.getByText(/Cavab hazırlanır/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Yenidən soruş" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect((bodies[1] as { content: string }).content).toBe("xəta olsun");
  });

  it("treats a stream that just ends, with no answer, as a failure", async () => {
    signInAs();
    server.use(
      http.post(apiPath("/conversations/:id/messages"), () =>
        stream(event("delta", { text: "yarım" }), event("done", {})),
      ),
    );
    renderApp("/assistant/conv-2");
    await ask("sual");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it.each([
    [409, "CONFLICT", "Assistent hələ əvvəlki suala cavab verir."],
    [429, "RATE_LIMITED", "Çox mesaj göndərildi."],
    [503, "UPSTREAM_UNAVAILABLE", "Dil modeli hazırda əlçatan deyil."],
  ])("reports a %i from the backend in plain words", async (status, code, message) => {
    signInAs();
    server.use(
      http.post(apiPath("/conversations/:id/messages"), () =>
        HttpResponse.json({ error: { code, message: "x", requestId: "r" } }, { status }),
      ),
    );
    renderApp("/assistant/conv-2");
    await ask("sual");
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("refreshes an expired session before opening the stream", async () => {
    setMockRefreshUser("muhasib@lexaudit.test");
    signInAs();
    renderApp("/assistant/conv-2");
    await box();
    useAuthStore.setState({ accessToken: "stale" });
    await ask("ƏDV");
    expect(await screen.findByText(/qaimə-fakturanı vaxtında təqdim etməlidir/)).toBeInTheDocument();
  });
});

describe("what a model writes is never trusted", () => {
  it("renders a poisoned answer inertly: no script, no image to phone home, no javascript link", async () => {
    signInAs();
    const text =
      'mətn\n\n<script>alert(1)</script><img src=x onerror="alert(1)"> ![x](https://evil.example/?s=1) [klik](javascript:alert(1))';
    server.use(
      http.get(apiPath("/conversations/conv-2"), () =>
        HttpResponse.json({
          id: "conv-2",
          title: "x",
          createdAt: "2026-10-07T08:00:00Z",
          updatedAt: "2026-10-07T08:00:00Z",
          messages: [
            {
              id: "m-evil",
              role: "assistant",
              content: text,
              citations: [],
              toolCalls: null,
              modelVersion: null,
              createdAt: "2026-10-07T08:00:00Z",
            },
          ],
        }),
      ),
    );
    const { container } = renderApp("/assistant/conv-2");
    await screen.findByText("mətn");
    expect(container.querySelector("script, img:not([src='/favicon.svg']), iframe, [onerror]")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.example");
    expect(container.querySelector("a[href^='javascript']")).toBeNull();
  });

  it("shows a source label as plain text", async () => {
    signInAs();
    server.use(
      http.get(apiPath("/conversations/conv-2"), () =>
        HttpResponse.json({
          id: "conv-2",
          title: "x",
          createdAt: "2026-10-07T08:00:00Z",
          updatedAt: "2026-10-07T08:00:00Z",
          messages: [
            {
              id: "m1",
              role: "assistant",
              content: "Cavab [1]",
              citations: [
                { label: '<img src=x onerror="alert(1)"> mənbə', chunkId: "11111111-1111-4111-8111-111111111111" },
              ],
              toolCalls: null,
              modelVersion: null,
              createdAt: "2026-10-07T08:00:00Z",
            },
          ],
        }),
      ),
    );
    const { container } = renderApp("/assistant/conv-2");
    await screen.findByText(/<img src=x/);
    expect(container.querySelector("img[src='x']")).toBeNull();
  });
});

describe("changes need a second person", () => {
  it("shows that a change waits for approval, with a way to the queue, and opens a request only somebody else can decide", async () => {
    signInAs();
    renderApp("/assistant/conv-2");
    await ask("yazılışı təsdiqə göndər");

    // The live answer is replaced by the stored one when it ends; wait for the dust to settle before looking.
    await waitFor(() => expect(screen.getByText("Dəyişiklik başqa şəxsin təsdiqini gözləyir.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Təsdiqlərə bax" })).toHaveAttribute(
      "href",
      expect.stringContaining("/approvals"),
    );

    const queue = (await api.GET("/approvals")).data!;
    const request = queue.find((item) => item.kind === "tool:ledger.submit_entries")!;
    expect(request.status).toBe("pending");
    await expect(
      api.POST("/approvals/{id}/decide", {
        params: { path: { id: request.id } },
        body: { decision: "approve", comment: "ok" },
      }),
    ).rejects.toMatchObject({ status: 403 }); // the accountant who asked cannot approve it
  });
});

describe("feedback", () => {
  it("sends a thumbs-up straight away, and a thumbs-down together with the right answer", async () => {
    signInAs();
    const bodies = record(posted("/feedback"));
    const first = renderApp("/assistant/conv-1");
    await userEvent.click(await screen.findByRole("button", { name: "Cavab faydalı oldu" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ kind: "thumbs", value: "up" });
    first.unmount();

    renderApp("/assistant/conv-1");
    await userEvent.click(await screen.findByRole("button", { name: "Cavab düzgün deyil" }));
    await userEvent.type(screen.getByLabelText("Düzgün cavab"), "Düzgün cavab budur");
    await userEvent.click(screen.getByRole("button", { name: "Göndər" }));
    await waitFor(() => expect(bodies).toHaveLength(3));
    expect(bodies[1]).toEqual({ kind: "thumbs", value: "down" });
    expect(bodies[2]).toEqual({ kind: "correction", correction: "Düzgün cavab budur" });
  });
});

describe("access", () => {
  it("shows 'not found' for an unknown conversation", async () => {
    signInAs();
    renderApp("/assistant/nope");
    expect(await screen.findByText("Söhbət tapılmadı")).toBeInTheDocument();
  });

  it("shows permission-denied, and never calls the API, to someone who may not use the assistant", async () => {
    signInAs("viewer@lexaudit.test");
    let called = false;
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/conversations")) called = true;
    });
    renderApp("/assistant");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
