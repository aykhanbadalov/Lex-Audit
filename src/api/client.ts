import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { ApiError, toApiError } from "./errors";
import { API_BASE_URL, refreshSession } from "./session";
import { useAuthStore } from "@/shared/stores/authStore";

// A request body can be read only once, so keep a copy to replay after a refresh.
const replayable = new Map<string, Request>();

function isAuthEndpoint(schemaPath: string): boolean {
  return schemaPath.startsWith("/auth/");
}

async function failure(response: Response): Promise<never> {
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  throw toApiError(response.status, body);
}

const authMiddleware: Middleware = {
  onRequest({ request, id, schemaPath }) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    request.headers.set("X-Request-Id", crypto.randomUUID());
    if (!isAuthEndpoint(schemaPath)) {
      replayable.set(id, request.clone());
    }
    return request;
  },

  async onResponse({ response, id, schemaPath }) {
    const original = replayable.get(id);
    replayable.delete(id);

    if (response.ok) {
      return response;
    }

    // Expired access token: refresh once and replay the request (audit A-07). Auth endpoints never retry.
    if (response.status === 401 && original && !isAuthEndpoint(schemaPath) && (await refreshSession())) {
      const retry = new Request(original, { headers: new Headers(original.headers) });
      retry.headers.set("Authorization", `Bearer ${useAuthStore.getState().accessToken ?? ""}`);
      const retried = await fetch(retry);
      if (retried.ok) {
        return retried;
      }
      return failure(retried);
    }

    if (response.status === 401) {
      useAuthStore.getState().clear();
    }
    // Never swallow a failed response: surface it as a typed error (audit A-05, A-13).
    return failure(response);
  },

  onError({ id, error }) {
    replayable.delete(id);
    // A cancelled request (a newer one replaced it, or the screen closed) is not a failure; leave it recognisable.
    if (error instanceof DOMException && error.name === "AbortError") return undefined;
    return new ApiError("NETWORK", error instanceof Error ? error.message : "Network error", 0, undefined, error);
  },
};

// openapi-fetch keeps a reference to `fetch` from the moment the client is created. Looking it up on every call instead
// means anything that replaces `globalThis.fetch` later (MSW in tests, instrumentation) is always honoured.
export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: "include",
  fetch: (request) => globalThis.fetch(request),
});
api.use(authMiddleware);
