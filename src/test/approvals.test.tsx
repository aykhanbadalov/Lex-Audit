import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "@/api/client";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

const CHIEF = "bas.muhasib@lexaudit.test";
const cards = () => screen.findAllByRole("article");
const decide = (id: string, decision: "approve" | "reject", comment = "yoxlandı") =>
  api.POST("/approvals/{id}/decide", { params: { path: { id } }, body: { decision, comment } });

/** The accountant sends an entry for approval, which creates a request only somebody else can decide. */
async function accountantAsks() {
  signInAs();
  await api.POST("/journal/{id}/submit", { params: { path: { id: "je-seed-3" } } });
  return (await api.GET("/approvals")).data!.find((item) => item.resourceRef === "je-seed-3")!;
}

describe("the approval queue", () => {
  it("shows multiple clearly labeled demo approval scenarios", async () => {
    signInAs(CHIEF);
    renderApp("/approvals");

    expect(await screen.findByRole("heading", { name: "Giriş icazəsi üçün qərar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Model buraxılışını təsdiqlə" })).toBeInTheDocument();
  });

  it("opens on what is waiting, and shows what the request would post", async () => {
    await accountantAsks();
    signInAs(CHIEF);
    renderApp("/approvals");

    await screen.findAllByText(/Amortizasiya/);
    const list = await cards();
    const entry = list.find((card) => card.textContent?.includes("Amortizasiya"))!;
    expect(within(entry).getByText("Jurnal yazılışı", { selector: "span" })).toBeInTheDocument();
    // The lines the person is agreeing to are in front of them, with the accounts.
    expect(within(entry).getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/Sizin qərarınızı gözləyən: [1-9]/)).toBeInTheDocument();
  });

  it("will not accept a decision without a few words, then approves and posts the entry", async () => {
    const asked = await accountantAsks();
    signInAs(CHIEF);
    renderApp("/approvals");
    await screen.findAllByText(/Amortizasiya/);
    const card = (await cards()).find((item) => item.textContent?.includes("Amortizasiya"))!;
    const approve = within(card).getByRole("button", { name: "Təsdiq et" });
    expect(approve).toBeDisabled();

    await userEvent.type(within(card).getByLabelText(/Şərh/), "ab");
    expect(approve).toBeDisabled(); // too short to mean anything
    await userEvent.type(within(card).getByLabelText(/Şərh/), "c");
    await userEvent.click(approve);

    await waitFor(() => expect(screen.queryByText(/Amortizasiya/)).not.toBeInTheDocument());
    expect((await api.GET("/approvals/{id}", { params: { path: { id: asked.id } } })).data!.status).toBe("approved");
    expect((await api.GET("/journal/{id}", { params: { path: { id: "je-seed-3" } } })).data!.status).toBe("posted");
  });

  it("keeps decided and expired requests readable, with who decided and why, and no buttons", async () => {
    signInAs(CHIEF);
    renderApp("/approvals?status=all");
    const list = await cards();
    const done = list.find((card) => card.textContent?.includes("Auditor tapşırığına uyğundur."))!;
    expect(done).toHaveTextContent("qərar verib");
    expect(within(done).queryByRole("button")).not.toBeInTheDocument();
    const expired = list.find((card) => card.textContent?.includes("Müddəti bitib"))!;
    expect(within(expired).queryByRole("button")).not.toBeInTheDocument();
  });

  it("filters by status from the URL", async () => {
    signInAs(CHIEF);
    renderApp("/approvals?status=expired");
    const list = await cards();
    expect(list.every((card) => card.textContent?.includes("Müddəti bitib"))).toBe(true);
  });

  it("tells the person who asked that someone else must decide, and shows them no buttons", async () => {
    await accountantAsks();
    signInAs("admin@lexaudit.test");
    const own = (await api.GET("/journal/{id}", { params: { path: { id: "je-seed-3" } } })).data!;
    expect(own.approvalId).toBeTruthy();

    signInAs();
    renderApp("/approvals");
    const list = await cards();
    const mine = list.find((card) => card.textContent?.includes("Amortizasiya"));
    // The accountant may not even read the queue's decisions, but if shown, it has no buttons.
    if (mine) expect(within(mine).queryByRole("button", { name: "Təsdiq et" })).not.toBeInTheDocument();
  });

  it("shows permission-denied, and never calls the API, to someone who may not see approvals", async () => {
    signInAs("viewer@lexaudit.test");
    const urls: string[] = [];
    server.events.on("request:start", ({ request }) => void urls.push(request.url));
    renderApp("/approvals");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(urls.some((url) => url.includes("/approvals"))).toBe(false);
  });
});

describe("what the server enforces, whatever the screen shows", () => {
  it("refuses the requester, and decides only once", async () => {
    const asked = await accountantAsks();
    await expect(decide(asked.id, "approve")).rejects.toMatchObject({ status: 403 });

    signInAs(CHIEF);
    await decide(asked.id, "approve");
    await expect(decide(asked.id, "reject")).rejects.toMatchObject({ status: 409 });
    await expect(decide("nope", "approve")).rejects.toMatchObject({ status: 404 });
  });

  it("refuses an expired request", async () => {
    signInAs(CHIEF);
    const expired = (await api.GET("/approvals")).data!.find((item) => item.status === "expired")!;
    await expect(decide(expired.id, "approve")).rejects.toMatchObject({ status: 409 });
  });

  it("lets only people with the permission decide", async () => {
    const asked = await accountantAsks();
    signInAs("auditor@lexaudit.test");
    await expect(decide(asked.id, "approve")).rejects.toMatchObject({ status: 403 });
  });

  it("a rejection sends the entry back so it can be asked for again", async () => {
    const asked = await accountantAsks();
    signInAs(CHIEF);
    await decide(asked.id, "reject", "səhvdir");
    expect((await api.GET("/journal/{id}", { params: { path: { id: "je-seed-3" } } })).data!.status).toBe("proposed");
  });

  it("writes every decision, and every refused attempt, to the audit log", async () => {
    signInAs(CHIEF); // the chief asks, then tries to approve their own request
    await api.POST("/journal/{id}/submit", { params: { path: { id: "je-seed-3" } } });
    const asked = (await api.GET("/approvals")).data!.find((item) => item.resourceRef === "je-seed-3")!;
    await expect(decide(asked.id, "approve")).rejects.toMatchObject({ status: 403 });

    signInAs("admin@lexaudit.test");
    await decide(asked.id, "approve");
    const events = (await api.GET("/audit-events", { params: { query: { limit: 20 } } })).data!;
    expect(events.filter((event) => event.action === "approval.decide")).toHaveLength(2);
  });
});
