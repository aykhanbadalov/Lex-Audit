import { describe, expect, it } from "vitest";
import { parseMultipart } from "./multipart";

function request(boundary: string, body: string): Request {
  return new Request("http://localhost/api/v1/files", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

describe("parseMultipart", () => {
  it("reads a file part (name, type, byte size) and repeated text fields", async () => {
    const body = [
      "--XYZ",
      'Content-Disposition: form-data; name="file"; filename="qaimə.pdf"',
      "Content-Type: application/pdf",
      "",
      "12345",
      "--XYZ",
      'Content-Disposition: form-data; name="folder"',
      "",
      "/Qaimələr",
      "--XYZ",
      'Content-Disposition: form-data; name="tags"',
      "",
      "ƏDV",
      "--XYZ",
      'Content-Disposition: form-data; name="tags"',
      "",
      "q3",
      "--XYZ--",
      "",
    ].join("\r\n");
    // Encode as real UTF-8 bytes, the way a browser sends it.
    const parsed = await parseMultipart(
      new Request("http://localhost/api/v1/files", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=XYZ" },
        body: new TextEncoder().encode(body),
      }),
    );

    expect(parsed?.file).toEqual({ fieldName: "file", name: "qaimə.pdf", type: "application/pdf", size: 5 });
    expect(parsed?.fields.get("folder")).toEqual(["/Qaimələr"]);
    expect(parsed?.fields.get("tags")).toEqual(["ƏDV", "q3"]);
  });

  it("counts file bytes, not characters", async () => {
    const parsed = await parseMultipart(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=B" },
        body: new Uint8Array([
          ...new TextEncoder().encode('--B\r\nContent-Disposition: form-data; name="file"; filename="a.bin"\r\n\r\n'),
          0,
          255,
          128,
          10,
          13,
          7,
          ...new TextEncoder().encode("\r\n--B--\r\n"),
        ]),
      }),
    );
    expect(parsed?.file?.size).toBe(6);
  });

  it("returns null when there is no boundary", async () => {
    expect(await parseMultipart(request("", "x").clone())).not.toBeUndefined();
    expect(await parseMultipart(new Request("http://localhost/x", { method: "POST", body: "plain" }))).toBeNull();
  });
});
