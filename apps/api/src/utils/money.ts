import { AppError } from "./AppError";
export function requireMoney(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Số tiền phải là số nguyên VND lớn hơn 0.",
    );
  return value;
}
export function splitEqual(amount: number, payerId: string, otherId: string) {
  requireMoney(amount);
  const half = Math.floor(amount / 2);
  return [
    { userId: payerId, shareAmount: amount - half },
    { userId: otherId, shareAmount: half },
  ];
}
