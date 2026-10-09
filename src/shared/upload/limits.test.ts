import { describe, expect, it } from "vitest";
import { ALLOWED_EXTENSIONS, checkUpload, extensionOf, MAX_UPLOAD_BYTES } from "./limits";

describe("checkUpload", () => {
  it("accepts every allowed type, whatever the letter case", () => {
    for (const extension of ALLOWED_EXTENSIONS) {
      expect(checkUpload({ name: `fayl.${extension}`, size: 10 })).toBeNull();
      expect(checkUpload({ name: `FAYL.${extension.toUpperCase()}`, size: 10 })).toBeNull();
    }
  });

  it("rejects an empty file", () => {
    expect(checkUpload({ name: "a.pdf", size: 0 })).toBe("empty");
  });

  it("allows exactly the maximum and rejects one byte more", () => {
    expect(checkUpload({ name: "a.pdf", size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(checkUpload({ name: "a.pdf", size: MAX_UPLOAD_BYTES + 1 })).toBe("tooLarge");
  });

  it("rejects types that are not allowed, including executables and double extensions", () => {
    expect(checkUpload({ name: "virus.exe", size: 10 })).toBe("unsupportedType");
    expect(checkUpload({ name: "script.js", size: 10 })).toBe("unsupportedType");
    expect(checkUpload({ name: "qaimə.pdf.exe", size: 10 })).toBe("unsupportedType");
    expect(checkUpload({ name: "extensionless", size: 10 })).toBe("unsupportedType");
  });
});

describe("extensionOf", () => {
  it("takes the part after the last dot", () => {
    expect(extensionOf("a.b.c.PDF")).toBe("pdf");
    expect(extensionOf("noext")).toBe("");
  });
});
