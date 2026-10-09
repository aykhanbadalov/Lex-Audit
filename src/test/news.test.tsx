import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { findNewsDetail } from "@/mocks/fixtures/news";
import { server } from "@/mocks/server";
import { renderApp, signInAs, setupMockApi } from "./utils";
import { apiPath } from "@/mocks/handlers/base";

setupMockApi();

const articles = () => screen.findAllByRole("article");

describe("news list", () => {
  it("shows the newest first, with an unread marker and the AI label on summaries", async () => {
    signInAs();
    renderApp("/news");

    const items = await articles();
    expect(items).toHaveLength(8);
    expect(within(items[0]!).getByRole("link")).toHaveTextContent("Vergi Məcəlləsinə dəyişiklik layihəsi");
    expect(within(items[0]!).getByText("Oxunmayıb")).toBeInTheDocument();
    expect(within(items[0]!).getByText(/Süni intellekt tərəfindən yaradılıb/)).toBeInTheDocument();
  });

  it("loads the rest on demand and hides the button when everything is shown", async () => {
    signInAs();
    renderApp("/news");
    await articles();

    await userEvent.click(screen.getByRole("button", { name: "Daha çox yüklə" }));

    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(14));
    expect(screen.queryByRole("button", { name: "Daha çox yüklə" })).not.toBeInTheDocument();
  });

  it("applies filters from the URL", async () => {
    signInAs();
    renderApp("/news?q=Sadələşdirilmiş");

    const items = await articles();
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Sadələşdirilmiş vergi");
  });

  it("ignores garbage in the URL instead of crashing", async () => {
    signInAs();
    renderApp("/news?read=maybe&bookmarked=yes");
    expect(await articles()).toHaveLength(8);
  });

  it("finds items by typing, and puts the query in the URL", async () => {
    signInAs();
    const { router } = renderApp("/news");
    await articles();

    await userEvent.type(screen.getByRole("searchbox", { name: "Axtarış" }), "depozit");

    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2), { timeout: 3000 });
    expect(router.state.location.search).toMatchObject({ q: "depozit" });
  });

  it("matches Azerbaijani text case-insensitively (İ / ı)", async () => {
    signInAs();
    renderApp("/news?q=ƏDV");
    const items = await articles();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => /ƏDV/i.test(item.textContent ?? ""))).toBe(true);
  });

  it("says 'no results' when filters match nothing, and lets the user reset", async () => {
    signInAs();
    renderApp("/news?q=zzzzzz");

    expect(await screen.findByText("Nəticə tapılmadı")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filtrləri sıfırla" }));
    expect(await articles()).toHaveLength(8);
  });

  it("shows an error with a working retry when the server fails", async () => {
    signInAs();
    let failing = true;
    server.use(
      http.get(apiPath("/news"), () =>
        failing
          ? HttpResponse.json(
              { error: { code: "INTERNAL", message: "Server exploded", requestId: "r1" } },
              { status: 500 },
            )
          : undefined,
      ),
    );
    renderApp("/news");

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Yenidən cəhd et" }));
    expect(await articles()).toHaveLength(8);
  });

  it("shows a permission-denied state, without calling the news API, to a user who may not read news", async () => {
    signInAs("viewer@lexaudit.test");
    let called = false;
    server.use(
      http.get(apiPath("/news"), () => {
        called = true;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );
    renderApp("/news");

    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
    expect(called).toBe(false);
  });
});

describe("bookmarks", () => {
  it("toggles instantly and keeps the change", async () => {
    signInAs();
    renderApp("/news");
    const first = (await articles())[0]!;

    await userEvent.click(within(first).getByRole("button", { name: "Əlfəcinə əlavə et" }));

    expect(within(first).getByRole("button", { name: "Əlfəcindən çıxar" })).toHaveAttribute("aria-pressed", "true");
    // The server state changed too.
    await waitFor(() =>
      expect(
        within(screen.getAllByRole("article")[0]!).getByRole("button", { name: "Əlfəcindən çıxar" }),
      ).toBeInTheDocument(),
    );
  });

  it("rolls back when the server refuses the change", async () => {
    signInAs();
    server.use(
      http.put(apiPath("/news/:id/bookmark"), () =>
        HttpResponse.json({ error: { code: "INTERNAL", message: "nope", requestId: "r2" } }, { status: 500 }),
      ),
    );
    renderApp("/news");
    const first = (await articles())[0]!;

    await userEvent.click(within(first).getByRole("button", { name: "Əlfəcinə əlavə et" }));

    await waitFor(() =>
      expect(
        within(screen.getAllByRole("article")[0]!).getByRole("button", { name: "Əlfəcinə əlavə et" }),
      ).toHaveAttribute("aria-pressed", "false"),
    );
  });

  it("shows only bookmarked items with the filter on", async () => {
    signInAs();
    renderApp("/news?bookmarked=true");
    const items = await articles();
    expect(items).toHaveLength(2);
    items.forEach((item) => expect(within(item).getByRole("button", { name: "Əlfəcindən çıxar" })).toBeInTheDocument());
  });
});

describe("news detail", () => {
  it("keeps AI output visibly separate from the source text, and shows which of the company's files it may affect", async () => {
    signInAs();
    renderApp("/news/news-einvoice-bill");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Vergi Məcəlləsinə dəyişiklik layihəsi");

    const ai = screen.getByRole("region", { name: "Süni intellekt tərəfindən yaradılıb" });
    expect(within(ai).getByText(/məsləhət xarakterlidir/)).toBeInTheDocument();

    const source = screen.getByRole("heading", { name: "Mənbə mətni" }).closest("div")!.parentElement!;
    expect(ai.contains(source)).toBe(false);
    expect(source).toHaveTextContent("ictimai müzakirəyə çıxarılıb");

    expect(screen.getByRole("link", { name: "Fayl" })).toHaveAttribute("href", expect.stringMatching(/^\/files\//));
    expect(screen.getByText("uyğunluq 82%")).toBeInTheDocument();
  });

  it("marks the item as read when it is opened", async () => {
    signInAs();
    const { router } = renderApp("/news/news-einvoice-bill");
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(findNewsDetail("news-einvoice-bill")?.isRead).toBe(true));

    await router.navigate({ to: "/news" });
    const first = (await articles())[0]!;
    expect(within(first).queryByText("Oxunmayıb")).not.toBeInTheDocument();
  });

  it("shows 'not found' for an unknown id", async () => {
    signInAs();
    renderApp("/news/does-not-exist");
    expect(await screen.findByText("Xəbər tapılmadı")).toBeInTheDocument();
  });

  it("never renders a javascript: link coming from a scraped source", async () => {
    signInAs();
    const detail = findNewsDetail("news-einvoice-bill")!;
    server.use(
      http.get(apiPath("/news/news-einvoice-bill"), () =>
        HttpResponse.json({ ...detail, originalUrl: "javascript:alert(1)" }),
      ),
    );
    renderApp("/news/news-einvoice-bill");

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("link", { name: /Orijinal mənbəni aç/ })).not.toBeInTheDocument();
  });

  it("renders scraped text as plain text, never as HTML", async () => {
    signInAs();
    const detail = findNewsDetail("news-einvoice-bill")!;
    server.use(
      http.get(apiPath("/news/news-einvoice-bill"), () =>
        HttpResponse.json({ ...detail, rawText: '<img src=x onerror="alert(1)"> mətn' }),
      ),
    );
    const { container } = renderApp("/news/news-einvoice-bill");

    await screen.findByRole("heading", { level: 1 });
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });
});

describe("returning to the list", () => {
  it("restores the filters the user had when they opened the item", async () => {
    signInAs();
    const { router } = renderApp("/news?q=Sadələşdirilmiş");
    const first = (await articles())[0]!;

    await userEvent.click(within(first).getByRole("link"));
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("link", { name: "Xəbərlərə qayıt" }));

    expect(await articles()).toHaveLength(1);
    expect(router.state.location.search).toMatchObject({ q: "Sadələşdirilmiş" });
  });

  it("goes to the unfiltered list when the detail page was opened directly", async () => {
    signInAs();
    renderApp("/news/news-einvoice-bill");
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("link", { name: "Xəbərlərə qayıt" }));
    expect(await articles()).toHaveLength(8);
  });
});
