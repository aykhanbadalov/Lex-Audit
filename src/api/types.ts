import type { paths } from "./schema";

type Method = "get" | "post" | "put" | "patch" | "delete";

type Success = 200 | 201 | 202;

type JsonOf<R> = R extends { content: { "application/json": infer B } } ? B : never;

/** The JSON body a successful (2xx) call returns. */
export type Json<P extends keyof paths, M extends Method = "get"> =
  paths[P] extends Record<M, infer Op>
    ? Op extends { responses: infer R }
      ? JsonOf<R[Extract<keyof R, Success>]>
      : never
    : never;

/** The JSON body a call expects. */
export type Body<P extends keyof paths, M extends Method = "post"> =
  paths[P] extends Record<M, infer Op>
    ? Op extends { requestBody: { content: { "application/json": infer B } } }
      ? B
      : never
    : never;

/** One element of a list. */
export type Item<T> = T extends readonly (infer E)[] ? E : T extends { items: readonly (infer E)[] } ? E : never;
