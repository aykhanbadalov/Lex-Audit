import { Badge, type BadgeTone } from "@/shared/ui/badge";

export type RiskLevel = "low" | "medium" | "high" | "critical";

const RISK_TONE: Record<RiskLevel, BadgeTone> = {
  low: "success",
  medium: "info",
  high: "warning",
  critical: "danger",
};

export function RiskBadge({ level, label }: { level: RiskLevel; label: string }) {
  return <Badge tone={RISK_TONE[level]}>{label}</Badge>;
}

export function StatusBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <Badge tone={tone}>{label}</Badge>;
}
