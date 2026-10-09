import { ApiError } from "./errors";

/** openapi-fetch types `data` as optional. Error responses already throw in the middleware, so a missing body is a contract violation. */
export function unwrap<T>(result: { data?: T }): T {
  if (result.data === undefined) {
    throw new ApiError("INTERNAL", "The server returned an empty response", 500);
  }
  return result.data;
}
