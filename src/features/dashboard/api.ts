import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";

export type Notification = Item<Json<"/notifications">["items"]>;
export type Deadline = Item<Json<"/tax-calendar">>;

export const dashboardKeys = { notifications: ["notifications"] as const, calendar: ["tax-calendar"] as const };

export function useNotifications() {
  return useQuery({
    queryKey: dashboardKeys.notifications,
    queryFn: async ({ signal }) => unwrap(await api.GET("/notifications", { signal, params: { query: { limit: 8 } } })),
    refetchInterval: 60_000,
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/notifications/read-all")),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dashboardKeys.notifications }),
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.PUT("/notifications/{id}/read", { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dashboardKeys.notifications }),
  });
}

/** The tax deadlines from today on. The dates live in the backend's database, not in the code. */
export function useTaxCalendar(from: string) {
  return useQuery({
    queryKey: [...dashboardKeys.calendar, from],
    queryFn: async ({ signal }) => unwrap(await api.GET("/tax-calendar", { signal, params: { query: { from } } })),
    staleTime: 5 * 60_000,
  });
}
