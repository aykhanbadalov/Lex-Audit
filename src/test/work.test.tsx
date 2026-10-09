import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "@/api/client";
import { findWorkbook } from "@/mocks/fixtures/excel";
import { allFiles, processingMs } from "@/mocks/fixtures/files";
import { apiPath } from "@/mocks/handlers/base";
import { server } from "@/mocks/server";
import { polling } from "@/shared/api/polling";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

beforeEach(() => {
  polling.intervalMs = 40;
  processingMs.value = 150;
});

const choose = (files: File[]) => userEvent.upload(screen.getByLabelText("Fayl seçin"), files);
const rows = () => screen.findAllByRole("row").then((all) => all.slice(1));

async function expectNoApiCalls(path: string, urlPart: string) {
  signInAs("viewer@lexaudit.test");
  let called = false;
  server.events.on("request:start", ({ request }) => {
    if (request.url.includes(urlPart)) called = true;
  });
  renderApp(path);
  expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
  expect(called).toBe(false);
}

describe("permissions", () => {
  it("Excel, reconciliation and integrations call no API for someone without read access", async () => {
    await expectNoApiCalls("/excel", "/excel/");
  });
  it("reconciliation is closed to someone without read access", async () => {
    await expectNoApiCalls("/reconciliation", "/reconciliations");
  });
  it("integrations are closed to someone without read access", async () => {
    await expectNoApiCalls("/integrations", "/imports");
  });
});

