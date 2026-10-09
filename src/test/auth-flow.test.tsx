import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import "@/app/i18n";
import { server } from "@/mocks/server";
import { routeTree } from "@/routeTree.gen";
import { useAuthStore } from "@/shared/stores/authStore";

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => useAuthStore.getState().clear());

function renderAt(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  render(<RouterProvider router={router} />);
  return router;
}

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
