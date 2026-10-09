import { create } from "zustand";
import type { components } from "@/api/schema";

export type SessionUser = components["schemas"]["User"];
export type Session = components["schemas"]["Session"];

interface AuthState {
  /** Access token lives in memory only. It is never written to web storage (audit A-02). */
  accessToken: string | null;
  expiresAt: string | null;
  user: SessionUser | null;
  setSession: (session: Session) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  expiresAt: null,
  user: null,
  setSession: (session) => set({ accessToken: session.accessToken, expiresAt: session.expiresAt, user: session.user }),
  clear: () => set({ accessToken: null, expiresAt: null, user: null }),
}));

export function isAuthenticated(): boolean {
  const { accessToken, expiresAt } = useAuthStore.getState();
  return Boolean(accessToken && expiresAt && Date.parse(expiresAt) > Date.now());
}
