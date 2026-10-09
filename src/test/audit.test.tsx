import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "@/api/client";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

const AUDITOR = "auditor@lexaudit.test";
const rows = () => screen.findAllByRole("row").then((all) => all.slice(1));

describe("audit log", () => {
  it("lists the newest events first, in words, with the request id for tracing", async () => {
    signInAs(AUDITOR);
    renderApp("/audit-log");
    const first = await rows();
    expect(first.length).toBeGreaterThan(20);
    const times = first.map((row) => row.querySelector("time")!.getAttribute("datetime")!);
    expect([...times].sort().reverse()).toEqual(times);
    expect(within(first[0]!).getByText(/req-/)).toBeInTheDocument();
  });

  it("finds events by action, resource type or person", async () => {
    signInAs(AUDITOR);
    renderApp("/audit-log");
    const all = (await rows()).length;
    await userEvent.type(screen.getByRole("searchbox", { name: "Axtarış" }), "invoice");
    await waitFor(() => expect(screen.getAllByRole("row").length - 1).toBeLessThan(all), { timeout: 3000 });
    expect(
      (await rows()).every((row) => row.textContent?.includes("invoice-") || row.textContent?.includes("BT-118")),
    ).toBe(true);
  });

  it("filters by a date range from the URL", async () => {
    signInAs(AUDITOR);
    renderApp("/audit-log?from=2026-10-08&to=2026-10-08");
    const day = await rows();
    expect(day.length).toBeGreaterThan(0);
    expect(day.every((row) => row.querySelector("time")!.getAttribute("datetime")!.startsWith("2026-10-08"))).toBe(
      true,
    );
  });

  it("says 'no results' when filters match nothing", async () => {
    signInAs(AUDITOR);
    renderApp("/audit-log?q=zzzzzz");
    expect(await screen.findByText("Nəticə tapılmadı")).toBeInTheDocument();
  });

  it("shows what a change was, as plain text", async () => {
    signInAs(AUDITOR);
    const { container } = renderApp("/audit-log");
    await rows();
    await userEvent.click((await screen.findAllByText("Göstər"))[0]!);
    expect(container.querySelector("details[open] pre")).not.toBeNull();
  });

  it("is closed to people without the permission, in the screen and in the API", async () => {
    signInAs(); // accountant
    const urls: string[] = [];
    server.events.on("request:start", ({ request }) => void urls.push(request.url));
    renderApp("/audit-log");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(urls.some((url) => url.includes("/audit-events"))).toBe(false);
    await expect(api.GET("/audit-events", {})).rejects.toMatchObject({ status: 403 });
  });

  it("offers the log in the menu only to people who may read it", async () => {
    signInAs(AUDITOR);
    const { unmount } = renderApp("/dashboard");
    expect(await screen.findByRole("link", { name: "Audit jurnalı" })).toBeInTheDocument();
    unmount();
    signInAs();
    renderApp("/dashboard");
    await screen.findAllByRole("link", { name: "Qaimələr" });
    expect(screen.queryByRole("link", { name: "Audit jurnalı" })).not.toBeInTheDocument();
  });
});
