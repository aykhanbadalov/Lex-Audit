import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConversations } from "@/features/assistant/api";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/_app/assistant")({ component: AssistantLayout });

function AssistantLayout() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="assistant:use">
      <AssistantShell />
    </RequirePermission>
  );
}

function AssistantShell() {
  const { t } = useTranslation();
  const conversations = useConversations();
  return (
    <>
      <PageHeader title={t("nav.assistant")} description={t("modules.assistant")} />
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label={t("assistant.conversations")} className="space-y-2">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/assistant" activeOptions={{ exact: true }}>
              <MessageSquarePlus className="size-4" aria-hidden="true" />
              {t("assistant.newConversation")}
            </Link>
          </Button>
          {conversations.isPending ? (
            <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
          ) : conversations.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {conversations.error.message}
            </p>
          ) : conversations.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("assistant.noConversations")}</p>
          ) : (
            <ul className="space-y-1">
              {conversations.data.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    to="/assistant/$id"
                    params={{ id: conversation.id }}
                    className="block truncate rounded-md px-2.5 py-1.5 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    activeProps={{ className: "bg-accent font-medium", "aria-current": "page" }}
                  >
                    {conversation.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
        <section aria-label={t("nav.assistant")} className="min-w-0">
          <Outlet />
        </section>
      </div>
    </>
  );
}
