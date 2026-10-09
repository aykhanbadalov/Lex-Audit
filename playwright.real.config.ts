import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a REAL backend (default http://127.0.0.1:8080), not the mocks. See deploy/README.md.
 *   REAL_ADMIN_EMAIL / REAL_ADMIN_PASSWORD  an existing admin (the backend's DEV_ADMIN_* in development)
 */
export default defineConfig({
  testDir: "./tests/real",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5174" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL } }],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
    env: { VITE_ENABLE_MSW: "false", VITE_API_PROXY_TARGET: process.env.REAL_API ?? "http://127.0.0.1:8080" },
  },
});
