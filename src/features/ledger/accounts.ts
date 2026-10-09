import type { components } from "@/api/schema";

export type Account = components["schemas"]["Account"];

export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
] as const satisfies readonly Account["type"][];

export interface AccountRow {
  account: Account;
  /** 0 for a top-level account, 1 for its children, and so on. */
  depth: number;
}

/**
 * Orders accounts by code with children directly under their parent, and works out how deep each one sits.
 * An account whose parent is unknown (not in the list) is shown at the top level instead of being dropped.
 */
export function buildAccountRows(accounts: readonly Account[]): AccountRow[] {
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const children = new Map<string | null, Account[]>();
  for (const account of accounts) {
    const parent = account.parentCode && byCode.has(account.parentCode) ? account.parentCode : null;
    children.set(parent, [...(children.get(parent) ?? []), account]);
  }
  const byCodeAsc = (a: Account, b: Account) => a.code.localeCompare(b.code, undefined, { numeric: true });

  const rows: AccountRow[] = [];
  const seen = new Set<string>();
  const visit = (parent: string | null, depth: number) => {
    for (const account of (children.get(parent) ?? []).sort(byCodeAsc)) {
      if (seen.has(account.code)) continue; // guards against a cycle in bad data
      seen.add(account.code);
      rows.push({ account, depth });
      visit(account.code, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

export function matchesAccount(account: Account, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("az");
  return !needle || account.code.includes(needle) || account.name.toLocaleLowerCase("az").includes(needle);
}
