import { describe, expect, it } from "vitest";
import az from "@/locales/az.json";
import en from "@/locales/en.json";
import ru from "@/locales/ru.json";

function flatten(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1] ?? "").sort();
}

function flattenValues(value: unknown, prefix = ""): [string, string][] {
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => flattenValues(child, prefix ? `${prefix}.${key}` : key));
  }
  return [[prefix, String(value)]];
}

describe("locale files", () => {
  const azKeys = flatten(az).sort();

  it.each([
    ["ru", ru],
    ["en", en],
  ])("%s has exactly the same keys as az", (_name, locale) => {
    expect(flatten(locale).sort()).toEqual(azKeys);
  });

  it.each([
    ["ru", ru],
    ["en", en],
  ])("%s uses the same {{placeholders}} as az in every string", (_name, locale) => {
    const azValues = new Map(flattenValues(az));
    for (const [key, text] of flattenValues(locale)) {
      expect(placeholders(text), key).toEqual(placeholders(azValues.get(key) ?? ""));
    }
  });

  it("has no empty strings", () => {
    for (const [key, text] of [...flattenValues(az), ...flattenValues(ru), ...flattenValues(en)]) {
      expect(text.trim(), key).not.toBe("");
    }
  });
});
