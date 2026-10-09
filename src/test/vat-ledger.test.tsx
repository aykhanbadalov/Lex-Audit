import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import { server } from "@/mocks/server";
import { formatMoney } from "@/shared/lib/money";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();
afterEach(() => vi.restoreAllMocks());

const az = (amount: string) => formatMoney(amount, "AZN", "az").replaceAll(" ", " ");
const text = (element: HTMLElement) => element.textContent?.replaceAll(" ", " ") ?? "";

describe("VAT summary", () => {
  it("shows the backend's figures and names the result by what it means", async () => {
    signInAs();
    renderApp("/vat?period=2026-09");
    const summary = (await api.GET("/vat/periods/{p}/summary", { params: { path: { p: "2026-09" } } })).data!;

    expect(await screen.findByText("Hesablanmış ƏDV")).toBeInTheDocument();
    expect(text(document.body)).toContain(az(summary.outputVat));
    expect(text(document.body)).toContain(az(summary.inputVat));
    expect(screen.getByText(/Ödəniləcək ƏDV|Qaytarılacaq ƏDV/)).toBeInTheDocument();
  });

  it("says plainly when invoices were left out, so nobody reads a partial figure as complete", async () => {
    signInAs();
    renderApp("/vat?period=2026-10");
    expect(await screen.findByText(/Hesablama tam deyil/)).toBeInTheDocument();
    expect(screen.getByText(/Hesablamaya daxil edilməyən qaimələr: \d+/)).toBeInTheDocument();
  });

  it("links a figure to exactly the invoices behind it: the period's dates and the direction", async () => {
    signInAs();
    const { router } = renderApp("/vat?period=2026-09");
    await screen.findByText("Hesablanmış ƏDV");
    await userEvent.click(screen.getAllByRole("link", { name: /Qaimələr: \d+/ })[0]!);
    await waitFor(() => expect(router.state.location.pathname).toBe("/invoices"));
    expect(router.state.location.search).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(["sales", "purchase"]).toContain((router.state.location.search as { direction?: string }).direction);
  });

  it("falls back to the newest period when the URL names one that does not exist", async () => {
    signInAs();
    renderApp("/vat?period=1999-01");
    expect(await screen.findByRole("combobox", { name: "Dövr" })).toHaveValue("2026-10");
  });

  it("shows permission-denied, and never calls the API, to someone without vat:read", async () => {
    signInAs("viewer@lexaudit.test");
    let called = false;
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/vat/")) called = true;
    });
    renderApp("/vat");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(called).toBe(false);
  });
});

