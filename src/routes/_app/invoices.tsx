import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/shared/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/invoices")({
  component: () => <ModulePlaceholder moduleKey="invoices" permission="invoices:read" phase="F7" />,
});
