import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/shared/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/approvals")({
  component: () => <ModulePlaceholder moduleKey="approvals" permission="approvals:read" phase="F11" />,
});
