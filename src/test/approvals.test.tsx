import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "@/api/client";
import { streamSse } from "@/api/sse";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

const CHIEF = "bas.muhasib@lexaudit.test";
const cards = () => screen.findAllByRole("article");
const titles = (list: HTMLElement[]) => list.map((card) => within(card).getByRole("heading").textContent);
const decide = (id: string, decision: "approved" | "denied", comment = "yoxlandı") =>
  api.POST("/approvals/{id}/decide", { params: { path: { id } }, body: { decision, comment } });

function recordRequests() {
  const urls: string[] = [];
  server.events.on("request:start", ({ request }) => void urls.push(request.url));
  return urls;
}

describe("the approval queue", () => {
  it("opens on what is waiting, soonest deadline first, with what will change", async () => {
    signInAs(CHIEF);
    renderApp("/approvals");

    const list = await cards();
    expect(titles(list)).toEqual([
      "Rəşad Əliyev: qaimələrə yazma icazəsi",
      "Güzəştli ƏDV dərəcəsi: tikinti-quraşdırma",
      "Qaimə çıxarışı modeli v7",
    ]);
    // Before and after are shown side by side, as a real table.
    const model = within(list[2]!);
    expect(
      model.getByRole("row", { name: /Aktiv model.*invoice-extractor v6.*invoice-extractor v7/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sizin qərarınızı gözləyən: 3")).toBeInTheDocument();
  });

  it("will not accept a decision without a comment, then approves and moves the request out of the waiting list", async () => {
    signInAs(CHIEF);
    renderApp("/approvals");
    const [access] = await cards();
    const approve = within(access!).getByRole("button", { name: "Təsdiq et" });
    const deny = within(access!).getByRole("button", { name: "Rədd et" });
    expect(approve).toBeDisabled();
    expect(deny).toBeDisabled();

    await userEvent.type(within(access!).getByLabelText(/Şərh/), "ab");
    expect(approve).toBeDisabled(); // too short to mean anything
    await userEvent.type(within(access!).getByLabelText(/Şərh/), "c");
    await userEvent.click(approve);

    await waitFor(() => expect(screen.queryByText("Rəşad Əliyev: qaimələrə yazma icazəsi")).not.toBeInTheDocument());
    expect(screen.getByText("Sizin qərarınızı gözləyən: 2")).toBeInTheDocument();
  });

  it("keeps decided and expired requests readable, with who decided and why, and no buttons", async () => {
    signInAs(CHIEF);
    renderApp("/approvals?status=all");
    const list = await screen.findAllByRole("article");
    const done = list.find((card) => card.textContent?.includes("audit jurnalına giriş"))!;
    expect(done).toHaveTextContent("Elçin Həsənov qərar verib");
    expect(done).toHaveTextContent("Auditor tapşırığına uyğundur.");
    const expired = list.find((card) => card.textContent?.includes("Sadələşdirilmiş vergi"))!;
    expect(within(expired).getByText("Müddəti bitib")).toBeInTheDocument();
    expect(within(done).queryByRole("button")).not.toBeInTheDocument();
    expect(within(expired).queryByRole("button")).not.toBeInTheDocument();
  });

  it("filters by type from the URL", async () => {
    signInAs(CHIEF);
    renderApp("/approvals?kind=model_release");
    const list = await cards();
    expect(titles(list)).toEqual(["Qaimə çıxarışı modeli v7"]);
  });

  it("tells the person who asked that someone else must decide, and shows them no buttons", async () => {
    signInAs("admin@lexaudit.test"); // admin asked for the access change and the model release
    renderApp("/approvals");
    const list = await cards();
    const own = list.find((card) => card.textContent?.includes("Qaimə çıxarışı modeli v7"))!;
    expect(within(own).getByText(/başqa şəxs təsdiq etməlidir/)).toBeInTheDocument();
    expect(within(own).queryByRole("button")).not.toBeInTheDocument();
    // The tax-rate change was asked for by someone else, so the admin can decide that one.
    const other = list.find((card) => card.textContent?.includes("Güzəştli ƏDV"))!;
    expect(within(other).getByRole("button", { name: "Təsdiq et" })).toBeInTheDocument();
  });

  it("shows permission-denied, and never calls the API, to someone who may not see approvals", async () => {
    signInAs("viewer@lexaudit.test");
    const urls = recordRequests();
    renderApp("/approvals");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(urls.some((url) => url.includes("/approvals"))).toBe(false);
  });

  it("keeps the queue closed to an accountant, who may not read it", async () => {
    signInAs(); // accountant: may not read the queue at all
    renderApp("/approvals");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
  });
});

describe("what the server enforces, whatever the screen shows", () => {
  it("refuses the requester, refuses a missing comment, and decides only once", async () => {
    signInAs("admin@lexaudit.test");
    await expect(decide("appr-seed-model", "approved")).rejects.toMatchObject({ status: 403 }); // own request

    signInAs(CHIEF);
    await expect(decide("appr-seed-model", "approved", "  ")).rejects.toMatchObject({ status: 422 });
    await decide("appr-seed-model", "approved");
    await expect(decide("appr-seed-model", "denied")).rejects.toMatchObject({ status: 409 });
    await expect(decide("appr-seed-expired", "approved")).rejects.toMatchObject({ status: 409 });
    await expect(decide("nope", "approved")).rejects.toMatchObject({ status: 404 });
  });

  it("lets only people with the permission decide", async () => {
    signInAs("auditor@lexaudit.test");
    await expect(decide("appr-seed-rate", "approved")).rejects.toMatchObject({ status: 403 });
  });

  it("writes every decision, and every refused attempt, to the audit log", async () => {
    signInAs("admin@lexaudit.test");
    await expect(decide("appr-seed-model", "approved")).rejects.toMatchObject({ status: 403 });
    await decide("appr-seed-rate", "approved");

    const events = (await api.GET("/audit-events", { params: { query: { q: "approval.decide" } } })).data!.items;
    expect(events.slice(0, 2).map((event) => event.outcome)).toEqual(["success", "denied"]);
    expect(events[0]!.actor.name).toBe("Nigar Quliyeva");
  });

  it("keeps the chat and the queue in step: approving in the queue completes the tool run in the conversation", async () => {
    signInAs();
    const { id } = (await api.POST("/conversations", { body: {} })).data!;
    for await (const event of streamSse(`/conversations/${id}/messages`, {
      method: "POST",
      body: { content: "yazılışı təsdiqə göndər", attachments: [] },
      headers: { "Idempotency-Key": "k" },
    }))
      void event;
    const approvalId = (await api.GET("/conversations/{id}", { params: { path: { id } } })).data!.messages[1]!
      .approvals[0]!.id;

    signInAs(CHIEF);
    const queued = (await api.GET("/approvals/{id}", { params: { path: { id: approvalId } } })).data!;
    expect(queued).toMatchObject({
      kind: "tool_action",
      status: "pending",
      canDecide: true,
      source: { type: "conversation", id },
    });
    await decide(approvalId, "approved");

    const message = (await api.GET("/conversations/{id}", { params: { path: { id } } })).data!.messages[1]!;
    expect(message.approvals[0]!.status).toBe("approved");
    expect(message.toolRuns[0]!.status).toBe("done");
  });
});
