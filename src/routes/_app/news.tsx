import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/shared/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/news")({
  component: () => <ModulePlaceholder moduleKey="news" permission="news:read" phase="F5" />,
});
