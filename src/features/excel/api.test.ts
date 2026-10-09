import { describe, expect, it } from "vitest";
import { operationProblem } from "./api";

describe("operationProblem", () => {
  it("lets trimming run on all columns without picking any", () => {
    expect(operationProblem("trim_spaces", [])).toBeNull();
  });
  it("needs at least one key column to remove duplicates", () => {
    expect(operationProblem("remove_duplicates", [])).toBe("needColumn");
    expect(operationProblem("remove_duplicates", ["A", "C"])).toBeNull();
  });
  it("needs exactly one column to normalize dates", () => {
    expect(operationProblem("normalize_dates", [])).toBe("needOneColumn");
    expect(operationProblem("normalize_dates", ["A", "B"])).toBe("needOneColumn");
    expect(operationProblem("normalize_dates", ["A"])).toBeNull();
  });
});
