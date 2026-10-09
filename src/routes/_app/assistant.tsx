import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/shared/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/assistant")({
  component: () => <ModulePlaceholder moduleKey="assistant" permission="assistant:use" phase="F10" />,
});
