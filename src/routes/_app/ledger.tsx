import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/shared/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/ledger")({
  component: () => <ModulePlaceholder moduleKey="ledger" permission="ledger:read" phase="F8" />,
});
