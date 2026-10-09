// The only place allowed to touch web storage. Use it for UI preferences
// (language, theme) and never for tokens or business data (audit A-02).
/* eslint-disable no-restricted-globals */

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); preferences are optional.
  }
}
