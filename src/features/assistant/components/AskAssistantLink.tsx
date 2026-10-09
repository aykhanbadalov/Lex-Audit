import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePermission } from "@/shared/hooks/usePermission";
import { Button } from "@/shared/ui/button";
import type { Attachment } from "../api";

/** Opens the assistant already pointed at one resource. Shown only to people who may use the assistant. */
export function AskAssistantLink({ resource }: { resource: Attachment }) {
  const { t } = useTranslation();
  const allowed = usePermission("assistant:use");
  if (!allowed) return null;
  return (
    <Button asChild variant="outline" size="sm">
      <Link
        to="/assistant"
        search={{ contextType: resource.type, contextId: resource.id, contextTitle: resource.title }}
      >
        <Bot className="size-4" aria-hidden="true" />
        {t("assistant.ask")}
      </Link>
    </Button>
  );
}
