import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/shared/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/excel")({
  component: () => <ModulePlaceholder moduleKey="excel" permission="excel:read" phase="F9" />,
});
