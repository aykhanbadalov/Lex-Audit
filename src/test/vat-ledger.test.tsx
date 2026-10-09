import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findDraft, reconciliationFor } from "@/mocks/fixtures/vat";
import { apiPath } from "@/mocks/handlers/base";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();
afterEach(() => vi.restoreAllMocks());

/** The figure printed under a label, e.g. under "Hesablanmış ƏDV". */
const under = (label: string) => screen.getByText(label).parentElement!;

describe("VAT summary", () => {
  it("shows the server's figures and names the result by what it means", async () => {
    signInAs();
    renderApp("/vat?period=2026-09");
    await screen.findByText("Ödəniləcək ƏDV");
    expect(under("Hesablanmış ƏDV")).toHaveTextContent("837,00 ₼");
    expect(under("Əvəzləşdirilən ƏDV")).toHaveTextContent("74,70 ₼");
    expect(under("Ödəniləcək ƏDV")).toHaveTextContent("762,30 ₼");
  });

  it("says plainly that unvalidated invoices were left out, so nobody reads a partial figure as complete", async () => {
    signInAs();
    renderApp("/vat?period=2026-09");
    const warning = await screen.findByText(/hələ yoxlanılmadığı üçün hesablamaya daxil edilməyib/);
    expect(warning).toHaveTextContent("1 qaimə hələ yoxlanılmadığı üçün hesablamaya daxil edilməyib.");
    expect(warning.closest('[role="status"]')).not.toBeNull(); // announced to screen readers
  });

  it("mentions foreign-currency conversion, and reports a zero result without pretending there is a debt", async () => {
    signInAs();
    renderApp("/vat?period=2026-10");
    expect(await screen.findByText(/Xarici valyutadakı qaimələrin sayı: 1/)).toBeInTheDocument();
    expect(screen.getByText("Ödəniləcək fərq yoxdur")).toBeInTheDocument();
  });

  it("drills down to exactly the invoices behind a figure, and the filter can be removed", async () => {
    signInAs();
    const { router } = renderApp("/vat?period=2026-09");
    await userEvent.click(await screen.findByRole("link", { name: "Qaimələr: 2" })); // deductible VAT

    await waitFor(() => expect(router.state.location.pathname).toBe("/invoices"));
    expect(router.state.location.search).toMatchObject({ vatPeriod: "2026-09", vatBucket: "input" });
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.textContent).join(" ")).toMatch(/AF-0457[\s\S]*ET-902|ET-902[\s\S]*AF-0457/);
    expect(screen.getByText("ƏDV: sentyabr 2026 · əvəzləşdirilən ƏDV")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Süzgəci götür" }));
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(3));
  });

  it("falls back to the newest period when the URL names one that does not exist", async () => {
    signInAs();
    renderApp("/vat?period=1999-01");
    expect(await screen.findByLabelText("Dövr")).toHaveValue("2026-10");
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
  it("shows that the difference comes from unmatched movements", async () => {
    signInAs();
    renderApp("/vat?period=2026-09&tab=deposit");
    expect(await screen.findByText(/Qaimə ilə əlaqələndirilməmiş hərəkətlər: 2/)).toBeInTheDocument();
    expect(under("Fərq")).toHaveTextContent("-174,00 ₼");
  });

  it("asks before matching, because it cannot be undone, then updates the difference", async () => {
    signInAs();
    renderApp("/vat?period=2026-09&tab=deposit");
    await userEvent.click(await screen.findByRole("button", { name: "Uyğunlaşdır: DL-7" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("geri qaytarmaq mümkün deyil");
    expect(reconciliationFor("2026-09")!.unmatchedCount).toBe(2); // nothing happened yet

    await userEvent.click(within(dialog).getByRole("button", { name: "Uyğunlaşdır" }));
    await waitFor(() => expect(under("Fərq")).toHaveTextContent("-120,00 ₼"));
    expect(reconciliationFor("2026-09")!.unmatchedCount).toBe(1);
    expect(screen.queryByRole("button", { name: "Uyğunlaşdır: DL-7" })).not.toBeInTheDocument();
  });

  it("changes nothing when the confirmation is cancelled", async () => {
    signInAs();
    renderApp("/vat?period=2026-09&tab=deposit");
    await userEvent.click(await screen.findByRole("button", { name: "Uyğunlaşdır: DL-7" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ləğv et" }));
    expect(reconciliationFor("2026-09")!.unmatchedCount).toBe(2);
  });

  it("offers no way to match to someone who may only read", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/vat?period=2026-09&tab=deposit");
    await screen.findByText(/Qaimə ilə əlaqələndirilməmiş hərəkətlər/);
    expect(screen.queryByRole("button", { name: /Uyğunlaşdır/ })).not.toBeInTheDocument();
  });

  it("says the account agrees with the books when nothing is unmatched", async () => {
    signInAs();
    server.use(
      http.get(apiPath("/vat/periods/2026-09/deposit"), () =>
        HttpResponse.json({ ...reconciliationFor("2026-09"), unmatchedCount: 0, difference: "0.00", lines: [] }),
      ),
    );
    renderApp("/vat?period=2026-09&tab=deposit");
    expect(await screen.findByText("Depozit hesabı uçotla tam uzlaşır.")).toBeInTheDocument();
  });
});

describe("VAT return draft", () => {
  it("prepares a draft from the server's figures, warns about what it left out, and exports it", async () => {
    signInAs();
    const created = vi.fn(() => "blob:draft");
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    renderApp("/vat?period=2026-09&tab=return");
    expect(await screen.findByText(/rəsmi bəyannamə deyil/)).toBeInTheDocument();
    expect(findDraft("2026-09")).toBeUndefined();

    await userEvent.click(screen.getByRole("button", { name: "Qaralama hazırla" }));

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Ödəniləcək ƏDV").closest("tr")).toHaveTextContent("762,30 ₼");
    expect(screen.getByText(/1 qaimə yoxlanılmadığı üçün daxil edilməyib/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yenidən hazırla" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "PDF" }));
    await waitFor(() => expect(saved).toEqual(["vat-draft-2026-09.pdf"]));
  });

  it("does not let a closed (filed) period get a new draft", async () => {
    signInAs();
    renderApp("/vat?period=2026-08&tab=return");
    expect(await screen.findByText("Dövr təqdim edilib, qaralama hazırlamaq olmaz.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qaralama hazırla" })).not.toBeInTheDocument();
  });

  it("does not offer drafting to someone who may only read", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/vat?period=2026-09&tab=return");
    expect(await screen.findByText("Qaralamanı hazırlamaq üçün icazəniz yoxdur.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qaralama hazırla" })).not.toBeInTheDocument();
  });
});

describe("VAT rates", () => {
  it("shows each rate as a percentage without float noise, linked to its source law", async () => {
    signInAs();
    renderApp("/vat?tab=rates");
    const row = (await screen.findByText("ƏDV 18%")).closest("tr")!;
    expect(row).toHaveTextContent("18%");
    expect(within(row).getByRole("link", { name: "Vergi Məcəlləsi" })).toHaveAttribute(
      "href",
      "/legislation/leg-tax-code",
    );
  });
});

describe("journal", () => {
  it("lists entries of every origin and state, and narrows by status", async () => {
    signInAs();
    renderApp("/ledger");
    expect(await screen.findByText("Ofis icarəsi — oktyabr")).toBeInTheDocument();
    expect(screen.getAllByRole("row").length).toBe(1 + 5);
  });

  it("filters by status from the URL", async () => {
    signInAs();
    renderApp("/ledger?status=pending_approval");
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Əmək haqqı hesablanması");
  });

  it("lets a writer send a suggested entry for approval, but not a reader", async () => {
    signInAs();
    const first = renderApp("/ledger/je-seed-3");
    await userEvent.click(await screen.findByRole("button", { name: "Təsdiqə göndər" }));
    expect(await screen.findByText("Təsdiq gözləyir")).toBeInTheDocument();
    first.unmount();

    signInAs("auditor@lexaudit.test");
    renderApp("/ledger/je-seed-4"); // any entry: a reader gets no action
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Təsdiqə göndər" })).not.toBeInTheDocument();
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

  it("shows permission-denied, and never calls the API, to someone without ledger:read", async () => {
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

describe("chart of accounts", () => {
  it("groups accounts by type and filters by name", async () => {
    signInAs();
    renderApp("/ledger/accounts?q=kassa");
    expect(await screen.findByRole("heading", { name: "Aktivlər" })).toBeInTheDocument();
    expect(screen.getByText("Kassa")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Xərclər" })).not.toBeInTheDocument();
  });
});
