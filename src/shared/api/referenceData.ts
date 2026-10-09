import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";

export type Account = Item<Json<"/accounts">>;
export type TaxRate = Item<Json<"/tax-rates">>;

/** Data that rarely changes and several screens need: the chart of accounts and the VAT rates in force. */
export const referenceKeys = {
  accounts: ["accounts"] as const,
  taxRates: ["tax-rates"] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: referenceKeys.accounts,
    queryFn: async ({ signal }) => unwrap(await api.GET("/accounts", { signal })),
    staleTime: 10 * 60_000,
  });
}

/** VAT rates in force today. A rate that is only proposed is not offered for invoices. */
export function useTaxRates() {
  return useQuery({
    queryKey: referenceKeys.taxRates,
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/tax-rates", { signal, params: { query: { taxType: "VAT", status: "active" } } })),
    staleTime: 10 * 60_000,
  });
}

/** The account name in the interface language (Azerbaijani first, then the others). */
export function accountName(account: Account, language: string): string {
  const preferred = language.startsWith("ru")
    ? account.nameRu
    : language.startsWith("en")
      ? account.nameEn
      : account.nameAz;
  return preferred || account.nameAz || account.nameEn || account.nameRu || account.code;
}
