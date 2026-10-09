import type { RiskLevel } from "@/shared/components/StatusBadge";

/** The model's risk label is free text on the wire; only the four known values are shown as a risk badge. */
export function riskLevel(value: string | null | undefined): RiskLevel | null {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : null;
}
