import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { invoiceListConfig, invoicePollConfig } from "@/features/invoices/api";
import { processingMs } from "@/mocks/fixtures/files";
import { apiPath } from "@/mocks/handlers/base";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

beforeEach(() => {
  invoicePollConfig.intervalMs = 40;
  invoicePollConfig.windowMs = 5000;
  invoiceListConfig.pageSize = 50;
  processingMs.value = 150;
});

const rows = () => screen.findAllByRole("row").then((all) => all.slice(1));
const pdf = (name = "yeni-qaimə.pdf") => new File(["%PDF-1.4 demo"], name, { type: "application/pdf" });
const choose = (files: File[]) => userEvent.upload(screen.getByLabelText("Fayl seçin"), files);

describe("invoice list", () => {
  it("lists invoices newest first, with money in the Azerbaijani format and the state in words", async () => {
    signInAs();
    renderApp("/invoices");

    const first = await rows();
    expect(first.length).toBeGreaterThan(3);
    const clean = first.find((row) => row.textContent?.includes("AF-0457"))!;
    // jest-dom collapses whitespace (including the non-breaking space) before comparing.
    expect(clean).toHaveTextContent("383,50 ₼");
    expect(clean).toHaveTextContent("Alış · Alfa MMC");
    expect(clean).toHaveTextContent(/Yoxlanılıb|Yoxlama tələb edir|Oxunub/);
  });

  it("does not list documents that are still being read: they become invoices once the backend has read them", async () => {
    signInAs();
    renderApp("/invoices");
    await rows();
    expect(screen.queryByText("skan-qaimə.jpg")).not.toBeInTheDocument();
  });

  it("filters from the URL: status and direction", async () => {
    signInAs();
    const { unmount } = renderApp("/invoices?direction=sales");
    expect((await rows()).every((row) => row.textContent?.includes("Satış"))).toBe(true);
    unmount();

    renderApp("/invoices?status=needs_review");
    const review = await rows();
    expect(review.length).toBeGreaterThan(0);
    expect(review.every((row) => row.textContent?.includes("Yoxlama tələb edir"))).toBe(true);
  });

  it("filters by a date range", async () => {
    signInAs();
    renderApp("/invoices?from=2026-10-01&to=2026-10-31");
    const october = await rows();
    expect(october.length).toBeGreaterThan(0);
    expect(october.length).toBeLessThan(10);
  });

  it("says 'no results' when filters match nothing", async () => {
    signInAs();
    renderApp("/invoices?from=2001-01-01&to=2001-01-02");
    expect(await screen.findByText("Nəticə tapılmadı")).toBeInTheDocument();
  });

  it("loads the remaining invoices on demand", async () => {
    signInAs();
    invoiceListConfig.pageSize = 3;
    renderApp("/invoices");
    const firstPage = await rows();
    expect(firstPage).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Daha çox yüklə" }));
    await waitFor(() => expect(screen.getAllByRole("row").length - 1).toBeGreaterThan(firstPage.length));
  });

  it("shows permission-denied, and never calls the API, to a user who may not read invoices", async () => {
    signInAs("viewer@lexaudit.test");
    let called = false;
    server.use(
      http.get(apiPath("/invoices"), () => {
        called = true;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );
    renderApp("/invoices");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("shows the list but no upload area to a user who may only read", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/invoices");
    await rows();
    expect(screen.queryByLabelText("Fayl seçin")).not.toBeInTheDocument();
  });
});

describe("uploading invoices", () => {
  it("uploads a document, and the new invoice appears in the list without a reload", async () => {
    signInAs();
    processingMs.value = 300;
    renderApp("/invoices");
    const before = (await rows()).length;

    await choose([pdf("alfa-qaimə.pdf")]);

    expect(await screen.findByText("Yükləndi")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("row").length - 1).toBeGreaterThan(before), { timeout: 4000 });
    expect(screen.getByRole("link", { name: /^UP-\d+/ })).toBeInTheDocument();
  });

  it("refuses an unsupported file before it leaves the browser", async () => {
    signInAs();
    renderApp("/invoices");
    await rows();
    await choose([new File(["MZ"], "virus.exe")]);
    expect(await screen.findByText("Bu fayl növü dəstəklənmir")).toBeInTheDocument();
  });

  it("reports a server refusal in plain words", async () => {
    signInAs();
    server.use(
      http.post(apiPath("/invoices/upload"), () =>
        HttpResponse.json({ error: { code: "VALIDATION_FAILED", message: "x", requestId: "r" } }, { status: 413 }),
      ),
    );
    renderApp("/invoices");
    await rows();
    await choose([pdf()]);
    expect(await screen.findByText("Fayl çox böyükdür")).toBeInTheDocument();
  });
});
