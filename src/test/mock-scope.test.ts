import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { setupMockApi } from "./utils";

setupMockApi();

describe("mock API scope", () => {
  it("does not intercept the app's own page URLs (reloading /news must load the page, not mocked JSON)", async () => {
    const seen: string[] = [];
    server.events.on("request:unhandled", ({ request }) => seen.push(new URL(request.url).pathname));

    // onUnhandledFrame is "error" in tests, so an unmatched request rejects; what matters is that no handler claimed it.
    await fetch("http://localhost/news").catch(() => undefined);
    await fetch("http://localhost/legislation/leg-tax-code").catch(() => undefined);

    expect(seen).toEqual(["/news", "/legislation/leg-tax-code"]);
  });
});
