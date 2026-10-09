import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoicePollConfig } from "@/features/invoices/api";
import { findInvoice } from "@/mocks/fixtures/invoices";
import { apiPath } from "@/mocks/handlers/base";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

// pdf.js needs a real layout engine; here it is replaced by a stand-in that exposes what it was given.
vi.mock("react-pdf", async () => {
  const React = await import("react");
  return {
    pdfjs: { GlobalWorkerOptions: {} },
    Document: ({ file, children }: { file: string; children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "pdf-document", "data-file": file }, children),
    Page: ({ pageNumber }: { pageNumber: number }) =>
      React.createElement("div", { "data-testid": "pdf-page" }, `page ${pageNumber}`),
  };
});

setupMockApi();

beforeEach(() => {
  invoicePollConfig.intervalMs = 40;
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:invoice"), revokeObjectURL: vi.fn() });
});
afterEach(() => vi.restoreAllMocks());

const heading = () => screen.findByRole("heading", { level: 1 });
const section = (name: string) => screen.getByRole("heading", { name }).closest("section")!;
const save = () => userEvent.click(screen.getByRole("button", { name: "Yadda saxla" }));

async function typeInto(label: string | RegExp, text: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, text);
}

describe("reading an invoice", () => {
  it("shows the document next to its extracted fields, lines and totals", async () => {
    signInAs();
    renderApp("/invoices/inv-1001");

    expect(await heading()).toHaveTextContent("AF-0457");
    expect(screen.getByLabelText(/Qaimə nömrəsi/)).toHaveValue("AF-0457");
    expect(screen.getByLabelText("Kontragent")).toHaveValue("Alfa MMC");
    expect(screen.getByLabelText("VÖEN")).toHaveValue("1234567891");
    expect(screen.getAllByLabelText("Təsvir")).toHaveLength(2);

    const totals = section("Yekun məbləğlər");
    expect(within(totals).getByText("Cəmi").nextElementSibling).toHaveTextContent("383,50 ₼");
    expect(await screen.findByTestId("pdf-document")).toHaveAttribute("data-file", "blob:invoice");
  });

  it("explains a mismatch between the printed total and the recalculated one, in the user's currency format", async () => {
    signInAs();
    renderApp("/invoices/inv-1002");
    await heading();

    const issues = section("Problemlər");
    expect(issues).toHaveTextContent(
      "Sənəddə yazılan yekun məbləğ (1.750,00 ₼) hesablanmış məbləğdən (1.770,00 ₼) fərqlənir.",
    );
    expect(screen.getByText("Yoxlama tələb edir")).toBeInTheDocument();
  });

  it("marks fields the model was unsure about, and says how unsure", async () => {
    signInAs();
    renderApp("/invoices/inv-1005");
    await heading();
    expect(screen.getAllByText(/Yoxlayın · \d+%/).length).toBeGreaterThan(0);
    expect(screen.getByText("Yoxlayın · 62%")).toBeInTheDocument();
  });

  it("links a duplicate to the invoice it duplicates", async () => {
    signInAs();
    const { router } = renderApp("/invoices/inv-1004");
    await heading();
    expect(section("Problemlər")).toHaveTextContent("AF-0457 nömrəli qaimə bu kontragentdən artıq mövcuddur.");

    await userEvent.click(screen.getByRole("link", { name: "Mövcud qaiməni aç" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/invoices/inv-1001"));
  });

  it("moves focus to the field an issue is about", async () => {
    signInAs();
    renderApp("/invoices/inv-1005");
    await heading();
    const item = screen.getByText(/VÖEN 10 rəqəmdən ibarət olmalıdır/).closest("li")!;

    await userEvent.click(within(item).getByRole("button", { name: "Sahəyə keç" }));

    expect(document.activeElement).toHaveAttribute("id", "field-counterpartyVoen");
  });

  it("shows only what applies while an invoice is still being read", async () => {
    signInAs();
    renderApp("/invoices/inv-1006");
    expect(await screen.findByText(/Qaimə oxunur/)).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("explains why a failed invoice failed", async () => {
    signInAs();
    renderApp("/invoices/inv-1007");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Qaimə oxuna bilmədi");
    expect(alert).toHaveTextContent("səhifə çox tutqundur");
  });

  it("shows 'not found' for an unknown invoice", async () => {
    signInAs();
    renderApp("/invoices/nope");
    expect(await screen.findByText("Qaimə tapılmadı")).toBeInTheDocument();
  });

  it("shows permission-denied, and never calls the API, to someone who may not read invoices", async () => {
    signInAs("viewer@lexaudit.test");
    let called = false;
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/invoices/")) called = true;
    });
    renderApp("/invoices/inv-1001");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("falls back to an image when the source is a picture", async () => {
    signInAs();
    server.use(
      http.get(
        apiPath("/invoices/inv-1001/source"),
        () => new HttpResponse(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } }),
      ),
    );
    renderApp("/invoices/inv-1001");
    await heading();
    expect(await screen.findByRole("img", { name: /önbaxışı/ })).toHaveAttribute("src", "blob:invoice");
  });

  it("says so when there is no preview for the document type", async () => {
    signInAs();
    server.use(
      http.get(
        apiPath("/invoices/inv-1001/source"),
        () => new HttpResponse("a,b", { headers: { "Content-Type": "text/csv" } }),
      ),
    );
    renderApp("/invoices/inv-1001");
    expect(await screen.findByText("Bu sənədin önbaxışı yoxdur")).toBeInTheDocument();
  });

  it("returns to the list with the filters the user had", async () => {
    signInAs();
    const { router } = renderApp("/invoices?status=failed");
    await userEvent.click(await screen.findByRole("link", { name: "skan-qaimə.jpg" }));
    await heading();
    await userEvent.click(screen.getByRole("link", { name: "Qaimələrə qayıt" }));
    await screen.findByRole("link", { name: "skan-qaimə.jpg" });
    expect(screen.queryByRole("link", { name: "AF-0457" })).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ status: "failed" });
  });
});

describe("correcting an invoice", () => {
  it("lets the server recalculate: a corrected price clears the mismatch and the invoice becomes valid", async () => {
    signInAs();
    const bodies: unknown[] = [];
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "PATCH") bodies.push(await request.clone().json());
    });
    renderApp("/invoices/inv-1002");
    await heading();

    await typeInto("Vahidin qiyməti", "1483,05"); // typed with a decimal comma, as people write it
    await save();

    await waitFor(() =>
      expect(within(section("Yekun məbləğlər")).getByText("Cəmi").nextElementSibling).toHaveTextContent("1.750,00 ₼"),
    );
    expect(section("Problemlər")).toHaveTextContent("Problem tapılmadı.");
    expect(screen.getByText("Yoxlanılıb")).toBeInTheDocument();
    // What was sent is a plain decimal string; the totals were never computed in the browser.
    expect(bodies).toHaveLength(1);
    expect((bodies[0] as { lines: { unitPrice: string }[] }).lines[0]!.unitPrice).toBe("1483.05");
  });

  it("warns that totals are stale until the changes are saved", async () => {
    signInAs();
    renderApp("/invoices/inv-1002");
    await heading();
    expect(screen.queryByText(/Yadda saxlanmamış dəyişikliklər var/)).not.toBeInTheDocument();

    await typeInto("Miqdar", "3");

    expect(screen.getByText(/Yadda saxlanmamış dəyişikliklər var/)).toBeInTheDocument();
    expect(screen.getByText("Məbləğlər köhnədir: dəyişiklikləri yadda saxlayın.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yenidən yoxla" })).toBeDisabled();
  });

  it("refuses an amount that is not a number, without calling the server", async () => {
    signInAs();
    let patched = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.method === "PATCH") patched++;
    });
    renderApp("/invoices/inv-1002");
    await heading();

    await typeInto("Vahidin qiyməti", "çox");
    await save();

    expect(await screen.findByText("Düzgün rəqəm daxil edin (məsələn, 8,50)")).toBeInTheDocument();
    expect(patched).toBe(0);
  });

  it("refuses an account that is not in the chart of accounts", async () => {
    signInAs();
    renderApp("/invoices/inv-1002");
    await heading();
    await waitFor(() => expect(document.querySelectorAll("#accounts-list option").length).toBeGreaterThan(0));

    await typeInto("Hesab", "999");
    await save();

    expect(await screen.findByText("Bu hesab hesablar planında yoxdur")).toBeInTheDocument();
  });

  it("offers the model's account suggestion and fills it in when accepted", async () => {
    signInAs();
    renderApp("/invoices/inv-1001");
    await heading();

    const suggestions = screen.getAllByText(/Təklif: 201 · Material ehtiyatları/);
    expect(suggestions[0]).toHaveTextContent("(91%)");
    await userEvent.click(screen.getAllByRole("button", { name: "Qəbul et" })[0]!);

    expect(screen.getAllByLabelText("Hesab")[0]).toHaveValue("201");
  });

  it("adds a line, and will not remove the last one", async () => {
    signInAs();
    renderApp("/invoices/inv-1002");
    await heading();
    expect(screen.getByRole("button", { name: "1-ci sətri sil" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Sətir əlavə et" }));
    expect(screen.getAllByLabelText("Təsvir")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "2-ci sətri sil" }));
    expect(screen.getAllByLabelText("Təsvir")).toHaveLength(1);
  });

  it("keeps the typed text when the server refuses the save", async () => {
    signInAs();
    server.use(
      http.patch(apiPath("/invoices/inv-1002"), () =>
        HttpResponse.json({ error: { code: "INTERNAL", message: "x", requestId: "r" } }, { status: 500 }),
      ),
    );
    renderApp("/invoices/inv-1002");
    await heading();

    await typeInto("Vahidin qiyməti", "1000");
    await save();

    await waitFor(() => expect(screen.getByRole("button", { name: "Yadda saxla" })).toBeEnabled());
    expect(screen.getByLabelText("Vahidin qiyməti")).toHaveValue("1000");
  });

  it("discards the changes on request", async () => {
    signInAs();
    renderApp("/invoices/inv-1002");
    await heading();
    await typeInto("Vahidin qiyməti", "1");
    await userEvent.click(screen.getByRole("button", { name: "Dəyişiklikləri ləğv et" }));
    expect(screen.getByLabelText("Vahidin qiyməti")).toHaveValue("1500.00");
  });

  it("asks before leaving with unsaved changes, and lets the user stay", async () => {
    signInAs();
    const { router } = renderApp("/invoices/inv-1002");
    await heading();
    await typeInto("Vahidin qiyməti", "1");

    await userEvent.click(screen.getByRole("link", { name: "Qaimələrə qayıt" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Dəyişikliklər itəcək");

    await userEvent.click(within(dialog).getByRole("button", { name: "Ləğv et" }));
    expect(router.state.location.pathname).toBe("/invoices/inv-1002");
    expect(screen.getByLabelText("Vahidin qiyməti")).toHaveValue("1");
  });

  it("lets the user leave after confirming", async () => {
    signInAs();
    const { router } = renderApp("/invoices/inv-1002");
    await heading();
    await typeInto("Vahidin qiyməti", "1");

    await userEvent.click(screen.getByRole("link", { name: "Qaimələrə qayıt" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Çıx və at" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/invoices"));
  });

  it("does not ask when nothing was changed", async () => {
    signInAs();
    const { router } = renderApp("/invoices/inv-1002");
    await heading();
    await userEvent.click(screen.getByRole("link", { name: "Qaimələrə qayıt" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/invoices"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("validates again on request", async () => {
    signInAs();
    let validated = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/validate")) validated++;
    });
    renderApp("/invoices/inv-1002");
    await heading();
    await userEvent.click(screen.getByRole("button", { name: "Yenidən yoxla" }));
    await waitFor(() => expect(validated).toBe(1));
  });
});

describe("who may change what", () => {
  it("shows a reader the invoice but offers no way to change it", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/invoices/inv-1002");
    await heading();

    expect(screen.getByLabelText("Vahidin qiyməti")).toBeDisabled();
    for (const name of ["Yadda saxla", "Sətir əlavə et", "Yenidən yoxla"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("locks a posted invoice even for a writer, and shows its journal entry", async () => {
    signInAs();
    renderApp("/invoices/inv-1003");
    await heading();

    expect(screen.getByText("Qaimə uçota alınıb və dəyişdirilə bilməz.")).toBeInTheDocument();
    screen.getAllByLabelText("Vahidin qiyməti").forEach((input) => expect(input).toBeDisabled());
    expect(screen.queryByRole("button", { name: "Yadda saxla" })).not.toBeInTheDocument();
    expect(await within(section("Jurnal yazılışı")).findByText("Uçota alınıb")).toBeInTheDocument();
  });

  it("will not save into an invoice that became locked meanwhile (server says 409)", async () => {
    signInAs();
    renderApp("/invoices/inv-1002");
    await heading();
    findInvoice("inv-1002")!.status = "posted"; // someone else posted it after this page loaded

    await typeInto("Vahidin qiyməti", "1000");
    await save();

    await waitFor(() => expect(screen.getByRole("button", { name: "Yadda saxla" })).toBeEnabled());
    expect(findInvoice("inv-1002")!.lines[0]!.unitPrice).toBe("1500.00");
  });
});

describe("journal entry", () => {
  it("suggests an entry for a valid invoice, shows it balanced, and sends it for approval", async () => {
    signInAs();
    renderApp("/invoices/inv-1001");
    await heading();

    await userEvent.click(screen.getByRole("button", { name: "Jurnal yazılışı təklif et" }));

    const journal = section("Jurnal yazılışı");
    expect(await within(journal).findByText("Balanslıdır")).toBeInTheDocument();
    expect(within(journal).getByText("Təklif")).toBeInTheDocument();
    expect(within(journal).getAllByRole("row").length).toBeGreaterThan(4);
    const totalsRow = journal.querySelector("tfoot")!;
    expect(within(totalsRow).getAllByText("383,50 ₼")).toHaveLength(2); // total debit equals total credit

    await userEvent.click(within(journal).getByRole("button", { name: "Təsdiqə göndər" }));
    expect(await within(journal).findByText("Təsdiq gözləyir")).toBeInTheDocument();
    expect(within(journal).getByText(/baş mühasibin təsdiqini gözləyir/)).toBeInTheDocument();
    expect(within(journal).queryByRole("button", { name: "Təsdiqə göndər" })).not.toBeInTheDocument();
  });

  it("does not offer an entry while the invoice still has problems", async () => {
    signInAs();
    renderApp("/invoices/inv-1002");
    await heading();
    const journal = section("Jurnal yazılışı");
    expect(within(journal).queryByRole("button", { name: "Jurnal yazılışı təklif et" })).not.toBeInTheDocument();
    expect(journal).toHaveTextContent("əvvəlcə bütün xətaları");
  });

  it("does not offer to propose or submit to a reader", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/invoices/inv-1001");
    await heading();
    expect(screen.queryByRole("button", { name: "Jurnal yazılışı təklif et" })).not.toBeInTheDocument();
  });
});
