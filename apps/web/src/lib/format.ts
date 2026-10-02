import { format } from "date-fns";
import { vi } from "date-fns/locale";
export const formatMoney = (amount: number) =>
  `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
export const formatDate = (date: Date) =>
  format(date, "dd/MM/yyyy", { locale: vi });
