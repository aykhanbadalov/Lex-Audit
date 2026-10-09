export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "APPROVAL_REQUIRED"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL"
  | "NETWORK";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId: string | undefined;

  constructor(code: ApiErrorCode, message: string, status: number, requestId?: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; requestId?: string };
}

/** Converts an error response body into an ApiError. Unknown shapes become INTERNAL, never a fake success. */
export function toApiError(status: number, body: unknown): ApiError {
  const envelope = (body ?? {}) as ErrorEnvelope;
  const code = (envelope.error?.code as ApiErrorCode | undefined) ?? (status === 401 ? "UNAUTHENTICATED" : "INTERNAL");
  return new ApiError(
    code,
    envelope.error?.message ?? `Request failed with status ${status}`,
    status,
    envelope.error?.requestId,
  );
}
