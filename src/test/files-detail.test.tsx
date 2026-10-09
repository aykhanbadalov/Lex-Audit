import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollConfig } from "@/features/files/api";
import { findFile, processingMs } from "@/mocks/fixtures/files";
import { apiPath } from "@/mocks/handlers/base";
import { server } from "@/mocks/server";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

beforeEach(() => {
  pollConfig.intervalMs = 40;
  processingMs.value = 150;
});
afterEach(() => vi.restoreAllMocks());

const heading = () => screen.findByRole("heading", { level: 1 });

describe("file detail", () => {
  it("shows the details of a ready file, with its extracted text as plain text", async () => {
    signInAs();
    renderApp("/files/file-contract-alfa");

    expect(await heading()).toHaveTextContent("Müqavilə - Alfa MMC.pdf");
    expect(screen.getAllByText("Hazırdır").length).toBeGreaterThan(0);
    expect(screen.getByText("/Müqavilələr")).toBeInTheDocument();
    expect(screen.getByText(/Mətn çıxarılıb/)).toBeInTheDocument();
    expect(screen.getByText(/v1 · cari/)).toBeInTheDocument();
  });

  it("never renders a file name or an extraction error as HTML", async () => {
    signInAs();
    server.use(
      http.get(apiPath("/files/file-contract-alfa"), () =>
        HttpResponse.json({
          id: "file-contract-alfa",
          name: '<img src=x onerror="alert(1)"> a.pdf',
          mime: "application/pdf",
          size: 10,
          folder: "/",
          tags: [],
          ownerId: "u",
          archivedAt: null,
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
          extractionStatus: "failed",
          versions: [],
          extraction: {
            status: "failed",
            detectedKind: null,
            error: '<b onmouseover="x">bad</b>',
            textLength: 0,
            updatedAt: "2026-10-01T00:00:00Z",
          },
        }),
      ),
    );
    const { container } = renderApp("/files/file-contract-alfa");
    await heading();
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(screen.getAllByText(/<img src=x/).length).toBeGreaterThan(0);
    expect(container.querySelector("b")).toBeNull();
  });

  it("explains a failed file and lets a writer process it again until it is ready", async () => {
    signInAs();
    renderApp("/files/file-scan-0457");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Fayl oxuna bilmədi");
    expect(alert).toHaveTextContent("OCR mətni oxuya bilmədi");

    await userEvent.click(within(alert).getByRole("button", { name: "Yenidən işlə" }));

    // It goes back into the queue and, by itself, becomes ready.
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument(), { timeout: 4000 });
    await waitFor(() => expect(screen.getAllByText("Hazırdır").length).toBeGreaterThan(0), { timeout: 4000 });
  });

  it("does not offer 'process again' to someone who may only read", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/files/file-scan-0457");
    expect(await screen.findByRole("alert")).toHaveTextContent("Fayl oxuna bilmədi");
    expect(screen.queryByRole("button", { name: "Yenidən işlə" })).not.toBeInTheDocument();
  });

  it("archives only after confirmation, then offers to restore", async () => {
    signInAs();
    renderApp("/files/file-contract-alfa");
    await heading();

    await userEvent.click(screen.getByRole("button", { name: "Arxivə at" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("silinməyəcək");
    expect(findFile("file-contract-alfa")?.isArchived).toBe(false); // nothing happens until the user confirms
    await userEvent.click(within(dialog).getByRole("button", { name: "Arxivə at" }));

    expect(await screen.findByRole("button", { name: "Bərpa et" })).toBeInTheDocument();
    expect(screen.getByText("Arxivdədir")).toBeInTheDocument();
    expect(findFile("file-contract-alfa")?.isArchived).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Bərpa et" }));
    expect(await screen.findByRole("button", { name: "Arxivə at" })).toBeInTheDocument();
    expect(findFile("file-contract-alfa")?.isArchived).toBe(false);
  });

  it("cancelling the archive dialog changes nothing", async () => {
    signInAs();
    renderApp("/files/file-contract-alfa");
    await heading();
    await userEvent.click(screen.getByRole("button", { name: "Arxivə at" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ləğv et" }));
    expect(findFile("file-contract-alfa")?.isArchived).toBe(false);
  });

  it("hides edit and archive from a read-only user, but still lets them download", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/files/file-contract-alfa");
    await heading();
    expect(screen.getByRole("button", { name: "Yüklə" })).toBeInTheDocument();
    for (const name of ["Redaktə et", "Arxivə at", "Bərpa et"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("shows 'not found' for an unknown file", async () => {
    signInAs();
    renderApp("/files/nope");
    expect(await screen.findByText("Fayl tapılmadı")).toBeInTheDocument();
  });

  it("returns to the list with the filters the user had", async () => {
    signInAs();
    const { router } = renderApp("/files?q=Skan");
    await userEvent.click(await screen.findByRole("link", { name: "Skan - qaimə 0457.jpg" }));
    await heading();
    await userEvent.click(screen.getByRole("link", { name: "Fayllara qayıt" }));
    await screen.findByRole("link", { name: "Skan - qaimə 0457.jpg" });
    expect(screen.queryByRole("link", { name: "Müqavilə - Alfa MMC.pdf" })).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ q: "Skan" });
  });
});

describe("editing a file", () => {
  async function openEditor() {
    signInAs();
    renderApp("/files/file-contract-alfa");
    await heading();
    await userEvent.click(screen.getByRole("button", { name: "Redaktə et" }));
    return screen.findByRole("dialog");
  }

  it("saves a new name, folder and tags", async () => {
    const dialog = await openEditor();
    const name = within(dialog).getByLabelText("Ad");
    await userEvent.clear(name);
    await userEvent.type(name, "Alfa müqaviləsi.pdf");
    const folder = within(dialog).getByLabelText("Qovluq");
    await userEvent.clear(folder);
    await userEvent.type(folder, "arxiv//2026/");
    const tags = within(dialog).getByLabelText("Teqlər");
    await userEvent.clear(tags);
    await userEvent.type(tags, "ƏDV, müqavilə, ƏDV");
    await userEvent.click(within(dialog).getByRole("button", { name: "Yadda saxla" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { level: 1, name: "Alfa müqaviləsi.pdf" })).toBeInTheDocument();
    const stored = findFile("file-contract-alfa")!;
    expect(stored.folder).toBe("/arxiv/2026"); // normalized
    expect(stored.tags).toEqual(["ƏDV", "müqavilə"]); // trimmed, de-duplicated
  });

  it("rejects a name with a slash, an empty name and a folder that climbs out, without calling the server", async () => {
    let patched = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.method === "PATCH") patched++;
    });
    const dialog = await openEditor();

    const name = within(dialog).getByLabelText("Ad");
    await userEvent.clear(name);
    await userEvent.click(within(dialog).getByRole("button", { name: "Yadda saxla" }));
    expect(await within(dialog).findByText("Ad boş ola bilməz")).toBeInTheDocument();

    await userEvent.type(name, "a/b.pdf");
    const folder = within(dialog).getByLabelText("Qovluq");
    await userEvent.clear(folder);
    await userEvent.type(folder, "../gizli");
    await userEvent.click(within(dialog).getByRole("button", { name: "Yadda saxla" }));

    expect(await within(dialog).findByText("Adda / işarəsi ola bilməz")).toBeInTheDocument();
    expect(within(dialog).getByText("Qovluq yolu düzgün deyil")).toBeInTheDocument();
    expect(patched).toBe(0);
  });

  it("keeps the dialog open, with the typed text, when the server refuses", async () => {
    server.use(
      http.patch(apiPath("/files/file-contract-alfa"), () =>
        HttpResponse.json({ error: { code: "INTERNAL", message: "x", requestId: "r" } }, { status: 500 }),
      ),
    );
    const dialog = await openEditor();
    const name = within(dialog).getByLabelText("Ad");
    await userEvent.clear(name);
    await userEvent.type(name, "Yeni ad.pdf");
    await userEvent.click(within(dialog).getByRole("button", { name: "Yadda saxla" }));

    await waitFor(() => expect(findFile("file-contract-alfa")?.name).toBe("Müqavilə - Alfa MMC.pdf"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByLabelText("Ad")).toHaveValue("Yeni ad.pdf");
  });
});

describe("downloading", () => {
  it("fetches the bytes with the session and saves them under the file's name", async () => {
    signInAs();
    const created = vi.fn(() => "blob:demo");
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });

    renderApp("/files/file-contract-alfa");
    await heading();
    await userEvent.click(screen.getByRole("button", { name: "Yüklə" }));

    await waitFor(() => expect(clicked).toEqual(["Müqavilə - Alfa MMC.pdf"]));
    expect(created).toHaveBeenCalledOnce();
    expect(revoked).toHaveBeenCalledWith("blob:demo"); // the in-memory copy is released straight away
  });

  it("tells the user when the download fails", async () => {
    signInAs();
    server.use(
      http.get(apiPath("/files/file-contract-alfa/content"), () =>
        HttpResponse.json({ error: { code: "INTERNAL", message: "x", requestId: "r" } }, { status: 500 }),
      ),
    );
    renderApp("/files/file-contract-alfa");
    await heading();
    await userEvent.click(screen.getByRole("button", { name: "Yüklə" }));
    // The button is usable again and nothing was saved.
    await waitFor(() => expect(screen.getByRole("button", { name: "Yüklə" })).toBeEnabled());
  });
});
