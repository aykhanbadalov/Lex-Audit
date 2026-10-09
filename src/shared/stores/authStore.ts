import { create } from "zustand";
import type { SessionUser } from "@/api/mapSession";

export type { SessionUser };
export interface Session {
  accessToken: string;
  expiresAt: string;
  user: SessionUser;
}

interface AuthState {
  /** Access token lives in memory only. It is never written to web storage (audit A-02). */
  accessToken: string | null;
  expiresAt: string | null;
  user: SessionUser | null;
  /** Pairs with the refresh cookie; the backend requires it on refresh and logout. Memory only, like the access token. */
  csrfToken: string | null;
  setSession: (session: Session, csrfToken?: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  expiresAt: null,
  user: null,
  csrfToken: null,
  setSession: (session, csrfToken) =>
    set((state) => ({
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      user: session.user,
      csrfToken: csrfToken ?? state.csrfToken,
    })),
  clear: () => set({ accessToken: null, expiresAt: null, user: null, csrfToken: null }),
}));

export function isAuthenticated(): boolean {
  const { accessToken, expiresAt } = useAuthStore.getState();
  return Boolean(accessToken && expiresAt && Date.parse(expiresAt) > Date.now());
}
