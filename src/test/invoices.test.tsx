import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { invoicePollConfig } from "@/features/invoices/api";
import { processingMs } from "@/mocks/fixtures/files";
import { apiPath } from "@/mocks/handlers/base";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

beforeEach(() => {
  invoicePollConfig.intervalMs = 40;
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
    expect(first).toHaveLength(10);
    const clean = first.find((row) => row.textContent?.includes("AF-0457") && row.textContent.includes("Yoxlanılıb"))!;
    // jest-dom collapses whitespace (including the non-breaking space) before comparing.
    expect(clean).toHaveTextContent("383,50 ₼");
    expect(clean).toHaveTextContent("Alış · Alfa MMC");
  });

  it("shows how many errors and warnings each invoice has", async () => {
    signInAs();
    renderApp("/invoices?q=BT-118");
    const [row] = await rows();
    expect(within(row!).getByText("Xəta: 1")).toBeInTheDocument();
  });

  it("shows a dash instead of an amount while an invoice is being read or when reading failed", async () => {
    signInAs();
    renderApp("/invoices?status=extracting");
    const [extracting] = await rows();
    expect(extracting).toHaveTextContent("—");
    expect(extracting).not.toHaveTextContent("₼");
  });

  it("filters from the URL: status, direction and 'only with issues'", async () => {
    signInAs();
    const { unmount } = renderApp("/invoices?direction=sales");
    expect((await rows()).every((row) => row.textContent?.includes("Satış"))).toBe(true);
    unmount();

    renderApp("/invoices?hasIssues=true");
    const withIssues = await rows();
    expect(withIssues.length).toBeGreaterThan(0);
    expect(withIssues.every((row) => /Xəta: \d|Xəbərdarlıq: \d/.test(row.textContent ?? ""))).toBe(true);
  });

  it("finds invoices by counterparty", async () => {
    signInAs();
    renderApp("/invoices");
    await rows();
    await userEvent.type(screen.getByRole("searchbox", { name: "Axtarış" }), "Alfa");
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(1 + 2), { timeout: 3000 });
  });

  it("says 'no results' when filters match nothing", async () => {
    signInAs();
    renderApp("/invoices?q=zzzzzz");
    expect(await screen.findByText("Nəticə tapılmadı")).toBeInTheDocument();
  });

  it("loads the remaining invoices on demand", async () => {
    signInAs();
    renderApp("/invoices");
    await rows();
    await userEvent.click(screen.getByRole("button", { name: "Daha çox yüklə" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(1 + 12));
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
  it("uploads a document, then shows it being read and finally ready for review, without a reload", async () => {
    signInAs();
    processingMs.value = 500;
    renderApp("/invoices");
    await rows();

    await choose([pdf("alfa-qaimə.pdf")]);

    expect(await screen.findByText("Yükləndi")).toBeInTheDocument();
    const table = screen.getByRole("table");
    // A freshly read invoice is labelled by its number; the file name only shows until a number is found.
    const row = await within(table)
      .findByText(/^UP-\d+/)
      .then((cell) => cell.closest("tr")!);
    expect(within(row).getByText(/Növbədə|Oxunur/)).toBeInTheDocument();
    await waitFor(() => expect(within(row).getByText(/Yoxlanılıb|Yoxlama tələb edir/)).toBeInTheDocument(), {
      timeout: 4000,
    });
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
