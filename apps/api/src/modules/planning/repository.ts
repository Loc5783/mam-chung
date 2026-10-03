import { ClientSession, FilterQuery } from "mongoose";
import {
  Budget,
  Goal,
  GoalContribution,
  Recurring,
  RecurringRun,
} from "./models";
import { FinancialTransaction, TransactionRecord } from "../finance/models";
export const planningRepository = {
  budgets: (userId: string, month: string, session: ClientSession) =>
    Budget.find({ userId, month, deletedAt: null })
      .sort({ createdAt: 1, _id: 1 })
      .session(session),
  budget: (userId: string, id: string, session: ClientSession) =>
    Budget.findOne({ _id: id, userId, deletedAt: null }).session(session),
  goals: (userId: string, session: ClientSession) =>
    Goal.find({ userId, deletedAt: null })
      .sort({ createdAt: -1, _id: -1 })
      .session(session),
  goal: (userId: string, id: string, session: ClientSession) =>
    Goal.findOne({ _id: id, userId, deletedAt: null }).session(session),
  recurring: (userId: string, session: ClientSession) =>
    Recurring.find({ userId, deletedAt: null })
      .sort({ nextDate: 1, _id: 1 })
      .session(session),
  template: (userId: string, id: string, session: ClientSession) =>
    Recurring.findOne({ _id: id, userId, deletedAt: null }).session(session),
  run: (id: string, date: string, session: ClientSession) =>
    RecurringRun.findOne({ recurringId: id, scheduledDate: date }).session(
      session,
    ),
  transactions: (
    filter: FilterQuery<TransactionRecord>,
    session: ClientSession,
  ) =>
    FinancialTransaction.find(filter)
      .sort({ date: 1, _id: 1 })
      .session(session),
  contributions: (userId: string, goalId: string, session: ClientSession) =>
    GoalContribution.find({ userId, goalId, deletedAt: null })
      .sort({ date: -1, _id: -1 })
      .session(session),
};
