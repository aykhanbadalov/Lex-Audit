import { create } from "zustand";
import { readPreference, writePreference } from "@/shared/lib/storage";

export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "lexaudit.theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): "light" | "dark" {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", resolveTheme(mode, systemPrefersDark()) === "dark");
}

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const stored = readPreference(THEME_KEY);

export const useThemeStore = create<ThemeState>((set) => ({
  mode: isThemeMode(stored) ? stored : "system",
  setMode: (mode) => {
    writePreference(THEME_KEY, mode);
    applyTheme(mode);
    set({ mode });
  },
}));

/** Applies the saved theme once at startup and follows OS changes while the mode is "system". */
export function initTheme(): void {
  applyTheme(useThemeStore.getState().mode);
  if (typeof window.matchMedia === "function") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (useThemeStore.getState().mode === "system") applyTheme("system");
    });
  }
}
