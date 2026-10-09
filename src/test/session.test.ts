import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { refreshSession } from "@/api/session";
import { findNewsItem } from "@/mocks/fixtures/news";
import { setMockRefreshUser } from "@/mocks/refreshCookie";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/shared/stores/authStore";
import { setupMockApi } from "./utils";
import { apiPath } from "@/mocks/handlers/base";

setupMockApi();

function countRequests(path: string): () => number {
  let count = 0;
  server.events.on("request:start", ({ request }) => {
    if (new URL(request.url).pathname.endsWith(path)) count++;
  });
  return () => count;
}

function useStaleToken(): void {
  useAuthStore.getState().setSession({
    accessToken: "stale-token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: "user-accountant",
      companyId: "c",
      name: "A",
      email: "muhasib@lexaudit.test",
      role: "accountant",
      permissions: ["news:read"],
    },
  });
}

describe("session refresh", () => {
  it("shares one request between concurrent callers (a rotating refresh token cannot be used twice)", async () => {
    setMockRefreshUser("muhasib@lexaudit.test");
    const refreshCalls = countRequests("/auth/refresh");

    const results = await Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
      refreshSession(),
      refreshSession(),
    ]);

    expect(results).toEqual([true, true, true, true, true]);
    expect(refreshCalls()).toBe(1);
  });

  it("restores a session from the refresh cookie", async () => {
    setMockRefreshUser("admin@lexaudit.test");
    expect(await refreshSession()).toBe(true);
    expect(useAuthStore.getState().user?.role).toBe("admin");
  });

  it("reports failure and clears the session when there is no valid refresh cookie", async () => {
    useStaleToken();
    expect(await refreshSession()).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe("API client", () => {
  it("replays a request with a fresh token after a 401", async () => {
    setMockRefreshUser("muhasib@lexaudit.test");
    useStaleToken();

    const { data } = await api.GET("/news/sources");

    expect(data?.length).toBeGreaterThan(0);
    expect(useAuthStore.getState().accessToken).toBe("mock-token-user-accountant");
  });

  it("replays a request body too, not just GETs", async () => {
    setMockRefreshUser("muhasib@lexaudit.test");
    useStaleToken();
    expect(findNewsItem("news-einvoice-bill")?.isRead).toBe(false);

    await api.PUT("/news/{id}/read", { params: { path: { id: "news-einvoice-bill" } }, body: { isRead: true } });

    expect(findNewsItem("news-einvoice-bill")?.isRead).toBe(true);
  });

  it("refreshes only once when several requests fail with 401 at the same time", async () => {
    setMockRefreshUser("muhasib@lexaudit.test");
    useStaleToken();
    const refreshCalls = countRequests("/auth/refresh");

    await Promise.all([api.GET("/news/sources"), api.GET("/news"), api.GET("/legislation")]);

    expect(refreshCalls()).toBe(1);
  });

  it("gives up with a typed error when the session cannot be refreshed", async () => {
    useStaleToken();
    await expect(api.GET("/news/sources")).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("does not try to refresh after a failed login", async () => {
    const refreshCalls = countRequests("/auth/refresh");
    await expect(
      api.POST("/auth/login", { body: { email: "muhasib@lexaudit.test", password: "wrong" } }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(refreshCalls()).toBe(0);
  });

  it("surfaces a 404 as an error, never as another resource", async () => {
    setMockRefreshUser("muhasib@lexaudit.test");
    await refreshSession();
    await expect(api.GET("/news/{id}", { params: { path: { id: "nope" } } })).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("turns a dropped connection into a NETWORK error", async () => {
    server.use(http.get(apiPath("/news/sources"), () => HttpResponse.error()));
    setMockRefreshUser("muhasib@lexaudit.test");
    await refreshSession();
    await expect(api.GET("/news/sources")).rejects.toMatchObject({ code: "NETWORK" });
  });
});
