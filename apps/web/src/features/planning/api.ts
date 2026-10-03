import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../auth/store";
import { apiClient } from "../../lib/apiClient";
import { localInputDate } from "../finance/api";
import { Budget, Goal, Recurring, Report } from "./types";
export function usePlanningQuery<T>(
  name: string,
  path: string,
  params: Record<string, string | number> = {},
) {
  const id = useAuthStore((s) => s.user!.id);
  return useQuery({
    queryKey: ["finance", id, name, params],
    queryFn: async () => (await apiClient.get<T>(path, { params })).data,
  });
}
export function useBudgets(month?: string) {
  return usePlanningQuery<{ month: string; items: Budget[] }>(
    "budgets",
    "/budgets",
    month ? { month } : {},
  );
}
export function useGoals() {
  return usePlanningQuery<{ items: Goal[] }>("goals", "/goals");
}
export function useRecurring() {
  return usePlanningQuery<{ items: Recurring[] }>("recurring", "/recurring");
}
export function useReports(months: number, endMonth: string) {
  return usePlanningQuery<Report>("reports", "/reports/monthly", {
    months,
    endMonth,
  });
}
export function useCurrentMonth() {
  const zone = useAuthStore((s) => s.user!.timezone);
  return localInputDate(new Date(), zone).slice(0, 7);
}
export async function downloadCsv(
  params: Record<string, string | number> = {},
) {
  const response = await apiClient
    .get("/transactions/export", {
      params,
      responseType: "blob",
    })
    .catch(async (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        try {
          error.response.data = JSON.parse(await error.response.data.text());
        } catch {
          /* Keep the original error if the response is not JSON. */
        }
      }
      throw error;
    });
  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "mam-chung-transactions.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
