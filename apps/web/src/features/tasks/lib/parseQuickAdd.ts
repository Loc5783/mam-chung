export type QuickContext = {
  timezone: string;
  user: { id: string; name: string };
  members: { id: string; name: string }[];
  lists: {
    id: string;
    name: string;
    coupleId: string | null;
    readOnly?: boolean;
    archivedAt?: string | null;
  }[];
  scope?: "personal" | "shared";
  listId?: string;
  deadline?: string;
  omitted?: string[];
};
export type QuickChip = {
  id: string;
  kind:
    | "date"
    | "time"
    | "priority"
    | "label"
    | "assignee"
    | "list"
    | "scope"
    | "recurrence";
  raw: string;
  start: number;
  end: number;
  label: string;
  value: unknown;
};
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
const valid = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !date.startsWith("0000") &&
  !Number.isNaN(Date.parse(date)) &&
  new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date;
const add = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export function parseQuickAdd(text: string, now: Date, context: QuickContext) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: context.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const today = `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
  const weekday = (day: number) =>
    add(today, (day - new Date(today + "T12:00:00Z").getUTCDay() + 7) % 7);
  const candidates: QuickChip[] = [],
    warnings: string[] = [];
  const occupied = (start: number, end: number) =>
    candidates.some((c) => start < c.end && end > c.start);
  const chip = (
    kind: QuickChip["kind"],
    match: RegExpMatchArray,
    label: string,
    value: unknown,
  ) => {
    const start = match.index!,
      end = start + match[0].length;
    if (occupied(start, end)) return;
    candidates.push({
      id: `${kind}:${start}:${match[0]}`,
      kind,
      raw: match[0],
      start,
      end,
      label,
      value,
    });
  };
  for (const m of text.matchAll(/(?:\/ds\s+|~)([^\n!#@*~]+)/giu)) {
    const rest = m[1].trimStart(),
      names = context.lists
        .filter((l) => !l.readOnly && !l.archivedAt)
        .filter(
          (l) =>
            normalize(rest).startsWith(normalize(l.name)) &&
            (!rest[l.name.length] || /\s/.test(rest[l.name.length])),
        )
        .sort((a, b) => b.name.length - a.name.length);
    if (!names.length) {
      warnings.push(`Chưa nhận ra danh sách: ${rest.trim()}.`);
      continue;
    }
    const length = names[0].name.length,
      chosen = names.filter(
        (l) => normalize(l.name) === normalize(names[0].name),
      );
    if (chosen.length !== 1) {
      warnings.push("Tên danh sách trùng nhau; chọn danh sách trước khi thêm.");
      continue;
    }
    const prefix = m[0].length - m[1].length;
    m[0] =
      m[0].slice(0, prefix) +
      m[1].slice(0, m[1].length - m[1].trimStart().length + length);
    chip("list", m, `Danh sách: ${chosen[0].name}`, {
      id: chosen[0].id,
      scope: chosen[0].coupleId ? "shared" : "personal",
    });
  }
  for (const m of text.matchAll(/#[\p{L}\p{N}_-]+/gu)) {
    if (occupied(m.index!, m.index! + m[0].length)) continue;
    const label = m[0].slice(1);
    if (label.length > 30) {
      warnings.push("Nhãn chỉ được tối đa30 ký tự.");
      continue;
    }
    chip("label", m, `Nhãn: ${label}`, label);
  }
  for (const m of text.matchAll(/@([\p{L}\p{N}_-]+)/gu)) {
    if (occupied(m.index!, m.index! + m[0].length)) continue;
    const name = normalize(m[1]),
      members = [context.user, ...context.members].filter(
        (member, index, all) =>
          all.findIndex((x) => x.id === member.id) === index,
      );
    const matches = ["toi", "me"].includes(name)
      ? [context.user]
      : members.filter((member) =>
          [
            normalize(member.name).replace(/\s+/g, "-"),
            normalize(member.name.split(" ").at(-1) ?? ""),
          ].includes(name),
        );
    if (matches.length !== 1) {
      warnings.push(
        `Chưa xác định được ${m[0]}; dùng @tôi hoặc tên duy nhất của người ấy.`,
      );
      continue;
    }
    chip("assignee", m, `Giao: ${matches[0].name}`, matches[0].id);
  }
  for (const m of text.matchAll(
    /!([1-4]|khẩn|cao|vừa|thấp)(?![\p{L}\p{N}])/giu,
  )) {
    const value = (
      {
        "1": "URGENT",
        "2": "HIGH",
        "3": "MEDIUM",
        "4": "LOW",
        khan: "URGENT",
        cao: "HIGH",
        vua: "MEDIUM",
        thap: "LOW",
      } as Record<string, "URGENT" | "HIGH" | "MEDIUM" | "LOW">
    )[normalize(m[1])];
    chip(
      "priority",
      m,
      `Ưu tiên: ${{ URGENT: "Khẩn", HIGH: "Cao", MEDIUM: "Vừa", LOW: "Thấp" }[value]}`,
      value,
    );
  }
  for (const m of text.matchAll(/\*chung(?![\p{L}\p{N}])/giu))
    chip("scope", m, "Việc chung", "shared");
  for (const m of text.matchAll(
    /(?<![\p{L}\p{N}])(?:mỗi ngày|mỗi tuần|mỗi tháng|hằng thứ\s*[2-7]|hàng thứ\s*[2-7])(?![\p{L}\p{N}])/giu,
  )) {
    const phrase = normalize(m[0]),
      day = /thu/.test(phrase) ? Number(phrase.at(-1)) - 1 : null,
      frequency = phrase.includes("ngay")
        ? "daily"
        : phrase.includes("thang")
          ? "monthly"
          : "weekly";
    chip(
      "recurrence",
      m,
      `Lặp: ${m[0]} · bắt đầu ${day === null ? today : weekday(day)}`,
      { frequency, day, deadline: day === null ? today : weekday(day) },
    );
  }
  for (const m of text.matchAll(
    /(?<![\p{L}\p{N}@#])(?:ngày mai|hôm nay|tuần sau|cuối tuần|chủ nhật|thứ\s*[2-7]|mốt|mai|\d{1,2}\/\d{1,2}(?:\/\d{4})?)(?![\p{L}\p{N}])/giu,
  )) {
    if (occupied(m.index!, m.index! + m[0].length)) continue;
    if (m[0] === "Mai") continue;
    const raw = normalize(m[0]);
    let date = today;
    if (raw === "mai" || raw === "ngay mai") date = add(today, 1);
    else if (raw === "mot") date = add(today, 2);
    else if (raw === "tuan sau") date = add(today, 7);
    else if (raw === "cuoi tuan") {
      const day = new Date(today + "T12:00:00Z").getUTCDay();
      date = day === 0 || day === 6 ? today : weekday(6);
    } else if (raw === "chu nhat") date = weekday(0);
    else if (raw.startsWith("thu")) date = weekday(Number(raw.at(-1)) - 1);
    else if (raw.includes("/")) {
      const [d, mo, y] = raw.split("/").map(Number),
        year = Number(today.slice(0, 4));
      date = `${y || year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!y) {
        let offset = 0;
        while ((!valid(date) || date < today) && offset < 8) {
          offset++;
          date = `${year + offset}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        }
      }
    }
    if (!valid(date)) {
      warnings.push(`Ngày không hợp lệ: ${m[0]}.`);
      continue;
    }
    chip("date", m, `Hạn: ${date}`, date);
  }
  for (const m of text.matchAll(
    /(?<![\p{L}\p{N}@#])(?:\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2}|chiều|tối)(?![\p{L}\p{N}])/giu,
  )) {
    if (occupied(m.index!, m.index! + m[0].length)) continue;
    const raw = normalize(m[0]),
      p =
        raw === "chieu"
          ? [15, 0]
          : raw === "toi"
            ? [20, 0]
            : raw.split(/[h:]/).map(Number),
      hour = p[0],
      minute = p[1] ?? 0;
    if (hour > 23 || minute > 59) {
      warnings.push(`Giờ không hợp lệ: ${m[0]}.`);
      continue;
    }
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    chip("time", m, `Giờ: ${time}`, time);
  }
  if (
    !candidates.some((c) => c.kind === "date") &&
    !context.deadline &&
    !candidates.some((c) => c.kind === "recurrence")
  )
    for (const c of candidates.filter((c) => c.kind === "time"))
      c.label += ` · hôm nay ${today}`;
  const chips = candidates
    .filter((c) => !context.omitted?.includes(c.id))
    .sort((a, b) => a.start - b.start);
  for (const kind of [
    "date",
    "time",
    "priority",
    "assignee",
    "list",
    "scope",
    "recurrence",
  ]) {
    if (chips.filter((c) => c.kind === kind).length > 1)
      warnings.push(`Có nhiều chỉ dẫn ${kind}; gỡ chip để chọn một giá trị.`);
  }
  const find = (kind: QuickChip["kind"]) =>
    chips.find((c) => c.kind === kind)?.value;
  const list = find("list") as
      { id: string; scope: "personal" | "shared" } | undefined,
    rec = find("recurrence") as
      | {
          frequency: "daily" | "weekly" | "monthly";
          day: number | null;
          deadline: string;
        }
      | undefined;
  const deadline =
    (find("date") as string | undefined) ??
    rec?.deadline ??
    context.deadline ??
    (find("time") ? today : undefined);
  if (
    rec?.day !== null &&
    rec?.day !== undefined &&
    deadline &&
    new Date(deadline + "T12:00:00Z").getUTCDay() !== rec.day
  )
    warnings.push("Hạn chót không khớp thứ lặp lại; gỡ hoặc sửa chip hạn.");
  const scope = (find("scope") ??
    list?.scope ??
    context.scope ??
    "personal") as "personal" | "shared";
  if (list && scope !== list.scope)
    warnings.push("Danh sách và không gian không khớp nhau.");
  const assignedTo =
    (find("assignee") as string | undefined) ?? context.user.id;
  if (scope === "personal" && assignedTo !== context.user.id)
    warnings.push("Giao cho người ấy cần *chung hoặc một danh sách chung.");
  if (
    scope === "shared" &&
    !context.members.some((m) => m.id !== context.user.id)
  )
    warnings.push("Bạn cần một couple đang hoạt động để tạo việc chung.");
  for (const c of chips) {
    if (c.kind === "time") c.label = `Giờ: ${String(c.value)} · ${deadline}`;
    if (c.kind === "recurrence")
      c.label = `Lặp: ${c.raw} · bắt đầu ${deadline}`;
  }
  const labels = [
    ...new Set(
      chips.filter((c) => c.kind === "label").map((c) => c.value as string),
    ),
  ];
  if (labels.length > 10) warnings.push("Tối đa10 nhãn cho mỗi việc.");
  let title = text;
  for (const c of [...chips].reverse())
    title = title.slice(0, c.start) + " " + title.slice(c.end);
  title = title.replace(/\s+/g, " ").trim();
  if (!title) warnings.push("Nhập tiêu đề công việc.");
  if (title.length > 160) warnings.push("Tiêu đề tối đa160 ký tự.");
  return {
    title,
    chips,
    warnings: [...new Set(warnings)],
    values: {
      scope,
      assignedTo,
      listId: list?.id ?? context.listId ?? null,
      deadline: deadline ?? null,
      deadlineHasTime: !!find("time"),
      deadlineTime: (find("time") as string | undefined) ?? null,
      deadlineTimezone: find("time") ? context.timezone : null,
      priority:
        (find("priority") as
          "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined) ?? "MEDIUM",
      labels,
      recurrence: rec?.frequency ?? "none",
    },
  };
}
