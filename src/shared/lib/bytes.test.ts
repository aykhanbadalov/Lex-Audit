import { describe, expect, it } from "vitest";
import { formatBytes } from "./bytes";

describe("formatBytes", () => {
  it("shows small sizes in bytes", () => {
    expect(formatBytes(0, "az")).toBe("0 B");
    expect(formatBytes(999, "en-US")).toBe("999 B");
  });

  it("scales to KB, MB and GB with one decimal at most", () => {
    expect(formatBytes(1024, "en-US")).toBe("1 KB");
    expect(formatBytes(1536, "en-US")).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024, "en-US")).toBe("5 MB");
    expect(formatBytes(3 * 1024 ** 3, "en-US")).toBe("3 GB");
  });

  it("uses a decimal comma in Azerbaijani and Russian", () => {
    expect(formatBytes(1536, "az-Latn-AZ")).toBe("1,5 KB");
    expect(formatBytes(1536, "ru-RU")).toBe("1,5 КБ");
  });

  it("drops the decimals for values of 100 or more", () => {
    expect(formatBytes(150 * 1024, "en-US")).toBe("150 KB");
  });
});
