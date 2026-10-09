import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/shared/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/vat")({
  component: () => <ModulePlaceholder moduleKey="vat" permission="vat:read" phase="F8" />,
});
