import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { ApiError, toApiError } from "./errors";
import { useAuthStore } from "@/shared/stores/authStore";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    request.headers.set("X-Request-Id", crypto.randomUUID());
    return request;
  },
  async onResponse({ response }) {
    if (response.ok) {
      return response;
    }
    // Never swallow a failed response: surface it as a typed error (audit A-05, A-13).
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    if (response.status === 401) {
      useAuthStore.getState().clear();
    }
    throw toApiError(response.status, body);
  },
  onError({ error }) {
    return new ApiError("NETWORK", error instanceof Error ? error.message : "Network error", 0);
  },
};

export const api = createClient<paths>({ baseUrl, credentials: "include" });
api.use(authMiddleware);
