import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "@/api/client";
import { streamSse } from "@/api/sse";
import { chatConfig } from "@/features/assistant/useChat";
import { apiPath } from "@/mocks/handlers/base";
import { setMockRefreshUser } from "@/mocks/refreshCookie";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/shared/stores/authStore";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

beforeEach(() => {
  chatConfig.resumeDelayMs = 0;
});

afterEach(() => {
  server.events.removeAllListeners();
  chatConfig.maxResumes = 3;
});

const box = () => screen.findByLabelText("Mesajınız");
async function ask(text: string) {
  await userEvent.type(await box(), `${text}{Enter}`);
}
const answers = () => screen.queryAllByText(/ƏDV ödəyiciləri qaimə-fakturanı vaxtında təqdim etməlidir/);

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

/** Starts a stream that writes one piece and then never finishes, so stopping can be tested. */
function stallingStream() {
  const first =
    'id: 1\nevent: message.started\ndata: {"messageId":"msg-stall"}\n\nid: 2\nevent: message.delta\ndata: {"text":"Yazılır"}\n\n';
  server.use(
    http.post(
      apiPath("/conversations/:id/messages"),
      () =>
        new HttpResponse(
          new ReadableStream({ start: (controller) => controller.enqueue(new TextEncoder().encode(first)) }),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
    ),
  );
}

describe("a grounded answer", () => {
  it("streams in, shows its sources as links, and the stored copy replaces the live one without a duplicate", async () => {
    signInAs();
    renderApp("/assistant/conv-2");
    await ask("ƏDV qaimə haqqında soruşuram");

    expect(await screen.findByText(/qaimə-fakturanı vaxtında təqdim etməlidir \[1\]/)).toBeInTheDocument();
    const sources = await screen.findByRole("region", { name: "Mənbələr" });
    expect(within(sources).getByRole("link", { name: /Vergi Məcəlləsi — Maddə 2/ })).toHaveAttribute(
      "href",
      "/legislation/leg-tax-code",
    );
    expect(within(sources).getByRole("link", { name: /ƏDV depozit hesabı üzrə izahat/ })).toHaveAttribute(
      "href",
      "/news/news-vat-deposit-clarification",
    );
    expect(screen.getByText("Qanunvericilikdə axtarış")).toBeInTheDocument();
    expect(screen.getByText("2 nəticə tapıldı")).toBeInTheDocument();

    // After the stream ends the stored message takes over: still exactly one answer and one user message.
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Cavab faydalı oldu" })).toHaveLength(1));
    expect(answers()).toHaveLength(1);
    expect(screen.getAllByText("ƏDV qaimə haqqında soruşuram")).toHaveLength(1);
  });

  it("refuses to answer a legal question it has no source for, instead of inventing one", async () => {
    signInAs();
    renderApp("/assistant/conv-2");
    await ask("Hava necə olacaq?");
    expect(await screen.findByText(/mənbə tapılmadı/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Mənbələr" })).not.toBeInTheDocument();
  });

  it("uses the resource the user attached, and sends it with the question", async () => {
    signInAs();
    const bodies = record(posted("/messages"));
    renderApp(
      "/assistant/conv-2?contextType=news&contextId=news-einvoice-bill&contextTitle=E-qaim%C9%99%20layih%C9%99si",
    );
    expect(await screen.findByText("Xəbər: E-qaimə layihəsi")).toBeInTheDocument();

    await ask("Bu nə deməkdir?");

    const sources = await screen.findByRole("region", { name: "Mənbələr" });
    expect(within(sources).getByRole("link", { name: /E-qaimə layihəsi/ })).toHaveAttribute(
      "href",
      "/news/news-einvoice-bill",
    );
    expect((bodies[0] as { attachments: unknown[] }).attachments).toEqual([
      { type: "news", id: "news-einvoice-bill", title: "E-qaimə layihəsi" },
    ]);
    expect(screen.queryByText("Xəbər: E-qaimə layihəsi")).not.toBeInTheDocument(); // sent once, not attached to the next question too
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
    expect(bodies).toHaveLength(0);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect((bodies[0] as { content: string }).content).toBe("birinci\nikinci");
  });

  it("does not send while an input method is still composing a character", async () => {
    signInAs();
    const bodies = record(posted("/messages"));
    renderApp("/assistant/conv-2");
    const field = await box();
    fireEvent.change(field, { target: { value: "ə" } });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(bodies).toHaveLength(0);
  });
});

describe("when the stream does not go to plan", () => {
  it("stops on request, keeps what was written, and tells the server to stop spending", async () => {
    signInAs();
    stallingStream();
    let stopped = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.url.endsWith("/stop")) stopped++;
    });
    // What the server stores once it has been told to stop.
    server.use(
      http.get(apiPath("/conversations/conv-2"), () =>
        HttpResponse.json({
          id: "conv-2",
          title: "x",
          updatedAt: "2026-10-07T08:00:00Z",
          archived: false,
          messages: [
            {
              id: "msg-stall",
              role: "assistant",
              content: "Yazılır",
              createdAt: "2026-10-07T08:00:00Z",
              status: "stopped",
              toolRuns: [],
              approvals: [],
              citations: [],
              modelVersion: null,
              feedback: null,
            },
          ],
        }),
      ),
    );
    renderApp("/assistant/conv-2");
    await ask("uzun sual");
    expect((await screen.findAllByText("Yazılır")).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Dayandır" }));

    expect(await screen.findByText("Cavab dayandırıldı.")).toBeInTheDocument();
    expect(screen.getAllByText("Yazılır").length).toBeGreaterThan(0);
    await waitFor(() => expect(stopped).toBe(1));
  });

  it("shows a failed answer as failed, keeps the partial text, and asks again on request", async () => {
    signInAs();
    const bodies = record(posted("/messages"));
    renderApp("/assistant/conv-2");
    await ask("xəta olsun");

    expect(await screen.findByRole("alert")).toHaveTextContent("Cavab yarımçıq qaldı.");
    expect(screen.getByText(/Cavabı hazırlayarkən/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Yenidən soruş" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect((bodies[1] as { content: string }).content).toBe("xəta olsun");
  });

  it("resumes a dropped connection from the last event, without losing or repeating any text", async () => {
    signInAs();
    const lastIds: (string | null)[] = [];
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/events")) lastIds.push(request.headers.get("Last-Event-ID"));
    });
    renderApp("/assistant/conv-2");

    await ask("ƏDV haqqında kəsilən bağlantı");

    await waitFor(() => expect(screen.getByRole("button", { name: "Cavab faydalı oldu" })).toBeInTheDocument());
    expect(lastIds).toEqual(["8"]);
    expect(answers()).toHaveLength(1);
    expect(within(screen.getByRole("region", { name: "Mənbələr" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("gives up with a clear failure when the connection keeps dropping", async () => {
    signInAs();
    chatConfig.maxResumes = 2;
    server.use(http.get(apiPath("/messages/:id/events"), () => HttpResponse.error()));
    renderApp("/assistant/conv-2");
    await ask("ƏDV haqqında kəsilən bağlantı");
    expect(await screen.findByRole("alert")).toHaveTextContent("Cavab yarımçıq qaldı.");
    chatConfig.maxResumes = 3;
  });

  it("reports a refusal from the server (rate limit) as a failure, not as an empty answer", async () => {
    signInAs();
    server.use(
      http.post(apiPath("/conversations/:id/messages"), () =>
        HttpResponse.json({ error: { code: "RATE_LIMITED", message: "slow down", requestId: "r" } }, { status: 429 }),
      ),
    );
    renderApp("/assistant/conv-2");
    await ask("ƏDV");
    expect(await screen.findByRole("alert")).toHaveTextContent("Cavab yarımçıq qaldı.");
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
          updatedAt: "2026-10-07T08:00:00Z",
          archived: false,
          messages: [
            {
              id: "m-evil",
              role: "assistant",
              content: text,
              createdAt: "2026-10-07T08:00:00Z",
              status: "complete",
              toolRuns: [],
              approvals: [],
              citations: [],
              modelVersion: null,
              feedback: null,
            },
          ],
        }),
      ),
    );
    const { container } = renderApp("/assistant/conv-2");
    await screen.findByText("mətn");
    expect(container.querySelector("script, img, iframe, [onerror]")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.example");
    expect(container.querySelector("a[href^='javascript']")).toBeNull();
  });

  it("shows a citation excerpt as plain text", async () => {
    signInAs();
    server.use(
      http.get(apiPath("/conversations/conv-2"), () =>
        HttpResponse.json({
          id: "conv-2",
          title: "x",
          updatedAt: "2026-10-07T08:00:00Z",
          archived: false,
          messages: [
            {
              id: "m1",
              role: "assistant",
              content: "Cavab [1]",
              createdAt: "2026-10-07T08:00:00Z",
              status: "complete",
              toolRuns: [],
              approvals: [],
              modelVersion: null,
              feedback: null,
              citations: [
                {
                  id: "c1",
                  resourceType: "legislation",
                  resourceId: "leg-tax-code",
                  title: "T",
                  locationLabel: null,
                  excerpt: '<img src=x onerror="alert(1)"> mətn',
                },
              ],
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

describe("approvals", () => {
  async function requestAsAccountant() {
    signInAs("muhasib@lexaudit.test");
    const { id } = (await api.POST("/conversations", { body: {} })).data!;
    for await (const event of streamSse(`/conversations/${id}/messages`, {
      method: "POST",
      body: { content: "yazılışı təsdiqə göndər", attachments: [] },
      headers: { "Idempotency-Key": "k" },
    }))
      void event;
    return id;
  }

  it("tells the person who asked that someone else must approve, and gives them no button", async () => {
    const id = await requestAsAccountant();
    renderApp(`/assistant/${id}`);
    expect(await screen.findByText(/başqa şəxs təsdiq etməlidir/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Təsdiq et" })).not.toBeInTheDocument();
  });

  it("lets a different person with the permission approve it, and the card then shows the result", async () => {
    const id = await requestAsAccountant();
    signInAs("bas.muhasib@lexaudit.test");
    const { queryClient } = renderApp(`/assistant/${id}`);
    expect(await screen.findByText(/Aygün Məmmədova bu əməliyyatı istəyir/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Şərh/), "yoxlandı");
    await userEvent.click(screen.getByRole("button", { name: "Təsdiq et" }));

    await act(async () => void (await queryClient.invalidateQueries()));
    expect(await screen.findByText(/Təsdiqlənib: yoxlandı/)).toBeInTheDocument();
    expect(screen.getByText("Yazılış təsdiqə göndərildi (demo)")).toBeInTheDocument();
  });

  it("is refused by the server for the requester, even if the buttons were bypassed", async () => {
    signInAs("bas.muhasib@lexaudit.test"); // the chief accountant asks, then tries to approve their own request
    const { id } = (await api.POST("/conversations", { body: {} })).data!;
    for await (const event of streamSse(`/conversations/${id}/messages`, {
      method: "POST",
      body: { content: "yazılış", attachments: [] },
      headers: { "Idempotency-Key": "k" },
    }))
      void event;
    const conversation = (await api.GET("/conversations/{id}", { params: { path: { id } } })).data!;
    const approvalId = conversation.messages[1]!.approvals[0]!.id;

    await expect(
      api.POST("/approvals/{id}/decide", {
        params: { path: { id: approvalId } },
        body: { decision: "approved", comment: "yoxlandı" },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("is refused by the server for someone without the approval permission, and decided only once", async () => {
    const id = await requestAsAccountant();
    const conversation = (await api.GET("/conversations/{id}", { params: { path: { id } } })).data!;
    const approvalId = conversation.messages[1]!.approvals[0]!.id;
    await expect(
      api.POST("/approvals/{id}/decide", {
        params: { path: { id: approvalId } },
        body: { decision: "approved", comment: "yoxlandı" },
      }),
    ).rejects.toMatchObject({ status: 403 });

    signInAs("bas.muhasib@lexaudit.test");
    await api.POST("/approvals/{id}/decide", {
      params: { path: { id: approvalId } },
      body: { decision: "denied", comment: "yoxlandı" },
    });
    await expect(
      api.POST("/approvals/{id}/decide", {
        params: { path: { id: approvalId } },
        body: { decision: "approved", comment: "yoxlandı" },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("feedback and conversations", () => {
  it("sends a thumbs-up straight away and a thumbs-down with the right answer", async () => {
    signInAs();
    const bodies = record(posted("/feedback"));
    renderApp("/assistant/conv-1");

    await userEvent.click(await screen.findByRole("button", { name: "Cavab faydalı oldu" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ rating: "up" });

    await userEvent.click(screen.getByRole("button", { name: "Cavab düzgün deyil" }));
    await userEvent.type(screen.getByLabelText("Düzgün cavab"), "Düzgün cavab budur");
    await userEvent.click(screen.getByRole("button", { name: "Göndər" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ rating: "down", correction: "Düzgün cavab budur" });
  });

  it("renames a conversation and archives it only after confirmation", async () => {
    signInAs();
    const { router } = renderApp("/assistant/conv-1");
    await userEvent.click(await screen.findByRole("button", { name: "Adını dəyiş" }));
    const field = screen.getByLabelText("Söhbətin adı");
    await userEvent.clear(field);
    await userEvent.type(field, "Yeni ad");
    await userEvent.click(screen.getByRole("button", { name: "Yadda saxla" }));
    expect(await screen.findByRole("link", { name: "Yeni ad" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Arxivə at" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ləğv et" }));
    expect(screen.getByRole("link", { name: "Yeni ad" })).toBeInTheDocument(); // cancelled: still there

    await userEvent.click(screen.getByRole("button", { name: "Arxivə at" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Arxivə at" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/assistant"));
    expect(screen.queryByRole("link", { name: "Yeni ad" })).not.toBeInTheDocument();
  });

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
