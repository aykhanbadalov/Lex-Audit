import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function NotFound() {
  const { t } = useTranslation();
  return <p className="p-8 text-center">{t("errors.notFound")}</p>;
}

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});
