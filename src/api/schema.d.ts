/**
 * Placeholder that mirrors the shape `openapi-typescript` generates.
 * It is replaced by `pnpm api:gen` as soon as the backend publishes `backend/openapi.yaml`.
 * Do not hand-edit once the generated file exists.
 */
export interface paths {
  "/auth/login": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get?: never;
    put?: never;
    post: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: { content: { "application/json": components["schemas"]["LoginRequest"] } };
      responses: {
        200: { headers: { [name: string]: unknown }; content: { "application/json": components["schemas"]["Session"] } };
        401: { headers: { [name: string]: unknown }; content: { "application/json": components["schemas"]["ApiError"] } };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}

export interface components {
  schemas: {
    LoginRequest: { email: string; password: string };
    Session: { accessToken: string; expiresAt: string; user: components["schemas"]["User"] };
    User: {
      id: string;
      companyId: string;
      name: string;
      email: string;
      role: "viewer" | "accountant" | "chief_accountant" | "auditor" | "admin";
      permissions: string[];
    };
    ApiError: { error: { code: string; message: string; requestId: string } };
  };
}
