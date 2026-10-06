import { describe, it, expect } from "vitest";
import { parseQuickAdd, type QuickContext } from "./parseQuickAdd";
const now = new Date("2026-10-06T03:00:00Z");
const context: QuickContext = {
  timezone: "Asia/Ho_Chi_Minh",
  user: { id: "minh", name: "Minh" },
  members: [{ id: "lan", name: "Lan" }],
  lists: [
    { id: "home", name: "Nhà", coupleId: null },
    { id: "shared", name: "Việc chung", coupleId: "couple" },
  ],
};
const parse = (text: string, c: QuickContext = context, date = now) =>
  parseQuickAdd(text, date, c);
describe("Vietnamese quick add", () => {
  it.each([
    ["hôm nay", "2026-10-06"],
    ["mai", "2026-10-07"],
    ["ngày mai", "2026-10-07"],
    ["mốt", "2026-10-08"],
    ["tuần sau", "2026-10-13"],
    ["thứ 2", "2026-10-12"],
    ["thứ 3", "2026-10-06"],
    ["thứ 4", "2026-10-07"],
    ["thứ 5", "2026-10-08"],
    ["thứ 6", "2026-10-09"],
    ["thứ 7", "2026-10-10"],
    ["chủ nhật", "2026-10-11"],
    ["cuối tuần", "2026-10-10"],
    ["20/10", "2026-10-20"],
    ["1/1", "2027-01-01"],
    ["20/10/2026", "2026-10-20"],
    ["29/2", "2028-02-29"],
    ["5/10/2026", "2026-10-05"],
  ])("parses %s", (token, date) => {
    const p = parse(`Mua sữa ${token}`);
    expect(p.title).toBe("Mua sữa");
    expect(p.values.deadline).toBe(date);
    expect(p.warnings).toEqual([]);
  });
  it.each([
    ["8h", "08:00"],
    ["8h30", "08:30"],
    ["20:00", "20:00"],
    ["chiều", "15:00"],
    ["tối", "20:00"],
    ["0h", "00:00"],
    ["23h59", "23:59"],
  ])("parses time %s", (token, time) => {
    const p = parse(`Tập ${token}`);
    expect(p.values.deadlineTime).toBe(time);
    expect(p.chips[0].label).toContain("2026-10-06");
  });
  it.each([
    ["!1", "URGENT"],
    ["!2", "HIGH"],
    ["!3", "MEDIUM"],
    ["!4", "LOW"],
    ["!khẩn", "URGENT"],
    ["!cao", "HIGH"],
    ["!vừa", "MEDIUM"],
    ["!thấp", "LOW"],
  ])("priority %s", (token, value) =>
    expect(parse(`Tập ${token}`).values.priority).toBe(value),
  );
  it.each([
    "31/2",
    "32/10",
    "24h",
    "8h60",
    "mai mốt",
    "!1 !2",
    "@không-biết",
    "~không-biết",
  ])("warns %s", (token) =>
    expect(parse(`Tập ${token}`).warnings.length).toBeGreaterThan(0),
  );
  it("keeps ordinary text", () =>
    expect(parse("Gọi cho Mai").title).toBe("Gọi cho Mai"));
  it("recognizes labels without interpreting their date words", () => {
    const p = parse("Tập #mai #hóa-đơn #mai");
    expect(p.values.labels).toEqual(["mai", "hóa-đơn"]);
    expect(p.values.deadline).toBeNull();
  });
  it("assigns self", () =>
    expect(parse("Tập @tôi").values.assignedTo).toBe("minh"));
  it("requires shared scope for partner", () =>
    expect(parse("Tập @lan").warnings.length).toBeGreaterThan(0));
  it("assigns partner with visible shared chip", () => {
    const p = parse("Tập @lan *chung");
    expect(p.values.assignedTo).toBe("lan");
    expect(p.values.scope).toBe("shared");
    expect(p.warnings).toEqual([]);
  });
  it.each(["/ds Nhà", "~Nhà"])("recognizes list %s", (token) => {
    const p = parse(`Tập ${token} mai`);
    expect(p.values.listId).toBe("home");
    expect(p.title).toBe("Tập");
  });
  it("uses shared list scope", () =>
    expect(parse("Tập ~Việc chung").values.scope).toBe("shared"));
  it.each([
    ["mỗi ngày", "daily"],
    ["mỗi tuần", "weekly"],
    ["mỗi tháng", "monthly"],
    ["hằng thứ 2", "weekly"],
  ])("recurrence %s", (token, value) => {
    const p = parse(`Tập ${token}`);
    expect(p.values.recurrence).toBe(value);
    expect(p.values.deadline).not.toBeNull();
  });
  it("restores omitted chip text", () => {
    const p = parse("Tập mai !cao");
    const restored = parse("Tập mai !cao", {
      ...context,
      omitted: [p.chips[0].id],
    });
    expect(restored.title).toBe("Tập mai");
    expect(restored.values.deadline).toBeNull();
  });
  it("uses user timezone across UTC boundary", () =>
    expect(
      parse("Tập hôm nay", context, new Date("2026-10-06T20:00:00Z")).values
        .deadline,
    ).toBe("2026-10-07"));
  it("rejects ambiguous member names", () =>
    expect(
      parse("Tập @lan *chung", {
        ...context,
        members: [...context.members, { id: "other", name: "Ngọc Lan" }],
      }).warnings.length,
    ).toBeGreaterThan(0));
  it("keeps empty title invalid", () =>
    expect(parse("mai !cao").warnings).toContain("Nhập tiêu đề công việc."));
  it("parses full example", () => {
    const p = parse("Đóng tiền nhà mai 9h !khẩn #hóa-đơn @tôi");
    expect(p.title).toBe("Đóng tiền nhà");
    expect(p.values).toMatchObject({
      deadline: "2026-10-07",
      deadlineTime: "09:00",
      priority: "URGENT",
      labels: ["hóa-đơn"],
      assignedTo: "minh",
    });
  });
});
