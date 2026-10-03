import { ClientSession } from "mongoose";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { addMoney, sumMoney } from "../../utils/money";
import { parseFinancialDate, dateBounds, monthBounds } from "../../utils/dates";
import { User } from "../users/model";
import { userRepository } from "../users/repository";
import { Couple, CoupleMember, CoupleActivity } from "../couples/models";
import { coupleRepository } from "../couples/repository";
import { Category } from "../finance/models";
import { objectId } from "../finance/schema";
import {
  SharedWallet,
  SharedContribution,
  SharedTransaction,
  SharedSplit,
  Settlement,
  SharedGoal,
  SharedGoalContribution,
} from "./models";
import * as schema from "./schema";
function dateFilter(q: { from?: string; to?: string }, zone: string) {
  const bounds = dateBounds(q.from, q.to, zone);
  return bounds.lower || bounds.upper
    ? {
        date: {
          ...(bounds.lower ? { $gte: bounds.lower } : {}),
          ...(bounds.upper ? { $lt: bounds.upper } : {}),
        },
      }
    : {};
}
const missing = () =>
  new AppError(
    404,
    "NOT_FOUND",
    "Không tìm thấy dữ liệu chung hoặc bạn không có quyền truy cập.",
  );
const conflict = (code: string, message: string) =>
  new AppError(409, code, message);
