import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollConfig } from "@/features/files/api";
import { MAX_UPLOAD_BYTES } from "@/shared/upload/limits";
import { processingMs } from "@/mocks/fixtures/files";
import { apiPath } from "@/mocks/handlers/base";
import { setMockRefreshUser } from "@/mocks/refreshCookie";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/shared/stores/authStore";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

beforeEach(() => {
  pollConfig.intervalMs = 40;
  processingMs.value = 150;
});
afterEach(() => vi.restoreAllMocks());

const rows = () => screen.findAllByRole("row").then((all) => all.slice(1)); // drop the header row
const pdf = (name = "yeni-qaimə.pdf") => new File(["%PDF-1.4 demo"], name, { type: "application/pdf" });
const chooseFiles = (files: File[]) => userEvent.upload(screen.getByLabelText("Fayl seçin"), files);

function holdUploads() {
  // An upload that never finishes, so the queue and cancel behaviour can be observed.
  server.use(http.post(apiPath("/files"), async () => delay("infinite")));
}

describe("file list", () => {
  it("lists active files newest first and loads the rest on demand", async () => {
    signInAs();
    renderApp("/files");

    const first = await rows();
    expect(first).toHaveLength(10);
    expect(within(first[0]!).getByRole("link")).toHaveTextContent("Gözləyən sənəd.pdf");
    expect(screen.queryByText("Köhnə müqavilə (arxiv).pdf")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Daha çox yüklə" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(1 + 12));
  });

  it("shows the processing state of every file in words", async () => {
    signInAs();
    renderApp("/files");
    await rows();
    for (const label of ["Hazırdır", "Xəta", "Oxunur", "Növbədə"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("hides archived files unless asked, then marks them", async () => {
    signInAs();
    const { unmount } = renderApp("/files");
    expect((await rows()).some((row) => row.textContent?.includes("Köhnə müqavilə (arxiv).pdf"))).toBe(false);
    unmount();

    renderApp("/files?archived=all&q=arxiv");
    const archived = (await rows()).find((row) => row.textContent?.includes("Köhnə müqavilə (arxiv).pdf"))!;
    expect(within(archived).getByText("Arxivdədir")).toBeInTheDocument();
  });

  it("finds files by typing", async () => {
    signInAs();
    renderApp("/files");
    await rows();
    await userEvent.type(screen.getByRole("searchbox", { name: "Axtarış" }), "bank");
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2), { timeout: 3000 });
    expect(screen.getByText("Bank çıxarışı sentyabr.csv")).toBeInTheDocument();
  });

  it("polls while something is still processing and stops when everything has settled", async () => {
    signInAs();
    let calls = 0;
    server.use(
      http.get(apiPath("/files"), () => {
        calls++;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );
    renderApp("/files");
    await screen.findByText("Hələ fayl yoxdur");
    const settled = calls;
    await delay(150);
    expect(calls).toBe(settled); // nothing in progress: no polling
  });

  it("keeps polling while a file is being processed and shows it become ready without a reload", async () => {
    signInAs();
    processingMs.value = 500; // long enough for the first refresh after the upload to still see it in progress
    let listCalls = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.method === "GET" && new URL(request.url).pathname.endsWith("/files")) listCalls++;
    });
    renderApp("/files");
    await rows();
    const before = listCalls;

    await chooseFiles([pdf()]);

    const row = await within(screen.getByRole("table"))
      .findByText("yeni-qaimə.pdf")
      .then((cell) => cell.closest("tr")!);
    await waitFor(() => expect(within(row).getByText("Hazırdır")).toBeInTheDocument(), { timeout: 4000 });
    // One refresh after the upload, plus at least one poll before it settled.
    expect(listCalls - before).toBeGreaterThanOrEqual(2);
  });

  it("shows permission-denied, and never calls the API, to a user who may not read files", async () => {
    signInAs("viewer@lexaudit.test");
    let called = false;
    server.use(
      http.get(apiPath("/files"), () => {
        called = true;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );
    renderApp("/files");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("shows the list but no upload area to a user who may only read", async () => {
    signInAs("auditor@lexaudit.test");
    renderApp("/files");
    await rows();
    expect(screen.queryByLabelText("Fayl seçin")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fayl seç" })).not.toBeInTheDocument();
  });
});

describe("uploading", () => {
  it("uploads a file, shows it done, and puts it at the top of the list", async () => {
    signInAs();
    renderApp("/files");
    await rows();

    await chooseFiles([pdf()]);

    expect(await screen.findByText("Yükləndi")).toBeInTheDocument();
    await waitFor(async () => expect((await rows())[0]).toHaveTextContent("yeni-qaimə.pdf"));
  });

  it("refuses unsupported files, empty files and oversized files without sending them", async () => {
    signInAs();
    let sent = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/files")) sent++;
    });
    renderApp("/files");
    await rows();

    const huge = pdf("böyük.pdf");
    Object.defineProperty(huge, "size", { value: MAX_UPLOAD_BYTES + 1 });
    await chooseFiles([new File(["x"], "virus.exe"), new File([], "boş.pdf"), huge]);

    expect(await screen.findByText("Bu fayl növü dəstəklənmir")).toBeInTheDocument();
    expect(screen.getByText("Fayl boşdur")).toBeInTheDocument();
    expect(screen.getByText("Fayl çox böyükdür")).toBeInTheDocument();
    expect(sent).toBe(0);
  });

  it("shows the server's refusal in plain words", async () => {
    signInAs();
    server.use(
      http.post(apiPath("/files"), () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "too big", requestId: "r" } },
          { status: 413 },
        ),
      ),
    );
    renderApp("/files");
    await rows();
    await chooseFiles([pdf()]);
    expect(await screen.findByText("Fayl çox böyükdür")).toBeInTheDocument();
  });

  it("explains a dropped connection", async () => {
    signInAs();
    server.use(http.post(apiPath("/files"), () => HttpResponse.error()));
    renderApp("/files");
    await rows();
    await chooseFiles([pdf()]);
    expect(await screen.findByText("Şəbəkə xətası. Yenidən cəhd edin.")).toBeInTheDocument();
  });

  it("runs at most three uploads at once and keeps the others waiting", async () => {
    signInAs();
    holdUploads();
    renderApp("/files");
    await rows();

    await chooseFiles(["a", "b", "c", "d", "e"].map((name) => pdf(`${name}.pdf`)));

    await waitFor(() => expect(screen.getAllByText(/Yüklənir… \d+%/)).toHaveLength(3));
    expect(screen.getAllByText("Növbədə gözləyir")).toHaveLength(2);
  });

  it("cancels a running upload and removes its row", async () => {
    signInAs();
    holdUploads();
    renderApp("/files");
    await rows();
    await chooseFiles([pdf("ləğv.pdf")]);
    await screen.findByText(/Yüklənir…/);

    await userEvent.click(screen.getByRole("button", { name: "ləğv.pdf yüklənməsini ləğv et" }));

    await waitFor(() => expect(screen.queryByRole("progressbar", { name: "ləğv.pdf" })).not.toBeInTheDocument());
  });

  it("refreshes an expired session and sends the file again with the same idempotency key", async () => {
    pollConfig.intervalMs = 60_000; // a background poll would refresh the session before the upload and hide the very 401 under test
    setMockRefreshUser("muhasib@lexaudit.test");
    useAuthStore.getState().setSession({
      accessToken: "stale",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "user-accountant",
        companyId: "c",
        name: "A",
        email: "muhasib@lexaudit.test",
        role: "accountant",
        roles: ["accountant"],
        companyName: null,
        permissions: ["files:read", "files:write"],
      },
    });
    const keys: string[] = [];
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/files"))
        keys.push(request.headers.get("Idempotency-Key") ?? "");
    });
    renderApp("/files");
    // The list itself refreshes the session first; the upload then runs with a valid token. Force a stale one again:
    await rows();
    useAuthStore.setState({ accessToken: "stale" });

    await chooseFiles([pdf("təkrar.pdf")]);

    expect(await screen.findByText("Yükləndi")).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});
