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
export function safeMoney(value: number) {
  if (!Number.isSafeInteger(value))
    throw new AppError(
      422,
      "MONEY_OVERFLOW",
      "Số tiền vượt giới hạn tính toán an toàn.",
    );
  return value;
}
export function addMoney(...values: number[]) {
  const sum = values.reduce(
    (total, value) => total + BigInt(safeMoney(value)),
    0n,
  );
  if (
    sum > BigInt(Number.MAX_SAFE_INTEGER) ||
    sum < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new AppError(
      422,
      "MONEY_OVERFLOW",
      "Số tiền vượt giới hạn tính toán an toàn.",
    );
  return Number(sum);
}
export function sumMoney(values: number[]) {
  return decimalMoney(
    values.reduce((total, value) => total + BigInt(safeMoney(value)), 0n),
  );
}
export function moneyEffect(type: string, amount: number) {
  requireMoney(amount);
  return type === "income" ? amount : -amount;
}
export function decimalMoney(value: unknown) {
  const text = String(value);
  const parts = text.match(/^(-?)(\d+)(?:\.(\d+))?(?:E([+-]?\d+))?$/i);
  if (!parts)
    throw new AppError(
      422,
      "MONEY_OVERFLOW",
      "Số tiền vượt giới hạn tính toán an toàn.",
    );
  const fraction = parts[3] ?? "",
    shift = Number(parts[4] ?? 0) - fraction.length;
  let digits = parts[2] + fraction;
  if (shift > 16)
    throw new AppError(
      422,
      "MONEY_OVERFLOW",
      "Số tiền vượt giới hạn tính toán an toàn.",
    );
  if (shift < 0) {
    if (!digits.endsWith("0".repeat(-shift)))
      throw new AppError(
        422,
        "MONEY_OVERFLOW",
        "Sổ giao dịch chứa số tiền không nguyên.",
      );
    digits = digits.slice(0, shift) || "0";
  }
  const amount =
    BigInt((parts[1] || "") + digits) * (shift > 0 ? 10n ** BigInt(shift) : 1n);
  if (
    amount > BigInt(Number.MAX_SAFE_INTEGER) ||
    amount < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new AppError(
      422,
      "MONEY_OVERFLOW",
      "Số tiền vượt giới hạn tính toán an toàn.",
    );
  return Number(amount);
}
