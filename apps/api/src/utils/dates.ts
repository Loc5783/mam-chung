import { AppError } from "./AppError";
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
export function validDateOnly(value: string) {
  if (!dateOnly.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    era: "short",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  return {
    year:
      parts.find((p) => p.type === "era")?.value === "BC"
        ? 1 - get("year")
        : get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}
function utcCalendar(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}
export function zonedDate(
  year: number,
  month: number,
  day: number,
  timeZone: string,
  hour = 0,
) {
  const wanted = utcCalendar(year, month, day, hour);
  const represented = (value: number) => {
    const p = localDateParts(new Date(value), timeZone);
    return utcCalendar(p.year, p.month, p.day, p.hour, p.minute, p.second);
  };
  // Examine offsets on both sides of a transition. At overlaps choose the
  // earliest instant; at gaps move forward by the skipped clock interval.
  const offsets = new Set<number>();
  for (let h = -48; h <= 48; h += 12) {
    const sample = wanted + h * 3600000;
    offsets.add(represented(sample) - sample);
  }
  const candidates = [...offsets].map((offset) => wanted - offset);
  const exact = candidates.filter((value) => represented(value) === wanted);
  if (exact.length) return new Date(Math.min(...exact));
  const forward = candidates.filter((value) => represented(value) > wanted);
  forward.sort((a, b) => represented(a) - represented(b) || a - b);
  if (!forward.length)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Ngày không hợp lệ trong múi giờ đã chọn.",
    );
  return new Date(forward[0]);
}
export function parseFinancialDate(value: string, timeZone: string) {
  if (dateOnly.test(value)) {
    if (!validDateOnly(value))
      throw new AppError(400, "VALIDATION_ERROR", "Ngày không hợp lệ.");
    const [year, month, day] = value.split("-").map(Number);
    const result = zonedDate(year, month, day, timeZone, 12);
    const actual = localDateParts(result, timeZone);
    if (actual.year !== year || actual.month !== month || actual.day !== day)
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Ngày không tồn tại trong múi giờ đã chọn.",
      );
    return result;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new AppError(400, "VALIDATION_ERROR", "Ngày không hợp lệ.");
  return date;
}
export function dateBounds(
  from: string | undefined,
  to: string | undefined,
  timeZone: string,
) {
  const lower = from
    ? zonedDate(
        ...(from.split("-").map(Number) as [number, number, number]),
        timeZone,
      )
    : undefined;
  let upper: Date | undefined;
  if (to) {
    const [y, m, d] = to.split("-").map(Number);
    const next = new Date(utcCalendar(y, m, d + 1));
    upper = zonedDate(
      next.getUTCFullYear(),
      next.getUTCMonth() + 1,
      next.getUTCDate(),
      timeZone,
    );
  }
  return { lower, upper };
}
export function monthBounds(now: Date, timeZone: string) {
  const p = localDateParts(now, timeZone);
  const previous = new Date(utcCalendar(p.year, p.month - 1, 1));
  const next = new Date(utcCalendar(p.year, p.month + 1, 1));
  return {
    start: zonedDate(p.year, p.month, 1, timeZone),
    previous: zonedDate(
      previous.getUTCFullYear(),
      previous.getUTCMonth() + 1,
      1,
      timeZone,
    ),
    end: zonedDate(next.getUTCFullYear(), next.getUTCMonth() + 1, 1, timeZone),
    month: `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}`,
  };
}