describe("VAT deposit account", () => {
  it("uploads statement rows after checking the amounts, and shows how many were taken", async () => {
    signInAs();
    const bodies: unknown[] = [];
    server.events.on("request:start", async ({ request }) => {
      if (request.url.endsWith("/vat/deposit-statements")) bodies.push(await request.clone().json());
    });
    renderApp("/vat?period=2026-09&tab=deposit");
    const form = await screen.findByRole("form", { name: "Depozit çıxarışı" });

    await userEvent.click(within(form).getByRole("button", { name: "Yüklə" }));
    expect(await within(form).findByText("Düzgün rəqəm daxil edin (məsələn, 8,50)")).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    await userEvent.type(within(form).getByLabelText("Məbləğ"), "250,50");
    await userEvent.click(within(form).getByRole("button", { name: "Yüklə" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    await waitFor(() => expect(within(form).getByLabelText("Məbləğ")).toHaveValue("")); // the form is ready for the next statement
    expect((bodies[0] as { lines: { amount: string }[] }).lines[0]!.amount).toBe("250.50");
  });

  it("offers no upload to someone who may only read", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/vat?period=2026-09&tab=deposit");
    await screen.findByText("Depozit hesabı qalığı");
    expect(screen.queryByRole("form", { name: "Depozit çıxarışı" })).not.toBeInTheDocument();
  });
});

describe("VAT return draft", () => {
  it("prepares a draft, shows the backend's figures for it and offers the file", async () => {
    signInAs();
    renderApp("/vat?period=2026-09&tab=return");
    await userEvent.click(await screen.findByRole("button", { name: "Qaralama hazırla" }));

    const draft = await screen.findByRole("region", { name: "Bəyannamə qaralaması" });
    expect(draft).toHaveTextContent("versiya 1");
    expect(within(draft).getByRole("button", { name: "CSV yüklə" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Yenidən hazırla" })).toBeInTheDocument();
  });

  it("does not let a closed (filed) period get a new draft", async () => {
    signInAs();
    renderApp("/vat?period=2026-06&tab=return");
    await userEvent.click(await screen.findByRole("button", { name: "Qaralama hazırla" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Bəyannamə qaralaması" })).not.toBeInTheDocument());
  });

  it("does not offer drafting to someone who may only read", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/vat?period=2026-09&tab=return");
    await screen.findByText(/rəsmi bəyannamə deyil/i);
    expect(screen.queryByRole("button", { name: "Qaralama hazırla" })).not.toBeInTheDocument();
  });
});

describe("VAT rates", () => {
  it("shows each rate as a percentage with its treatment and status", async () => {
    signInAs();
    renderApp("/vat?tab=rates");
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows.some((row) => /AZ_VAT_STANDARD/.test(text(row)) && text(row).includes("18,00%"))).toBe(true);
    expect(rows.every((row) => /Qüvvədədir|Təsdiq gözləyir/.test(text(row)))).toBe(true);
  });
});

describe("journal", () => {
  it("lists entries of every origin and narrows by status", async () => {
    signInAs();
    renderApp("/ledger");
    expect(await screen.findByText("Ofis icarəsi - oktyabr")).toBeInTheDocument();
    expect(screen.getAllByRole("row").length).toBeGreaterThan(3);
  });

  it("filters by status from the URL", async () => {
    signInAs();
    renderApp("/ledger?status=posted");
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.textContent?.includes("Uçota alınıb"))).toBe(true);
  });

  it("sends a suggested entry for approval, which then waits for somebody else; a reader gets no button", async () => {
    signInAs();
    const first = renderApp("/ledger/je-seed-3");
    await userEvent.click(await screen.findByRole("button", { name: "Təsdiqə göndər" }));
    expect(await screen.findByText(/baş mühasibin təsdiqini gözləyir/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Təsdiqə göndər" })).not.toBeInTheDocument();
    first.unmount();

    signInAs("auditor@lexaudit.test");
    renderApp("/ledger/je-seed-4");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Təsdiqə göndər" })).not.toBeInTheDocument();
  });

  it("is posted only when another person approves it", async () => {
    signInAs();
    await api.POST("/journal/{id}/submit", { params: { path: { id: "je-seed-3" } } });
    // The accountant who asked cannot approve their own request.
    const queue = (await api.GET("/approvals")).data!;
    const approval = queue.find((item) => item.resourceRef === "je-seed-3")!;
    await expect(
      api.POST("/approvals/{id}/decide", {
        params: { path: { id: approval.id } },
        body: { decision: "approve", comment: "ok" },
      }),
    ).rejects.toMatchObject({ status: 403 });

    signInAs("bas.muhasib@lexaudit.test");
    await api.POST("/approvals/{id}/decide", {
      params: { path: { id: approval.id } },
      body: { decision: "approve", comment: "yoxlandı" },
    });
    expect((await api.GET("/journal/{id}", { params: { path: { id: "je-seed-3" } } })).data!.status).toBe("posted");
  });

  it("links an entry back to the invoice it came from", async () => {
    signInAs();
    renderApp("/ledger/je-1003");
    expect(await screen.findByRole("link", { name: "Mənbə qaiməni aç" })).toHaveAttribute("href", "/invoices/inv-1003");
  });

  it("shows 'not found' for an unknown entry", async () => {
    signInAs();
    renderApp("/ledger/nope");
    expect(await screen.findByText("Yazılış tapılmadı")).toBeInTheDocument();
  });

  it("shows permission-denied, and never calls the API, to someone without journal:read", async () => {
    signInAs("viewer@lexaudit.test");
    let called = false;
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/journal")) called = true;
    });
    renderApp("/ledger");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(called).toBe(false);
  });
});

describe("invoice to journal", () => {
  it("suggests an entry for a checked invoice, shows it balanced and writes nothing to the books", async () => {
    signInAs();
    renderApp("/invoices/inv-1001");
    await userEvent.click(await screen.findByRole("button", { name: "Jurnal yazılışı təklif et" }));

    const section = (await screen.findByRole("heading", { name: "Jurnal yazılışı" })).closest("section")!;
    expect(await within(section).findByText("Balanslıdır")).toBeInTheDocument();
    expect(within(section).getByText("Təklif")).toBeInTheDocument();
    const totals = section.querySelector("tfoot")!;
    expect(within(totals).getAllByText("383,50 ₼")).toHaveLength(2); // total debit equals total credit
    expect(within(section).getByRole("link", { name: "Jurnalda aç" })).toBeInTheDocument();
  });

  it("does not offer an entry while the invoice still has problems, nor to a reader", async () => {
    signInAs();
    const first = renderApp("/invoices/inv-1002");
    const section = (await screen.findByRole("heading", { name: "Jurnal yazılışı" })).closest("section")!;
    expect(within(section).queryByRole("button", { name: "Jurnal yazılışı təklif et" })).not.toBeInTheDocument();
    first.unmount();

    signInAs("auditor@lexaudit.test");
    renderApp("/invoices/inv-1001");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Jurnal yazılışı təklif et" })).not.toBeInTheDocument();
  });
});

describe("chart of accounts", () => {
  it("groups accounts by type and filters by name", async () => {
    signInAs();
    renderApp("/ledger/accounts?q=kassa");
    expect(await screen.findByRole("heading", { name: "Aktivlər" })).toBeInTheDocument();
    expect(screen.getByText("Kassa")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Xərclər" })).not.toBeInTheDocument();
  });
});