async function context(
  userId: string,
  session: ClientSession,
  write = false,
  coupleId?: string,
) {
  const user = await userRepository.byId(userId, session);
  if (!user) throw missing();
  const id = coupleId ?? user.coupleId?.toString();
  if (!id) throw missing();
  const member = await coupleRepository.member(userId, id, session);
  if (!member) throw missing();
  if (write) {
    if (!member.active || user.coupleId?.toString() !== id) throw missing();
    if (!(await userRepository.touch(userId, user.securityVersion, session)))
      throw missing();
  }
  const couple = write
    ? await coupleRepository.lock(id, session)
    : await Couple.findOne({ _id: id, deletedAt: null }).session(session);
  if (!couple) throw missing();
  if (
    couple.status === "active" &&
    (!member.active || user.coupleId?.toString() !== id)
  )
    throw missing();
  const members = await CoupleMember.find({ coupleId: id, deletedAt: null })
    .sort({ _id: 1 })
    .session(session);
  const people = [];
  for (const m of members) {
    const live =
      couple.status === "active"
        ? await User.findOne({ _id: m.userId, deletedAt: null }).session(
            session,
          )
        : null;
    people.push({
      id: m.userId.toString(),
      name: live?.name ?? m.nameSnapshot,
      active: m.active,
    });
  }
  return {
    user,
    couple,
    member,
    people,
    id,
    readOnly: couple.status !== "active",
  };
}
type Context = Awaited<ReturnType<typeof context>>;
async function event(c: Context, message: string, session: ClientSession) {
  await CoupleActivity.create(
    [
      {
        coupleId: c.id,
        actorId: c.user._id,
        actorName: c.user.name,
        type: "shared_finance",
        message: `${c.user.name} ${message}`,
      },
    ],
    { session },
  );
}
async function wallet(
  c: Context,
  id: string,
  session: ClientSession,
  write = false,
) {
  const w = await SharedWallet.findOne({
    _id: id,
    coupleId: c.id,
    deletedAt: null,
  }).session(session);
  if (!w) throw missing();
  if (write && w.archived)
    throw conflict(
      "WALLET_ARCHIVED",
      "Quỹ đã lưu trữ. Hãy mở lại trước khi ghi nhận tiền.",
    );
  return w;
}
const walletDto = (w: InstanceType<typeof SharedWallet>) => ({
  id: w.id as string,
  name: w.name,
  balance: w.balance,
  archived: w.archived,
  createdAt: w.createdAt,
});
const goalDto = (g: InstanceType<typeof SharedGoal>) => ({
  id: g.id as string,
  name: g.name,
  targetAmount: g.targetAmount,
  savedAmount: g.savedAmount,
  deadline: g.deadline,
  notes: g.notes,
  progress: Math.round((g.savedAmount / g.targetAmount) * 1000) / 10,
});
const settlementDto = (s: InstanceType<typeof Settlement>) => ({
  id: s.id as string,
  fromUserId: s.fromUserId.toString(),
  toUserId: s.toUserId.toString(),
  fromName: s.fromName,
  toName: s.toName,
  amount: s.amount,
  status: s.status,
  sourceTransactionId: s.sourceTransactionId.toString(),
  notes: s.notes,
  createdAt: s.createdAt,
  markedAt: s.markedAt,
  paidAt: s.paidAt,
});
function page<T>(items: T[], p: number, limit: number) {
  return {
    items: items.slice((p - 1) * limit, p * limit),
    total: items.length,
    page: p,
    limit,
  };
}
export function calculateSplits(
  input: ReturnType<typeof schema.transactionCreateSchema.parse>,
  people: { id: string; name: string }[],
) {
  if (people.length !== 2 || !people.some((p) => p.id === input.payerId))
    throw new AppError(
      400,
      "INVALID_MEMBERS",
      "Cần đúng hai thành viên và người trả thuộc nhóm.",
    );
  const other = people.find((p) => p.id !== input.payerId)!;
  if (input.splitType === "equal") {
    if (input.splits)
      throw new AppError(400, "INVALID_SPLIT", "Chia đều được tính tự động.");
    const half = Math.floor(input.amount / 2);
    return people.map((p) => ({
      ...p,
      shareAmount: p.id === input.payerId ? input.amount - half : half,
    }));
  }
  const splits = input.splits;
  if (
    !splits ||
    new Set(splits.map((s) => s.userId)).size !== 2 ||
    splits.some((s) => !people.some((p) => p.id === s.userId))
  )
    throw new AppError(
      400,
      "INVALID_SPLIT",
      "Phần chia cần đủ hai thành viên khác nhau của nhóm.",
    );
  if (input.splitType === "custom") {
    if (
      splits.some(
        (s) => s.shareAmount === undefined || s.percent !== undefined,
      ) ||
      splits.reduce((total, item) => total + BigInt(item.shareAmount!), 0n) !==
        BigInt(input.amount)
    )
      throw new AppError(
        400,
        "INVALID_SPLIT",
        "Tổng phần chia phải bằng đúng số tiền.",
      );
    return people.map((p) => ({
      ...p,
      shareAmount: splits.find((s) => s.userId === p.id)!.shareAmount!,
    }));
  }
  if (
    splits.some((s) => s.percent === undefined || s.shareAmount !== undefined)
  )
    throw new AppError(
      400,
      "INVALID_SPLIT",
      "Vui lòng nhập tỷ lệ phần trăm cho cả hai người.",
    );
  const bps = splits.map((s) => ({
    id: s.userId,
    value: Math.round(s.percent! * 100),
  }));
  if (bps.reduce((n, s) => n + s.value, 0) !== 10000)
    throw new AppError(400, "INVALID_SPLIT", "Tổng tỷ lệ phải bằng 100%.");
  const otherShare = Number(
    (BigInt(input.amount) * BigInt(bps.find((s) => s.id === other.id)!.value)) /
      10000n,
  );
  return people.map((p) => ({
    ...p,
    shareAmount:
      p.id === input.payerId ? input.amount - otherShare : otherShare,
  }));
}
async function transactionDto(
  t: InstanceType<typeof SharedTransaction>,
  session: ClientSession,
) {
  const splits = await SharedSplit.find({
    sharedTransactionId: t._id,
    deletedAt: null,
  })
    .sort({ _id: 1 })
    .session(session);
  const w = await SharedWallet.findById(t.sharedWalletId).session(session);
  return {
    id: t.id as string,
    sharedWalletId: t.sharedWalletId.toString(),
    walletName: w?.name ?? "Quỹ chung",
    payerId: t.payerId.toString(),
    payerName: t.payerName,
    createdBy: t.createdBy.toString(),
    amount: t.amount,
    date: t.date,
    description: t.description,
    categoryId: t.categoryId.toString(),
    categoryName: t.categoryName,
    splitType: t.splitType,
    paidFrom: t.paidFrom,
    splits: splits.map((s) => ({
      userId: s.userId.toString(),
      name: s.name,
      shareAmount: s.shareAmount,
    })),
  };
}
async function summary(c: Context, session: ClientSession) {
  const rows = await Settlement.find({
    coupleId: c.id,
    deletedAt: null,
    status: { $ne: "paid" },
  }).session(session);
  const first = c.people[0];
  let net = 0n;
  for (const s of rows)
    net += BigInt(s.amount) * (s.fromUserId.toString() === first.id ? 1n : -1n);
  const amount = Number(net < 0n ? -net : net);
  if (!Number.isSafeInteger(amount))
    throw new AppError(
      422,
      "MONEY_OVERFLOW",
      "Công nợ ròng vượt giới hạn an toàn.",
    );
  const from = c.people[net >= 0n ? 0 : 1],
    to = c.people[net >= 0n ? 1 : 0];
  return {
    amount,
    fromUserId: amount ? from.id : null,
    toUserId: amount ? to.id : null,
    fromName: amount ? from.name : null,
    toName: amount ? to.name : null,
    outstandingCount: rows.length,
    pendingConfirmation: rows.filter((s) => s.status === "pending_confirm")
      .length,
  };
}
export const sharedService = {
  async wallets(userId: string, raw: unknown) {
    const q = schema.contextQuery.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, false, q.coupleId);
      return {
        items: (
          await SharedWallet.find({ coupleId: c.id, deletedAt: null })
            .sort({ createdAt: 1, _id: 1 })
            .session(s)
        ).map(walletDto),
        readOnly: c.readOnly,
        coupleId: c.id,
        members: c.people,
        role: c.member.role,
      };
    });
  },
  async createWallet(userId: string, raw: unknown) {
    const input = schema.walletCreate.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const [w] = await SharedWallet.create([{ ...input, coupleId: c.id }], {
        session: s,
      });
      await event(c, `đã tạo quỹ ${w.name}.`, s);
      return walletDto(w);
    });
  },
  async updateWallet(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = schema.walletUpdate.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const w = await wallet(c, id, s);
      Object.assign(w, input);
      await w.save({ session: s });
      await event(c, "đã cập nhật một quỹ chung.", s);
      return walletDto(w);
    });
  },
  async deleteWallet(userId: string, rawId: unknown) {
    const id = objectId.parse(rawId);
    await inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const w = await wallet(c, id, s);
      if (
        (await SharedContribution.exists({ sharedWalletId: id }).session(s)) ||
        (await SharedTransaction.exists({ sharedWalletId: id }).session(s))
      )
        throw conflict(
          "WALLET_HAS_HISTORY",
          "Quỹ đã có lịch sử. Hãy lưu trữ để giữ sổ tiền.",
        );
      w.deletedAt = new Date();
      await w.save({ session: s });
      await event(c, "đã xóa quỹ chưa có lịch sử.", s);
    });
  },
  async contribute(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = schema.contribution.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, true),
        w = await wallet(c, id, s, true);
      w.balance = addMoney(w.balance, input.amount);
      await w.save({ session: s });
      const [entry] = await SharedContribution.create(
        [
          {
            ...input,
            date: parseFinancialDate(input.date, c.user.timezone),
            coupleId: c.id,
            sharedWalletId: id,
            userId,
            actorName: c.user.name,
          },
        ],
        { session: s },
      );
      await event(c, `đã ghi nhận nạp quỹ ${w.name}.`, s);
      return { wallet: walletDto(w), contributionId: entry.id };
    });
  },
  async contributions(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      q = schema.listQuery.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, false, q.coupleId);
      await wallet(c, id, s);
      const rows = await SharedContribution.find({
        sharedWalletId: id,
        coupleId: c.id,
        deletedAt: null,
        ...dateFilter(q, c.user.timezone),
      })
        .sort({ date: -1, _id: -1 })
        .session(s);
      return {
        ...page(
          rows.map((r) => ({
            id: r.id,
            userId: r.userId.toString(),
            actorName: r.actorName,
            amount: r.amount,
            date: r.date,
            notes: r.notes,
          })),
          q.page,
          q.limit,
        ),
        readOnly: c.readOnly,
      };
    });
  },
  async createTransaction(userId: string, raw: unknown) {
    const input = schema.transactionCreateSchema.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, true),
        w = await wallet(c, input.sharedWalletId, s, true);
      const splits = calculateSplits(
        input,
        c.people.filter((p) => p.active),
      );
      const cat = await Category.findOne({
        _id: input.categoryId,
        userId: null,
        type: "expense",
        deletedAt: null,
      }).session(s);
      if (!cat) throw missing();
      if (input.paidFrom === "fund") {
        const balance = addMoney(w.balance, -input.amount);
        if (balance < 0)
          throw new AppError(
            422,
            "INSUFFICIENT_BALANCE",
            "Quỹ không đủ tiền cho khoản chi này.",
          );
        w.balance = balance;
        await w.save({ session: s });
      }
      const { splits: _splits, ...fields } = input;
      void _splits;
      const [t] = await SharedTransaction.create(
        [
          {
            ...fields,
            date: parseFinancialDate(input.date, c.user.timezone),
            coupleId: c.id,
            createdBy: userId,
            payerName: c.people.find((p) => p.id === input.payerId)!.name,
            categoryName: cat.name,
          },
        ],
        { session: s },
      );
      await SharedSplit.create(
        splits.map((p) => ({
          coupleId: c.id,
          sharedTransactionId: t._id,
          userId: p.id,
          name: p.name,
          shareAmount: p.shareAmount,
        })),
        { session: s, ordered: true },
      );
      const owed = splits.find((p) => p.id !== input.payerId)!;
      if (input.paidFrom === "personal" && owed.shareAmount > 0)
        await Settlement.create(
          [
            {
              coupleId: c.id,
              sourceTransactionId: t._id,
              fromUserId: owed.id,
              toUserId: input.payerId,
              fromName: owed.name,
              toName: c.people.find((p) => p.id === input.payerId)!.name,
              amount: owed.shareAmount,
            },
          ],
          { session: s },
        );
      await event(c, "đã ghi một khoản chi chung.", s);
      return transactionDto(t, s);
    });
  },
  async transactions(userId: string, raw: unknown) {
    const q = schema.listQuery.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, false, q.coupleId);
      const bounds = dateBounds(q.from, q.to, c.user.timezone);
      const filter = {
        coupleId: c.id,
        deletedAt: null,
        ...(q.sharedWalletId ? { sharedWalletId: q.sharedWalletId } : {}),
        ...(bounds.lower || bounds.upper
          ? {
              date: {
                ...(bounds.lower ? { $gte: bounds.lower } : {}),
                ...(bounds.upper ? { $lt: bounds.upper } : {}),
              },
            }
          : {}),
      };
      const total = await SharedTransaction.countDocuments(filter).session(s);
      const rows = await SharedTransaction.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .session(s);
      const items = [];
      for (const t of rows) items.push(await transactionDto(t, s));
      return {
        items,
        total,
        page: q.page,
        limit: q.limit,
        readOnly: c.readOnly,
      };
    });
  },
  async transaction(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      q = schema.contextQuery.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, false, q.coupleId);
      const t = await SharedTransaction.findOne({
        _id: id,
        coupleId: c.id,
        deletedAt: null,
      }).session(s);
      if (!t) throw missing();
      return { ...(await transactionDto(t, s)), readOnly: c.readOnly };
    });
  },
  async deleteTransaction(userId: string, rawId: unknown) {
    const id = objectId.parse(rawId);
    await inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const t = await SharedTransaction.findOne({
        _id: id,
        coupleId: c.id,
        deletedAt: null,
      }).session(s);
      if (!t) throw missing();
      if (t.createdBy.toString() !== userId && c.member.role !== "owner")
        throw new AppError(
          403,
          "CREATOR_REQUIRED",
          "Chỉ người tạo hoặc chủ không gian được xóa khoản chi.",
        );
      if (
        await Settlement.exists({
          sourceTransactionId: id,
          deletedAt: null,
          status: { $in: ["paid", "pending_confirm"] },
        }).session(s)
      )
        throw conflict(
          "SETTLEMENT_LOCKED",
          "Khoản chi đã thanh toán hoặc đang chờ xác nhận, không thể xóa.",
        );
      if (t.paidFrom === "fund") {
        const w = await wallet(c, t.sharedWalletId.toString(), s, true);
        w.balance = addMoney(w.balance, t.amount);
        await w.save({ session: s });
      }
      t.deletedAt = new Date();
      await t.save({ session: s });
      await SharedSplit.updateMany(
        { sharedTransactionId: id },
        { $set: { deletedAt: t.deletedAt } },
        { session: s },
      );
      await Settlement.updateMany(
        { sourceTransactionId: id },
        { $set: { deletedAt: t.deletedAt } },
        { session: s },
      );
      await event(c, "đã xóa một khoản chi chung chưa thanh toán.", s);
    });
  },
  async settlements(userId: string, raw: unknown) {
    const q = schema.listQuery.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, false, q.coupleId),
        bounds = dateBounds(q.from, q.to, c.user.timezone);
      const filter = {
        coupleId: c.id,
        deletedAt: null,
        ...(q.status ? { status: q.status } : {}),
        ...(bounds.lower || bounds.upper
          ? {
              createdAt: {
                ...(bounds.lower ? { $gte: bounds.lower } : {}),
                ...(bounds.upper ? { $lt: bounds.upper } : {}),
              },
            }
          : {}),
      };
      const total = await Settlement.countDocuments(filter).session(s);
      const rows = await Settlement.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .session(s);
      return {
        items: rows.map(settlementDto),
        total,
        page: q.page,
        limit: q.limit,
        readOnly: c.readOnly,
      };
    });
  },
  async summary(userId: string, raw: unknown) {
    const q = schema.contextQuery.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, false, q.coupleId);
      return { ...(await summary(c, s)), readOnly: c.readOnly };
    });
  },
  async settlementAction(
    userId: string,
    rawId: unknown,
    mode: "mark-paid" | "confirm" | "reject",
    raw: unknown,
  ) {
    const id = objectId.parse(rawId),
      input = schema.action.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const row = await Settlement.findOne({
        _id: id,
        coupleId: c.id,
        deletedAt: null,
      }).session(s);
      if (!row) throw missing();
      const allowed = mode === "mark-paid" ? row.fromUserId : row.toUserId;
      if (allowed.toString() !== userId)
        throw new AppError(
          403,
          "SETTLEMENT_ROLE",
          "Chỉ người nợ báo đã trả; chỉ người nhận xác nhận hoặc từ chối.",
        );
      if (
        mode === "mark-paid"
          ? row.status !== "pending"
          : row.status !== "pending_confirm"
      )
        throw conflict(
          "INVALID_SETTLEMENT_STATE",
          "Trạng thái công nợ đã thay đổi. Hãy tải lại danh sách.",
        );
      row.status =
        mode === "mark-paid"
          ? "pending_confirm"
          : mode === "confirm"
            ? "paid"
            : "pending";
      row.notes = input.notes;
      if (mode === "mark-paid") row.markedAt = new Date();
      if (mode === "confirm") row.paidAt = new Date();
      if (mode === "reject") row.markedAt = null;
      await row.save({ session: s });
      await event(
        c,
        mode === "mark-paid"
          ? "đã báo hoàn tiền ngoài ứng dụng."
          : mode === "confirm"
            ? "đã xác nhận nhận tiền."
            : "đã từ chối xác nhận nhận tiền.",
        s,
      );
      return settlementDto(row);
    });
  },
  async goals(userId: string, raw: unknown) {
    const q = schema.contextQuery.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, false, q.coupleId);
      return {
        items: (
          await SharedGoal.find({ coupleId: c.id, deletedAt: null })
            .sort({ _id: -1 })
            .session(s)
        ).map(goalDto),
        readOnly: c.readOnly,
      };
    });
  },
  async createGoal(userId: string, raw: unknown) {
    const input = schema.goalCreate.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const [g] = await SharedGoal.create([{ ...input, coupleId: c.id }], {
        session: s,
      });
      await event(c, "đã tạo mục tiêu tiết kiệm chung.", s);
      return goalDto(g);
    });
  },
  async updateGoal(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = schema.goalUpdate.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const g = await SharedGoal.findOne({
        _id: id,
        coupleId: c.id,
        deletedAt: null,
      }).session(s);
      if (!g) throw missing();
      Object.assign(g, input);
      await g.save({ session: s });
      return goalDto(g);
    });
  },
  async deleteGoal(userId: string, rawId: unknown) {
    const id = objectId.parse(rawId);
    await inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const g = await SharedGoal.findOne({
        _id: id,
        coupleId: c.id,
        deletedAt: null,
      }).session(s);
      if (!g) throw missing();
      g.deletedAt = new Date();
      await g.save({ session: s });
    });
  },
  async contributeGoal(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      input = schema.contribution.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const g = await SharedGoal.findOne({
        _id: id,
        coupleId: c.id,
        deletedAt: null,
      }).session(s);
      if (!g) throw missing();
      g.savedAmount = addMoney(g.savedAmount, input.amount);
      await g.save({ session: s });
      await SharedGoalContribution.create(
        [
          {
            ...input,
            date: parseFinancialDate(input.date, c.user.timezone),
            coupleId: c.id,
            goalId: id,
            userId,
            actorName: c.user.name,
          },
        ],
        { session: s },
      );
      await event(c, "đã ghi nhận dành dụm cho mục tiêu chung.", s);
      return goalDto(g);
    });
  },
  async goalContributions(userId: string, rawId: unknown, raw: unknown) {
    const id = objectId.parse(rawId),
      q = schema.listQuery.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, false, q.coupleId);
      if (
        !(await SharedGoal.exists({
          _id: id,
          coupleId: c.id,
          deletedAt: null,
        }).session(s))
      )
        throw missing();
      const rows = await SharedGoalContribution.find({
        goalId: id,
        coupleId: c.id,
        deletedAt: null,
        ...dateFilter(q, c.user.timezone),
      })
        .sort({ _id: -1 })
        .session(s);
      return {
        ...page(
          rows.map((r) => ({
            id: r.id,
            userId: r.userId.toString(),
            actorName: r.actorName,
            amount: r.amount,
            date: r.date,
            notes: r.notes,
          })),
          q.page,
          q.limit,
        ),
        readOnly: c.readOnly,
      };
    });
  },
  async undoGoal(userId: string, rawId: unknown, rawContribution: unknown) {
    const id = objectId.parse(rawId),
      contributionId = objectId.parse(rawContribution);
    await inTransaction(async (s) => {
      const c = await context(userId, s, true);
      const g = await SharedGoal.findOne({
          _id: id,
          coupleId: c.id,
          deletedAt: null,
        }).session(s),
        r = await SharedGoalContribution.findOne({
          _id: contributionId,
          goalId: id,
          coupleId: c.id,
          deletedAt: null,
        }).session(s);
      if (!g || !r) throw missing();
      if (r.userId.toString() !== userId && c.member.role !== "owner")
        throw new AppError(
          403,
          "CREATOR_REQUIRED",
          "Chỉ người góp hoặc chủ không gian được hoàn tác.",
        );
      g.savedAmount = addMoney(g.savedAmount, -r.amount);
      r.deletedAt = new Date();
      await g.save({ session: s });
      await r.save({ session: s });
    });
  },
  async dashboard(userId: string, raw: unknown) {
    const q = schema.contextQuery.parse(raw);
    return inTransaction(async (s) => {
      const c = await context(userId, s, false, q.coupleId),
        bounds = monthBounds(
          c.readOnly ? c.couple.archivedAt! : new Date(),
          c.user.timezone,
        );
      const funds = await SharedWallet.find({
        coupleId: c.id,
        deletedAt: null,
      }).session(s);
      const rows = await SharedTransaction.find({
        coupleId: c.id,
        deletedAt: null,
        date: { $gte: bounds.start, $lt: bounds.end },
      }).session(s);
      const categories = new Map<string, { name: string; amount: number }>();
      for (const t of rows) {
        const id = t.categoryId.toString(),
          old = categories.get(id);
        categories.set(id, {
          name: t.categoryName,
          amount: addMoney(old?.amount ?? 0, t.amount),
        });
      }
      const recent = [];
      for (const t of await SharedTransaction.find({
        coupleId: c.id,
        deletedAt: null,
      })
        .sort({ date: -1, _id: -1 })
        .limit(5)
        .session(s))
        recent.push(await transactionDto(t, s));
      return {
        month: bounds.month,
        readOnly: c.readOnly,
        totalBalance: sumMoney(funds.map((w) => w.balance)),
        monthExpense: sumMoney(rows.map((t) => t.amount)),
        categories: [...categories].map(([categoryId, v]) => ({
          categoryId,
          ...v,
        })),
        summary: await summary(c, s),
        recent,
        goals: (
          await SharedGoal.find({ coupleId: c.id, deletedAt: null }).session(s)
        ).map(goalDto),
      };
    });
  },
};
