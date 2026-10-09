import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "@/api/client";
import { useAuthStore } from "@/shared/stores/authStore";
import { polling } from "@/shared/api/polling";
import { apiPath } from "@/mocks/handlers/base";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

beforeEach(() => {
  polling.intervalMs = 40;
});

/** Chooses the sample bank statement in the file list with the given id. */
const pickBank = (id: string) =>
  userEvent.selectOptions(document.getElementById(id) as HTMLSelectElement, "file-bank-sep");

describe("Excel", () => {
  it("analyses a spreadsheet: the job runs in the background, then shows what each column holds", async () => {
    signInAs();
    renderApp("/excel");
    await screen.findByRole("option", { name: /Bank çıxarışı sentyabr/ });
    await pickBank("excel-file-pick");
    await userEvent.click(screen.getByRole("button", { name: "Təhlil et" }));

    expect(await screen.findByText("İş icra olunur…")).toBeInTheDocument();
    const table = await screen.findByRole("table", {}, { timeout: 3000 });
    expect(within(table).getByRole("rowheader", { name: "Məbləğ" })).toBeInTheDocument();
    expect(screen.getByText(/Sətir: 120, boş: 2, təkrar: 6/)).toBeInTheDocument();
    // The total of a number column is money: shown in the Azerbaijani format, not as a float.
    expect(within(table).getByText("31.500,50 ₼")).toBeInTheDocument();
  });

  it("cleans a spreadsheet into a NEW file and says the original is untouched", async () => {
    signInAs();
    renderApp("/excel");
    await screen.findByRole("option", { name: /Bank çıxarışı sentyabr/ });
    await pickBank("excel-file-pick");
    await userEvent.click(screen.getByRole("button", { name: "Təmizlə" }));

    expect(
      await screen.findByText(/Təmizləmə: 120 sətirdən 112 sətir qaldı/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Faylı aç" })).toHaveAttribute("href", expect.stringMatching(/^\/files\//));
    expect(screen.getByText(/Orijinal fayl dəyişmir/)).toBeInTheDocument();
  });

  it("asks for both dates before it makes a report", async () => {
    signInAs();
    renderApp("/excel");
    const create = await screen.findByRole("button", { name: "Hesabat yarat" });
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Tarixdən", { selector: "#report-from" }), "2026-09-01");
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Tarixədək", { selector: "#report-to" }), "2026-09-30");
    expect(create).toBeEnabled();
  });

  it("is refused by the server for a file that does not exist, and an unknown job is 'not found'", async () => {
    signInAs();
    await expect(
      api.POST("/excel/jobs", { body: { operation: "profile", inputFileId: "nope" } }),
    ).rejects.toMatchObject({ status: 404 });
    renderApp("/excel/job-404");
    expect(await screen.findByText("İş tapılmadı")).toBeInTheDocument();
  });

  it("shows permission-denied, and never calls the API, to someone without excel:use", async () => {
    signInAs("viewer@lexaudit.test");
    const urls: string[] = [];
    server.events.on("request:start", ({ request }) => void urls.push(request.url));
    renderApp("/excel");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(urls.some((url) => url.includes("/excel/") || url.includes("/files"))).toBe(false);
    server.events.removeAllListeners();
  });
});

describe("reconciliation", () => {
  it("needs both sides to be complete before it runs", async () => {
    signInAs();
    renderApp("/reconciliation");
    const run = await screen.findByRole("button", { name: "Uzlaşdır" });
    expect(run).toBeDisabled(); // the left side is a file with no columns named yet
  });

  it("shows the suggestions with the difference, and a person confirms a pair; a lone row cannot be confirmed", async () => {
    signInAs();
    const created = (
      await api.POST("/reconciliations", {
        body: { left: { type: "bank" }, right: { type: "invoices", from: "2026-09-01", to: "2026-09-30" } },
      })
    ).data!;
    renderApp(`/reconciliation/${created.id}`);

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    const mismatch = rows.find(
      (row) =>
        row.textContent?.includes("Məbləğ fərqli") && row.textContent.replaceAll("\u00a0", " ").includes("20,00 ₼"),
    )!;
    await userEvent.click(within(mismatch).getByRole("button", { name: "Təsdiq et" }));
    await waitFor(() => expect(within(mismatch).getByText("Təsdiqlənib")).toBeInTheDocument());

    const lone = rows.find((row) => row.textContent?.includes("Yalnız solda"))!;
    expect(within(lone).queryByRole("button", { name: "Təsdiq et" })).not.toBeInTheDocument();
    expect(within(lone).getByText("Uyğunluq yoxdur")).toBeInTheDocument();
  });

  it("confirms a pair only once", async () => {
    signInAs();
    const created = (await api.POST("/reconciliations", { body: { left: { type: "bank" }, right: { type: "bank" } } }))
      .data!;
    const match = (await api.GET("/reconciliations/{id}", { params: { path: { id: created.id } } })).data!.matches[0]!;
    const confirm = () =>
      api.POST("/reconciliations/{id}/matches/{m}/confirm", { params: { path: { id: created.id, m: match.id } } });
    await confirm();
    await expect(confirm()).rejects.toMatchObject({ status: 409 });
  });
});

describe("imports", () => {
  async function preview() {
    renderApp("/integrations");
    await screen.findAllByRole("option", { name: /Bank çıxarışı sentyabr/ });
    await pickBank("import-file");
    await userEvent.click(screen.getByRole("button", { name: "Önbaxış" }));
  }

  it("previews first and writes nothing; then asks for somebody else's approval", async () => {
    signInAs();
    await preview();
    expect(await screen.findByText("Düzgün sətir: 3")).toBeInTheDocument();
    expect(screen.getByText("Hələ heç nə yazılmayıb.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "İdxala göndər" }));
    expect(await screen.findByText(/başqa şəxsin təsdiqini gözləyir/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "İdxala göndər" })).not.toBeInTheDocument();
    const queue = (await api.GET("/approvals")).data!;
    expect(queue.some((item) => item.kind === "import_commit" && item.status === "pending")).toBe(true);
  });

  it("lists the rows that cannot be imported, with the reason, and imports nothing when none is valid", async () => {
    signInAs();
    server.use(
      http.post(apiPath("/imports/preview"), () =>
        HttpResponse.json(
          {
            importId: "imp-x",
            template: "onec-table-v1",
            rowsOk: 0,
            rowsFailed: 2,
            truncated: false,
            errors: [{ row: 3, errors: ["VÖEN 10 rəqəmdən ibarət olmalıdır"] }],
            sample: [],
          },
          { status: 201 },
        ),
      ),
    );
    await preview();
    expect(await screen.findByText("Səhv sətir: 2")).toBeInTheDocument();
    expect(screen.getByText(/Sətir 3:/).closest("li")).toHaveTextContent("VÖEN 10 rəqəmdən ibarət olmalıdır");
    expect(screen.getByRole("button", { name: "İdxala göndər" })).toBeDisabled();
  });

  it("offers no import to someone without imports:commit", async () => {
    signInAs();
    const user = useAuthStore.getState().user!;
    useAuthStore.setState({
      user: { ...user, permissions: user.permissions.filter((code) => code !== "imports:commit") },
    });
    await preview();
    await screen.findByText("Düzgün sətir: 3");
    expect(screen.queryByRole("button", { name: "İdxala göndər" })).not.toBeInTheDocument();
  });

  it("exports posted entries to a new 1C file after both dates are given", async () => {
    signInAs();
    renderApp("/integrations");
    const submit = await screen.findByRole("button", { name: "Fayl yarat" });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Tarixdən", { selector: "#export-from" }), "2026-01-01");
    await userEvent.type(screen.getByLabelText("Tarixədək", { selector: "#export-to" }), "2026-12-31");
    await userEvent.click(submit);
    expect(await screen.findByText(/Fayl hazırdır: \d+ yazılış/)).toBeInTheDocument();
  });

  it("shows 'not found' for an unknown import", async () => {
    signInAs();
    renderApp("/integrations/nope");
    expect(await screen.findByText("İdxal tapılmadı")).toBeInTheDocument();
  });
});
