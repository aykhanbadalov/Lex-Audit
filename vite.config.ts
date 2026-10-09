/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // The real app and the API share one origin. jsdom defaults to localhost:3000, which would make every API call
    // cross-origin and trigger CORS preflights that production never sees.
    environmentOptions: { jsdom: { url: "http://localhost" } },
    // Node requires absolute URLs; in the browser the relative /api/v1 base is used.
    env: { VITE_API_BASE_URL: "http://localhost/api/v1", VITE_ENABLE_MSW: "false" },
  },
});
