import { defineConfig, devices } from "@playwright/test";

/** Smoke test of the PRODUCTION bundle of the demo build (what Docker serves), not the dev server. Run `pnpm build:demo` first. */
export default defineConfig({
  testDir: "./tests/demo",
  use: { baseURL: "http://127.0.0.1:4173" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL } }],
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
