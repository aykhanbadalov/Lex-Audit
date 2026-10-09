import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ACCOUNT_TYPES, buildAccountRows, matchesAccount } from "@/features/ledger/accounts";
import { LedgerNav } from "@/features/ledger/components/LedgerNav";
import { useAccounts } from "@/shared/api/referenceData";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { useSearchText } from "@/shared/hooks/useSearchText";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export const Route = createFileRoute("/_app/ledger/accounts")({
  validateSearch: z.object({ q: z.coerce.string().optional().catch(undefined) }),
  component: AccountsPage,
});

function AccountsPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="ledger:read">
      <AccountsPageContent />
    </RequirePermission>
  );
}

function AccountsPageContent() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const accounts = useAccounts();
  const { text, onTextChange } = useSearchText(search.q, (q) => void navigate({ search: { q }, replace: true }));

  const groups = useMemo(() => {
    const matching = (accounts.data ?? []).filter((account) => matchesAccount(account, search.q ?? ""));
    return ACCOUNT_TYPES.map((type) => ({
      type,
      rows: buildAccountRows(matching.filter((account) => account.type === type)),
    })).filter((group) => group.rows.length > 0);
  }, [accounts.data, search.q]);

  return (
    <>
      <PageHeader title={t("nav.ledger")} description={t("modules.ledger")} />
      <LedgerNav />
      <div className="mb-6 max-w-md space-y-1.5">
        <Label htmlFor="acc-q">{t("news.filters.search")}</Label>
        <Input
          id="acc-q"
          type="search"
          value={text}
          placeholder={t("ledger.accountsSearch")}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </div>
      {accounts.isPending ? (
        <LoadingState />
      ) : accounts.isError ? (
        <ErrorState message={accounts.error.message} onRetry={() => void accounts.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState title={t("table.noResults")} description={t("table.noResultsHint")} />
      ) : (
        <div className="space-y-6">
          {groups.map(({ type, rows }) => (
            <section key={type} aria-labelledby={`acc-${type}`} className="space-y-2">
              <h2 id={`acc-${type}`} className="text-lg font-semibold">
                {t(`ledger.accountType.${type}`)}
              </h2>
              <table className="w-full max-w-3xl rounded-lg border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="w-28 px-3 py-2 text-left font-medium">
                      {t("ledger.columns.code")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      {t("ledger.columns.name")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ account, depth }) => (
                    <tr key={account.code} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{account.code}</td>
                      <td className="px-3 py-2" style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}>
                        {account.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
