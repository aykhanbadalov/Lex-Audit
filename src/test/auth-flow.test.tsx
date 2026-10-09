import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useAuthStore } from "@/shared/stores/authStore";
import { renderApp, setupMockApi } from "./utils";

setupMockApi();

/** These tests care about the router and the session, so they only need the router back. */
const renderAt = (path: string) => renderApp(path).router;

describe("auth flow", () => {
  it("redirects an anonymous visitor from a protected page to /login", async () => {
    const router = renderAt("/dashboard");
    await screen.findByRole("button", { name: "Daxil ol" });
    expect(router.state.location.pathname).toBe("/login");
  });

  it("rejects a wrong password and stays signed out", async () => {
    renderAt("/login");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("E-poçt"), "muhasib@lexaudit.test");
    await user.type(screen.getByLabelText("Şifrə"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Daxil ol" }));

    expect(await screen.findByText("E-poçt və ya şifrə yanlışdır.")).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("signs in with valid credentials and lands on the dashboard", async () => {
    const router = renderAt("/login");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("E-poçt"), "muhasib@lexaudit.test");
    await user.type(screen.getByLabelText("Şifrə"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Daxil ol" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(await screen.findByText("Xoş gəldiniz, Aygün Məmmədova")).toBeInTheDocument();
  });

  it("shows field errors instead of calling the API when the form is empty", async () => {
    renderAt("/login");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Daxil ol" }));
    expect(await screen.findByText("E-poçt ünvanı düzgün deyil")).toBeInTheDocument();
    expect(screen.getByText("Bu sahə məcburidir")).toBeInTheDocument();
  });
});

describe("permissions in the layout", () => {
  async function signInAndOpen(email: string, path: string) {
    const router = renderAt("/login");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("E-poçt"), email);
    await user.type(screen.getByLabelText("Şifrə"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Daxil ol" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    await router.navigate({ to: path });
    return router;
  }

  it("shows a permission-denied state when an accountant opens the admin page by URL", async () => {
    await signInAndOpen("muhasib@lexaudit.test", "/admin");
    expect(await screen.findByText("Bu bölməyə giriş icazəniz yoxdur")).toBeInTheDocument();
  });

  it("lets the admin open the admin page", async () => {
    await signInAndOpen("admin@lexaudit.test", "/admin");
    expect(await screen.findByRole("tab", { name: "İstifadəçilər" })).toBeInTheDocument();
  });

  it("hides sidebar links the user may not follow", async () => {
    await signInAndOpen("muhasib@lexaudit.test", "/invoices");
    const nav = await screen.findByRole("navigation", { name: "Əsas naviqasiya" });
    expect(nav).toHaveTextContent("Qaimələr");
    expect(nav).not.toHaveTextContent("Tənzimləmələr");
  });
});
