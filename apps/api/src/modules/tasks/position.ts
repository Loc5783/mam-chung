import { AppError } from "../../utils/AppError";
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export function between(left: string | null, right: string | null): string {
  if (left !== null && right !== null && left >= right)
    throw new AppError(
      409,
      "ORDER_CHANGED",
      "Thứ tự đã thay đổi. Tải lại danh sách.",
    );
  if (right === null && left) {
    for (let i = left.length - 1; i >= 0; i--) {
      const digit = alphabet.indexOf(left[i]);
      if (digit < 0)
        throw new AppError(
          409,
          "INVALID_POSITION",
          "Cần chuyển đổi thứ tự danh sách.",
        );
      if (digit < alphabet.length - 1)
        return left.slice(0, i) + alphabet[digit + 1];
    }
    return left + "V";
  }
  let prefix = "",
    a = left ?? "",
    b = right;
  for (let i = 0; i < 128; i++) {
    const low = a ? alphabet.indexOf(a[0]) : 0;
    const high = b === null ? alphabet.length : alphabet.indexOf(b[0]);
    if (low < 0 || high < 0)
      throw new AppError(
        409,
        "INVALID_POSITION",
        "Cần chuyển đổi thứ tự danh sách.",
      );
    if (high - low > 1) return prefix + alphabet[Math.floor((low + high) / 2)];
    prefix += alphabet[low];
    a = a.slice(1);
    b = low === high && b !== null ? b.slice(1) : null;
  }
  throw new AppError(
    409,
    "POSITION_LIMIT",
    "Thứ tự cần được bảo trì trước khi chèn tiếp.",
  );
}
