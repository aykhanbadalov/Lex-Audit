import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatDateTime } from "./date";

afterEach(() => vi.unstubAllEnvs());

describe("formatDate", () => {
  it("uses the full month name in Azerbaijani", () => {
    expect(formatDate("2026-10-09T12:00:00Z", "az-Latn-AZ")).toBe("9 oktyabr 2026");
  });

  it("names all twelve months in Azerbaijani without depending on the browser", () => {
    const months = [
      "yanvar",
      "fevral",
      "mart",
      "aprel",
      "may",
      "iyun",
      "iyul",
      "avqust",
      "sentyabr",
      "oktyabr",
      "noyabr",
      "dekabr",
    ];
    months.forEach((name, index) => {
      const mm = String(index + 1).padStart(2, "0");
      expect(formatDate(`2026-${mm}-15T12:00:00Z`, "az-Latn-AZ")).toBe(`15 ${name} 2026`);
    });
  });

  it("accepts any Azerbaijani locale tag", () => {
    for (const tag of ["az", "az-AZ", "az-Latn", "az-Latn-AZ"]) {
      expect(formatDate("2026-10-09T12:00:00Z", tag)).toBe("9 oktyabr 2026");
    }
  });

  it("uses the full month name in Russian and English", () => {
    expect(formatDate("2026-10-09T12:00:00Z", "ru-RU")).toContain("октября");
    expect(formatDate("2026-10-09T12:00:00Z", "en-US")).toBe("October 9, 2026");
  });

  it("shows a calendar date as the same day in any time zone", () => {
    vi.stubEnv("TZ", "America/Los_Angeles"); // an offset that would turn midnight UTC into the previous evening
    expect(formatDate("2000-07-11", "en-US")).toBe("July 11, 2000");
    vi.stubEnv("TZ", "Pacific/Kiritimati");
    expect(formatDate("2000-07-11", "en-US")).toBe("July 11, 2000");
    vi.stubEnv("TZ", "America/Los_Angeles");
    expect(formatDate("2000-07-11", "az-Latn-AZ")).toBe("11 iyul 2000");
  });
});

describe("formatDateTime", () => {
  it("never inserts an English 'at' into an Azerbaijani date", () => {
    const text = formatDateTime("2026-10-09T05:40:00Z", "az-Latn-AZ");
    expect(text).toContain("oktyabr 2026");
    expect(text).not.toMatch(/\bat\b/);
    expect(text).toMatch(/\d{2}:\d{2}$/);
  });
});