describe("Excel workbench", () => {
  it("analyses every column and flags a meaning the model is unsure about", async () => {
    signInAs();
    renderApp("/excel/wb-sales");
    expect(await screen.findByText(/Vərəq «Satışlar» · 240 sətir/)).toBeInTheDocument();
    const vat = screen.getByText("C", { selector: "span.font-mono" }).closest("tr")!;
    expect(vat).toHaveTextContent(/225\s*15\s*214/); // filled, empty, duplicates
    expect(screen.getByText("Yoxlayın · 62%")).toBeInTheDocument(); // the "Qeyd" column
  });

  it("shows cell samples as plain text, because they come from a file the user uploaded", async () => {
    signInAs();
    server.use(
      http.get(apiPath("/excel/workbooks/wb-sales"), () => {
        return HttpResponse.json({
          id: "wb-sales",
          fileName: "x.xlsx",
          status: "ready",
          statusDetail: null,
          sheetCount: 1,
          rowCount: 1,
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
          jobs: [],
          sheets: [
            {
              name: "S",
              rowCount: 1,
              columns: [
                {
                  letter: "A",
                  name: "X",
                  detectedType: "text",
                  meaning: null,
                  filled: 1,
                  empty: 0,
                  duplicates: 0,
                  samples: ['<img src=x onerror="alert(1)">'],
                },
              ],
            },
          ],
        });
      }),
    );
    const { container } = renderApp("/excel/wb-sales");
    await screen.findByText(/Vərəq «S»/);
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });

  it("never touches the original: an operation produces a NEW file under Files", async () => {
    signInAs();
    renderApp("/excel/wb-sales");
    await userEvent.click(await screen.findByRole("button", { name: "İcra et" }));

    const link = await screen.findByRole("link", { name: "Satış reyestri (təmizlənmiş).xlsx" }, { timeout: 4000 });
    expect(screen.getByText("Oxunub: 240 · dəyişdirilib: 15 · silinib: 0")).toBeInTheDocument();
    expect(screen.getByText("«2345678912»", { selector: "ins" })).toBeInTheDocument();
    expect(link.getAttribute("href")).toMatch(/^\/files\/file-up-/);
    expect(findWorkbook("wb-sales")!.fileName).toBe("Satış reyestri.xlsx"); // the original is as it was
    expect(allFiles().some((file) => file.name === "Satış reyestri (təmizlənmiş).xlsx")).toBe(true);
  });

  it("will not run 'remove duplicates' without a key column, and says why", async () => {
    signInAs();
    let posted = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/jobs")) posted++;
    });
    renderApp("/excel/wb-sales");
    await userEvent.selectOptions(await screen.findByLabelText("Əməliyyat"), "remove_duplicates");

    expect(screen.getByRole("button", { name: "İcra et" })).toBeDisabled();
    expect(screen.getByText("Ən azı bir sütun seçin.")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/C · VÖEN/));
    await userEvent.click(screen.getByRole("button", { name: "İcra et" }));
    expect(await screen.findByText(/silinib: 12/, undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(posted).toBe(1);
  });

  it("offers a reader the analysis but no way to run anything", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/excel/wb-sales");
    await screen.findByText(/Vərəq «Satışlar»/);
    expect(screen.queryByRole("button", { name: "İcra et" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fayl seçin")).not.toBeInTheDocument();
  });

  it("offers no operation while the workbook is still being analysed", async () => {
    signInAs();
    renderApp("/excel/wb-wait");
    expect(await screen.findByText(/Fayl təhlil edilir/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "İcra et" })).not.toBeInTheDocument();
  });

  it("refuses a job on a workbook that is not ready (server says 409)", async () => {
    signInAs();
    await expect(
      api.POST("/excel/workbooks/{id}/jobs", {
        params: { path: { id: "wb-wait" } },
        body: { operation: "trim_spaces", sheet: "Satışlar", columns: [] },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("uploads a spreadsheet and shows it become ready", async () => {
    signInAs();
    renderApp("/excel");
    await rows();
    await choose([new File(["a,b"], "yeni-cədvəl.csv", { type: "text/csv" })]);
    const row = await screen.findByRole("link", { name: "yeni-cədvəl.csv" }).then((link) => link.closest("tr")!);
    await waitFor(() => expect(within(row).getByText("Hazırdır")).toBeInTheDocument(), { timeout: 4000 });
  });
});

describe("reconciliation", () => {
  it("lists reconciliations with their counts", async () => {
    signInAs();
    renderApp("/reconciliation");
    const [first] = await rows();
    expect(first).toBeDefined();
    expect(screen.getByText("Təsdiqlənib: 3 · təsdiq gözləyir: 2 · uyğunsuz: 3")).toBeInTheDocument();
  });

  it("shows the server's remaining difference and filters rows by status", async () => {
    signInAs();
    renderApp("/reconciliation/rec-1");
    await screen.findByText("Qalan fərq");
    // -20.00 (suggested) + 0 + 120 + 300 - 8500, worked out by hand
    expect(screen.getByText("Qalan fərq").nextElementSibling).toHaveTextContent("-8.100,00 ₼");
    expect((await rows()).length).toBe(8);
  });

  it("narrows to one status from the URL", async () => {
    signInAs();
    renderApp("/reconciliation/rec-1?status=suggested");
    expect(await rows()).toHaveLength(2);
  });

  it("lets a writer confirm a suggestion, and the server recomputes the counts and the difference", async () => {
    signInAs();
    renderApp("/reconciliation/rec-1?status=suggested");
    const first = (await rows())[0]!; // BT-118: 1750.00 vs 1770.00
    await userEvent.click(within(first).getByRole("button", { name: "Təsdiq et" }));

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(1 + 1)); // it left the "suggested" filter
    expect(screen.getByText("Təsdiq gözləyir", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Təsdiqlənib", { selector: "dt" }).nextElementSibling).toHaveTextContent("4");
    expect(screen.getByText("Qalan fərq").nextElementSibling).toHaveTextContent("-8.080,00 ₼"); // the -20.00 is settled
  });

  it("lets a writer reject a suggestion, which goes back to the unmatched ones", async () => {
    signInAs();
    renderApp("/reconciliation/rec-1?status=suggested");
    const second = (await rows())[1]!;
    await userEvent.click(within(second).getByRole("button", { name: "Rədd et" }));
    await waitFor(() =>
      expect(screen.getByText("Uyğunsuz", { selector: "dt" }).nextElementSibling).toHaveTextContent("4"),
    );
  });

  it("decides a suggestion only once: deciding again is a conflict", async () => {
    signInAs();
    await api.POST("/reconciliations/{id}/rows/{rowId}/confirm", {
      params: { path: { id: "rec-1", rowId: "rec-1-r4" } },
    });
    await expect(
      api.POST("/reconciliations/{id}/rows/{rowId}/reject", { params: { path: { id: "rec-1", rowId: "rec-1-r4" } } }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      api.POST("/reconciliations/{id}/rows/{rowId}/confirm", { params: { path: { id: "rec-1", rowId: "rec-1-r6" } } }),
    ).rejects.toMatchObject({ status: 409 }); // an unmatched row is not a suggestion
  });

  it("gives a reader the whole picture but no buttons", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/reconciliation/rec-1");
    await rows();
    expect(screen.queryByRole("button", { name: "Təsdiq et" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rədd et" })).not.toBeInTheDocument();
  });

  it("offers only files that have finished processing and are statements", async () => {
    signInAs();
    renderApp("/reconciliation");
    const select = await screen.findByLabelText("Fayl");
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
    expect(within(select).getByRole("option", { name: "Bank çıxarışı sentyabr.csv" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "e-qaimə reyestri 2026-09.xml" })).not.toBeInTheDocument(); // still being read
    expect(within(select).queryByRole("option", { name: "Skan - qaimə 0457.jpg" })).not.toBeInTheDocument();
  });

  it("is refused by the server for a file that is not ready, even if the UI were bypassed", async () => {
    signInAs();
    await expect(
      api.POST("/reconciliations", {
        body: { kind: "bank_ledger", fileId: "file-einvoice-registry", periodId: "2026-09" },
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("starts a reconciliation and shows it become ready", async () => {
    signInAs();
    renderApp("/reconciliation");
    const select = await screen.findByLabelText("Fayl");
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
    expect(screen.getByRole("button", { name: "Başla" })).toBeDisabled();

    await userEvent.selectOptions(select, "Bank çıxarışı sentyabr.csv");
    fireEvent.change(screen.getByLabelText("Dövr"), { target: { value: "2026-09" } });
    await userEvent.click(screen.getByRole("button", { name: "Başla" }));

    await waitFor(() => expect(screen.getAllByText("Hazırlanır").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByText("Hazırlanır")).not.toBeInTheDocument(), { timeout: 4000 });
  });
});

describe("integrations: imports", () => {
  it("lists past imports with what happened to their rows", async () => {
    signInAs();
    renderApp("/integrations");
    await rows();
    expect(screen.getByText("Uğurlu: 116 · xəta: 1 · təkrar: 3")).toBeInTheDocument(); // 120 - 1 bad row - 3 duplicates
  });

  it("tells the user a required field has no column yet, and blocks the import", async () => {
    signInAs();
    renderApp("/integrations/imp-2"); // a bank statement has Debit and Credit; the amount must be chosen by a person
    expect(await screen.findByRole("alert")).toHaveTextContent("Məcburi «Məbləğ» sahəsi üçün sütun seçilməyib.");
    expect(screen.getByRole("button", { name: "İdxal et" })).toBeDisabled();
  });

  it("walks through mapping: unsaved choices block the import, saving re-validates, and a good mapping unlocks it", async () => {
    signInAs();
    renderApp("/integrations/imp-2");
    const amount = await screen.findByLabelText(/Məbləğ/);

    await userEvent.selectOptions(amount, "Debet");
    expect(screen.getByRole("button", { name: "İdxal et" })).toBeDisabled();
    expect(screen.getByText("Əvvəlcə xəritələməni saxlayın.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Xəritələməni saxla" }));
    expect(await screen.findByText(/Sətir 3, «Tarix»: tarix düzgün deyil/)).toBeInTheDocument(); // the server found a bad date
    await waitFor(() => expect(screen.getByRole("button", { name: "İdxal et" })).toBeEnabled());
  });

  it("does not offer a column to a second field once another field uses it", async () => {
    signInAs();
    renderApp("/integrations/imp-2");
    const description = await screen.findByLabelText(/Təsvir/);
    // "Tarix" feeds the date field already
    expect(within(description).queryByRole("option", { name: "Tarix" })).not.toBeInTheDocument();
    expect(within(description).getByRole("option", { name: "Təsvir" })).toBeInTheDocument();
  });

  it("refuses a mapping where every row would fail, so a wrong column choice cannot be committed", async () => {
    signInAs();
    renderApp("/integrations/imp-2");
    // Free the "Referans" column (the reference field is optional) and feed the amount from it: text where a number belongs.
    await userEvent.selectOptions(await screen.findByLabelText(/Arayış/), "");
    await userEvent.selectOptions(screen.getByLabelText(/Məbləğ/), "Referans");
    await userEvent.click(screen.getByRole("button", { name: "Xəritələməni saxla" }));
    await screen.findAllByText(/məbləğ düzgün deyil/);
    expect(screen.getByRole("button", { name: "İdxal et" })).toBeDisabled();
    expect(screen.getByText(/Bütün sətirlər xətalıdırsa, xəritələmə yanlışdır/)).toBeInTheDocument();
  });

  it("asks before importing because it cannot be undone, then reports the result", async () => {
    signInAs();
    renderApp("/integrations/imp-2");
    await userEvent.selectOptions(await screen.findByLabelText(/Məbləğ/), "Debet");
    await userEvent.click(screen.getByRole("button", { name: "Xəritələməni saxla" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "İdxal et" })).toBeEnabled());

    await userEvent.click(screen.getByRole("button", { name: "İdxal et" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("120 sətir idxal olunacaq");
    expect(dialog).toHaveTextContent("geri qaytarmaq mümkün deyil");

    await userEvent.click(within(dialog).getByRole("button", { name: "İdxal et" }));
    expect(await screen.findByText("Tamamlanıb", undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText("Uğurlu").nextElementSibling).toHaveTextContent("114"); // 120 - 3 bad rows - 3 duplicates
  });

  it("refuses to commit when the server says no, even if a client skipped the checks", async () => {
    signInAs();
    await expect(api.POST("/imports/{id}/commit", { params: { path: { id: "imp-2" } } })).rejects.toMatchObject({
      status: 409,
    }); // amount is still unmapped
  });

  it("lets a reader see an import but not change or run it", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/integrations/imp-2");
    expect(await screen.findByLabelText(/Tarix/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "İdxal et" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xəritələməni saxla" })).not.toBeInTheDocument();
  });

  it("sends the chosen source with the upload, so a bank file is not mistaken for a 1C file", async () => {
    signInAs();
    renderApp("/integrations");
    await rows();
    await userEvent.selectOptions(screen.getByLabelText("Mənbə"), "bank");
    await choose([new File(["Tarix;Təsvir"], "mənim-bank.csv", { type: "text/csv" })]);

    const row = await screen.findByRole("link", { name: "mənim-bank.csv" }).then((link) => link.closest("tr")!);
    expect(row).toHaveTextContent("Bank çıxarışı");
    await waitFor(() => expect(within(row).getByText("Xəritələmə tələb edir")).toBeInTheDocument(), { timeout: 4000 });
  });

  it("builds a 1C export file for a period and links to it", async () => {
    signInAs();
    renderApp("/integrations");
    await rows();
    expect(screen.getByRole("button", { name: "Fayl yarat" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Dövr"), { target: { value: "2026-09" } });
    await userEvent.click(screen.getByRole("button", { name: "Fayl yarat" }));

    expect(await screen.findByRole("link", { name: "1c-export-2026-09.xml" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/files\/file-up-/),
    );
  });
});
