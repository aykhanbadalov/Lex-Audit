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
  it("lists the newest events first, with the outcome in words", async () => {
    signInAs(AUDITOR);
    renderApp("/audit-log");
    const first = await rows();
    expect(first).toHaveLength(20);
    const times = first.map((row) => row.querySelector("time")!.getAttribute("datetime")!);
    expect([...times].sort().reverse()).toEqual(times);
    expect(within(first[0]!).getByText(/Uğurlu|İcazə verilmədi|Alınmadı/)).toBeInTheDocument();
  });

  it("filters from the URL: by outcome and by date range", async () => {
    signInAs(AUDITOR);
    const { unmount } = renderApp("/audit-log?outcome=denied");
    const denied = await rows();
    expect(denied.length).toBeGreaterThan(0);
    expect(denied.every((row) => row.textContent?.includes("İcazə verilmədi"))).toBe(true);
    unmount();

    renderApp("/audit-log?from=2026-10-08&to=2026-10-08");
    const day = await rows();
    expect(day.every((row) => row.querySelector("time")!.getAttribute("datetime")!.startsWith("2026-10-08"))).toBe(
      true,
    );
  });

  it("finds events by person, action or resource", async () => {
    signInAs(AUDITOR);
    renderApp("/audit-log");
    await rows();
    await userEvent.type(screen.getByRole("searchbox", { name: "Axtarış" }), "BT-118");
    await waitFor(() => expect(screen.getAllByRole("row").length - 1).toBeLessThan(20), { timeout: 3000 });
    expect((await rows()).every((row) => row.textContent?.includes("BT-118"))).toBe(true);
  });

  it("says 'no results' when filters match nothing, and loads more on demand", async () => {
    signInAs(AUDITOR);
    const { unmount } = renderApp("/audit-log?q=zzzzzz");
    expect(await screen.findByText("Nəticə tapılmadı")).toBeInTheDocument();
    unmount();

    renderApp("/audit-log");
    await rows();
    await userEvent.click(screen.getByRole("button", { name: "Daha çox yüklə" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(1 + 40));
  });

  it("exports what the filters show as a file, links to it, and logs the export itself", async () => {
    signInAs(AUDITOR);
    renderApp("/audit-log?outcome=failed");
    await rows();
    await userEvent.click(screen.getByRole("button", { name: "CSV-yə ixrac" }));

    const link = await screen.findByRole("link", { name: /audit-jurnali-.*\.csv/ });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^\/files\//));
    const latest = (await api.GET("/audit-events", { params: { query: { q: "audit.export" } } })).data!.items;
    expect(latest[0]).toMatchObject({ action: "audit.export", outcome: "success" });
  });

  it("is closed to people without the permission, in the screen and in the API", async () => {
    signInAs(); // accountant
    const urls: string[] = [];
    server.events.on("request:start", ({ request }) => void urls.push(request.url));
    renderApp("/audit-log");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(urls.some((url) => url.includes("/audit-events"))).toBe(false);
    await expect(api.GET("/audit-events", {})).rejects.toMatchObject({ status: 403 });
    await expect(api.POST("/audit-events/export", { body: {} })).rejects.toMatchObject({ status: 403 });
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
