import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../auth/store";
import { apiClient } from "../../lib/apiClient";
import { Wallet, Category, Page, FinanceDashboard } from "./types";
async function allPages<T>(url: string) {
  const items: T[] = [];
  let page = 1,
    total = 0;
  do {
    const { data } = await apiClient.get<Page<T>>(url, {
      params: { page, limit: 100 },
    });
    if (!data.items.length) break;
    items.push(...data.items);
    total = data.total;
    page++;
  } while (items.length < total);
  return items;
}
export function useFinanceOptions() {
  const userId = useAuthStore((s) => s.user!.id);
  const wallets = useQuery({
    queryKey: ["finance", userId, "wallets"],
    queryFn: () => allPages<Wallet>("/wallets"),
  });
  const categories = useQuery({
    queryKey: ["finance", userId, "categories"],
    queryFn: () => allPages<Category>("/categories"),
  });
  return { wallets, categories };
}
export function useFinanceDashboard() {
  const userId = useAuthStore((s) => s.user!.id);
  return useQuery({
    queryKey: ["finance", userId, "dashboard"],
    queryFn: async () =>
      (await apiClient.get<FinanceDashboard>("/finance/dashboard")).data,
  });
}
export function useInvalidateFinance() {
  const client = useQueryClient();
  const userId = useAuthStore((s) => s.user!.id);
  return () => client.invalidateQueries({ queryKey: ["finance", userId] });
}
export function localInputDate(value: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function displayDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
