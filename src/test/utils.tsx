import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import "@/app/i18n";
import { mockUsers } from "@/mocks/handlers/auth";
import { resetMocks } from "@/mocks/reset";
import { server } from "@/mocks/server";
import { routeTree } from "@/routeTree.gen";
import { useAuthStore } from "@/shared/stores/authStore";

/** Starts the MSW server for a test file and resets every piece of shared state between tests. */
export function setupMockApi(): void {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  beforeEach(() => useAuthStore.getState().clear());
  afterEach(() => {
    server.resetHandlers();
    resetMocks();
  });
  afterAll(() => server.close());
}

export type MockEmail = keyof typeof mockUsers;

/** Puts a ready-made session in the store, as if the user had just signed in. */
export function signInAs(email: MockEmail = "muhasib@lexaudit.test"): void {
  const user = mockUsers[email];
  if (!user) throw new Error(`Unknown mock user ${email}`);
  useAuthStore.getState().setSession({
    accessToken: `mock-token-${user.id}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    user,
  });
}

export function renderApp(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  // No retries: a failing request should fail the test immediately, not after backoff.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient, ...view };
}
