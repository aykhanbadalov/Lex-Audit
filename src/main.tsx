import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootstrapSession } from "@/api/session";
import { AppProviders } from "@/app/providers";
import { initTheme } from "@/shared/stores/themeStore";
import "@/styles/globals.css";

async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MSW !== "true") {
    return;
  }
  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledFrame: "bypass" });
}

initTheme();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

// Mocks must be running before the session is restored, because the restore is itself an API call.
void enableMocking()
  .then(bootstrapSession)
  .then(() => {
    createRoot(root).render(
      <StrictMode>
        <AppProviders />
      </StrictMode>,
    );
  });
