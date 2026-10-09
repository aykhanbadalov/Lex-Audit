import { ApiError, toApiError } from "./errors";
import { toSessionUser, type BackendMe } from "./mapSession";
import type { paths } from "./schema";
import { useAuthStore } from "@/shared/stores/authStore";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
type Tokens = paths["/auth/login"]["post"]["responses"][200]["content"]["application/json"];

let inFlight: Promise<boolean> | null = null;

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/** Turns the tokens the backend issued into a signed-in session: the person comes from `/me`, never from the token. */
async function establishSession(tokens: Tokens): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/me`, {
    credentials: "include",
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!response.ok) throw toApiError(response.status, await readJson(response));
  const me = (await response.json()) as BackendMe;
  useAuthStore.getState().setSession(
    {
      accessToken: tokens.accessToken,
      expiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
      user: toSessionUser(me),
    },
    tokens.csrfToken,
  );
}

/** E-mail and password (and the 6-digit code when the account has two-factor sign-in). Throws an ApiError. */
export async function login(input: { email: string; password: string; mfaCode?: string }): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email, password: input.password, mfaCode: input.mfaCode || undefined }),
    });
  } catch (error) {
    throw new ApiError("NETWORK", error instanceof Error ? error.message : "Network error", 0, undefined, error);
  }
  if (!response.ok) throw toApiError(response.status, await readJson(response));
  await establishSession((await response.json()) as Tokens);
}

/** The backend answers 401 for both "wrong password" and "code needed"; only the message tells them apart. */
export function isMfaRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === "UNAUTHENTICATED" && /mfa code required/i.test(error.message);
}

/**
 * Exchanges the HttpOnly refresh cookie for a new access token.
 * The backend also wants the CSRF token that belongs to that cookie; after a page reload it must be fetched first.
 * Concurrent callers share one request, so a burst of 401s causes a single refresh (rotation would break a second one).
 * Uses plain fetch on purpose: going through the API client would run its 401 handling again and loop.
 */
export function refreshSession(): Promise<boolean> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function csrfToken(): Promise<string | null> {
  const known = useAuthStore.getState().csrfToken;
  if (known) return known;
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, { credentials: "include" });
  if (!response.ok) return null;
  return ((await response.json()) as { csrfToken: string }).csrfToken;
}

async function doRefresh(): Promise<boolean> {
  try {
    const csrf = await csrfToken();
    if (!csrf) {
      useAuthStore.getState().clear();
      return false;
    }
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrf },
    });
    if (!response.ok) {
      useAuthStore.getState().clear();
      return false;
    }
    await establishSession((await response.json()) as Tokens);
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
  const { accessToken, csrfToken: csrf } = useAuthStore.getState();
  useAuthStore.getState().clear();
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
    });
  } catch {
    // The local session is already gone; the refresh cookie expires on its own if the server was unreachable.
  }
}
