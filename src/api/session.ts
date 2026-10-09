import type { components } from "./schema";
import { useAuthStore } from "@/shared/stores/authStore";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

type Session = components["schemas"]["Session"];

let inFlight: Promise<boolean> | null = null;

/**
 * Exchanges the HttpOnly refresh cookie for a new access token.
 * Concurrent callers share one request, so a burst of 401s causes a single refresh (rotation would break a second one).
 * Uses plain fetch on purpose: going through the API client would run its 401 handling again and loop.
 */
export function refreshSession(): Promise<boolean> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!response.ok) {
      useAuthStore.getState().clear();
      return false;
    }
    useAuthStore.getState().setSession((await response.json()) as Session);
    return true;
  } catch {
    // Network failure: keep whatever session we have, the caller decides what to show.
    return false;
  }
}

/** Called once at startup so a page reload keeps the user signed in without storing a token in the browser. */
export async function bootstrapSession(): Promise<void> {
  await refreshSession();
}

export async function signOut(): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  useAuthStore.getState().clear();
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // The local session is already gone; the refresh cookie expires on its own if the server was unreachable.
  }
}
