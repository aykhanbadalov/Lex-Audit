import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

const CLASS =
  "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring";

/** Two sibling pages of the ledger, shown as one navigation. */
export function LedgerNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("ledger.navLabel")} className="mb-6 flex gap-1 border-b">
      <Link
        to="/ledger"
        className={CLASS}
        activeOptions={{ exact: true }}
        activeProps={{ className: "border-primary", "aria-current": "page" }}
      >
        {t("ledger.entries")}
      </Link>
      <Link
        to="/ledger/accounts"
        className={CLASS}
        activeProps={{ className: "border-primary", "aria-current": "page" }}
      >
        {t("ledger.accounts")}
      </Link>
    </nav>
  );
}
