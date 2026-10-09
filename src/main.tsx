import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "@/app/providers";
import "@/styles/globals.css";

async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MSW !== "true") {
    return;
  }
  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledFrame: "bypass" });
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

void enableMocking().then(() => {
  createRoot(root).render(
    <StrictMode>
      <AppProviders />
    </StrictMode>,
  );
});
