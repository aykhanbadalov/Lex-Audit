import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { unwrap } from "@/api/unwrap";

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

export function useTaxRates() {
  return useQuery({
    queryKey: referenceKeys.taxRates,
    queryFn: async ({ signal }) => unwrap(await api.GET("/tax-rates", { signal, params: { query: { type: "VAT" } } })),
    staleTime: 10 * 60_000,
  });
}
