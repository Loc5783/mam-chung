import { ClientSession, FilterQuery } from "mongoose";
import {
  Wallet,
  Category,
  FinancialTransaction,
  TransactionRecord,
} from "./models";
export const financeRepository = {
  wallets: (userId: string, session?: ClientSession) =>
    Wallet.find({ userId, deletedAt: null })
      .sort({ createdAt: 1, _id: 1 })
      .session(session ?? null),
  wallet: (userId: string, id: string, session: ClientSession) =>
    Wallet.findOne({ _id: id, userId, deletedAt: null }).session(session),
  categories: (userId: string, session?: ClientSession) =>
    Category.find({ deletedAt: null, $or: [{ userId: null }, { userId }] })
      .sort({ type: 1, createdAt: 1, _id: 1 })
      .session(session ?? null),
  category: (userId: string, id: string, session: ClientSession) =>
    Category.findOne({
      _id: id,
      deletedAt: null,
      $or: [{ userId: null }, { userId }],
    }).session(session),
  transaction: (userId: string, id: string, session: ClientSession) =>
    FinancialTransaction.findOne({ _id: id, userId, deletedAt: null }).session(
      session,
    ),
  walletHistory: (userId: string, walletId: string, session: ClientSession) =>
    FinancialTransaction.exists({ userId, walletId }).session(session),
  categoryHistory: (
    userId: string,
    categoryId: string,
    session: ClientSession,
  ) => FinancialTransaction.exists({ userId, categoryId }).session(session),
  entries: (filter: FilterQuery<TransactionRecord>, session?: ClientSession) =>
    FinancialTransaction.find(filter).session(session ?? null),
  createWallet: (
    data: ConstructorParameters<typeof Wallet>[0],
    session: ClientSession,
  ) => Wallet.create([data], { session }),
  createCategory: (
    data: ConstructorParameters<typeof Category>[0],
    session: ClientSession,
  ) => Category.create([data], { session }),
  createEntries: (
    data: ConstructorParameters<typeof FinancialTransaction>[0][],
    session: ClientSession,
  ) => FinancialTransaction.create(data, { session, ordered: true }),
  saveWallet: (wallet: InstanceType<typeof Wallet>, session: ClientSession) =>
    wallet.save({ session }),
  saveCategory: (
    category: InstanceType<typeof Category>,
    session: ClientSession,
  ) => category.save({ session }),
  saveEntry: (entry: TransactionRecord, session: ClientSession) =>
    entry.save({ session }),
  replaceCategory: (
    userId: string,
    categoryId: string,
    replacementId: string,
    session: ClientSession,
  ) =>
    FinancialTransaction.updateMany(
      { userId, categoryId },
      { $set: { categoryId: replacementId } },
      { session },
    ),
  softDeleteEntries: (userId: string, ids: string[], session: ClientSession) =>
    FinancialTransaction.updateMany(
      { userId, _id: { $in: ids }, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { session },
    ),
};
