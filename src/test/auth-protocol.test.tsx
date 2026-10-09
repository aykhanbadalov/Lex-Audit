import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { login, refreshSession, signOut } from "@/api/session";
import { apiPath } from "@/mocks/handlers/base";
import { setMockRefreshUser } from "@/mocks/refreshCookie";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/shared/stores/authStore";
import { renderApp, setupMockApi } from "./utils";

setupMockApi();

function record(match: (request: Request) => boolean) {
  const seen: Request[] = [];
  server.events.on("request:start", ({ request }) => {
    if (match(request)) seen.push(request.clone());
  });
  return seen;
}
const path = (request: Request) => new URL(request.url).pathname;

describe("the sign-in protocol of the real backend", () => {
  it("signs in with tokens, then asks /me who the person is and what they may do", async () => {
    await login({ email: "bas.muhasib@lexaudit.test", password: "demo1234" });
    const { user, csrfToken, accessToken } = useAuthStore.getState();
    expect(accessToken).toBeTruthy();
    expect(csrfToken).toBeTruthy();
    expect(user).toMatchObject({ email: "bas.muhasib@lexaudit.test", role: "approver" });
    // The permission codes are the backend's own, unchanged.
    expect(user?.permissions).toEqual(expect.arrayContaining(["approvals:decide", "journal:write"]));
  });

  it("restores a session after a reload: fetches the CSRF token, then refreshes with it", async () => {
    setMockRefreshUser("muhasib@lexaudit.test");
    const calls = record(() => true);
    expect(useAuthStore.getState().csrfToken).toBeNull();

    expect(await refreshSession()).toBe(true);

    const paths = calls.map((request) => `${request.method} ${path(request)}`);
    expect(paths.slice(0, 2)).toEqual(["GET /api/v1/auth/csrf", "POST /api/v1/auth/refresh"]);
    expect(calls[1]!.headers.get("X-CSRF-Token")).toBeTruthy();
    expect(useAuthStore.getState().user?.email).toBe("muhasib@lexaudit.test");
  });

  it("does not refresh at all without the cookie, and ends up signed out", async () => {
    expect(await refreshSession()).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("is refused when the CSRF token is wrong", async () => {
    setMockRefreshUser("muhasib@lexaudit.test");
    useAuthStore.setState({ csrfToken: "forged" });
    expect(await refreshSession()).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("sends the CSRF token on logout, and forgets everything locally", async () => {
    await login({ email: "muhasib@lexaudit.test", password: "demo1234" });
    const calls = record((request) => path(request).endsWith("/auth/logout"));
    await signOut();
    expect(calls[0]!.headers.get("X-CSRF-Token")).toBe("mock-csrf-user-accountant");
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, csrfToken: null, user: null });
  });
});

describe("two-factor sign-in", () => {
  it("asks for the code only when the backend says it is needed, and sends it with the password", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(apiPath("/auth/login"), async ({ request }) => {
        const body = (await request.json()) as { mfaCode?: string };
        bodies.push(body);
        return body.mfaCode === "123456"
          ? HttpResponse.json({
              accessToken: "mock-token-user-accountant",
              csrfToken: "mock-csrf-user-accountant",
              expiresInSeconds: 900,
            })
          : HttpResponse.json(
              { error: { code: "UNAUTHENTICATED", message: "MFA code required", requestId: "r" } },
              { status: 401 },
            );
      }),
    );
    renderApp("/login");
    await userEvent.type(await screen.findByLabelText("E-poçt"), "muhasib@lexaudit.test");
    await userEvent.type(screen.getByLabelText("Şifrə"), "demo1234");
    expect(screen.queryByLabelText("Təsdiq kodu")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Daxil ol" }));

    const code = await screen.findByLabelText("Təsdiq kodu");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // asking for the code is not an error
    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Daxil ol" }));

    await waitFor(() => expect(useAuthStore.getState().user?.email).toBe("muhasib@lexaudit.test"));
    expect(bodies[1]).toMatchObject({ mfaCode: "123456" });
  });

  it("says a wrong code is wrong, and a rate limit is a rate limit", async () => {
    let attempt = 0;
    server.use(
      http.post(apiPath("/auth/login"), () => {
        attempt++;
        return attempt === 1
          ? HttpResponse.json(
              { error: { code: "UNAUTHENTICATED", message: "MFA code required", requestId: "r" } },
              { status: 401 },
            )
          : attempt === 2
            ? HttpResponse.json(
                { error: { code: "UNAUTHENTICATED", message: "Invalid MFA code", requestId: "r" } },
                { status: 401 },
              )
            : HttpResponse.json({ error: { code: "RATE_LIMITED", message: "slow", requestId: "r" } }, { status: 429 });
      }),
    );
    renderApp("/login");
    await userEvent.type(await screen.findByLabelText("E-poçt"), "a@b.az");
    await userEvent.type(screen.getByLabelText("Şifrə"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Daxil ol" }));
    await userEvent.type(await screen.findByLabelText("Təsdiq kodu"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Daxil ol" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Kod yanlışdır");
    await userEvent.click(screen.getByRole("button", { name: "Daxil ol" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Çox cəhd edildi"));
  });
});
