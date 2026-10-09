/**
 * Every mock path is anchored to the API base. A bare "*" prefix would also match the app's own page URLs
 * (reloading /news would return mocked JSON instead of the page), so never use a wildcard prefix here.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export function apiPath(path: string): string {
  return `${API_BASE}${path}`;
}
