import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/shared/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/admin")({
  component: () => <ModulePlaceholder moduleKey="admin" permission="admin:manage" phase="F12" />,
});
