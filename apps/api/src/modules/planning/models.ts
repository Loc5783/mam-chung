import { Schema, model } from "mongoose";
const base = {
  userId: { type: Schema.Types.ObjectId, required: true },
  deletedAt: { type: Date, default: null },
};
const budget = new Schema(
  {
    ...base,
    categoryId: { type: Schema.Types.ObjectId, required: true },
    month: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { timestamps: true },
);
budget.index(
  { userId: 1, categoryId: 1, month: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
export const Budget = model("Budget", budget);
const goal = new Schema(
  {
    ...base,
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    savedAmount: { type: Number, default: 0 },
    deadline: { type: String, default: null },
    notes: { type: String, default: "" },
    color: { type: String, default: "#7E9B57" },
  },
  { timestamps: true },
);
goal.index({ userId: 1, deletedAt: 1 });
export const Goal = model("Goal", goal);
const contribution = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    goalId: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    notes: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
contribution.index({ userId: 1, goalId: 1, date: -1 });
export const GoalContribution = model("GoalContribution", contribution);
const recurring = new Schema(
  {
    ...base,
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: { type: Number, required: true },
    walletId: { type: Schema.Types.ObjectId, required: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    description: { type: String, required: true },
    notes: { type: String, default: "" },
    tags: { type: [String], default: [] },
    frequency: { type: String, enum: ["weekly", "monthly"], required: true },
    nextDate: { type: String, required: true },
    anchorDay: { type: Number, required: true },
    endDate: { type: String, default: null },
    enabled: { type: Boolean, default: true },
    lastError: { type: String, default: null },
    lastAttemptDate: { type: String, default: null },
    lastRunAt: { type: Date, default: null },
  },
  { timestamps: true },
);
recurring.index({ enabled: 1, deletedAt: 1, nextDate: 1 });
recurring.index({ userId: 1, deletedAt: 1 });
export const Recurring = model("Recurring", recurring);
const run = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    recurringId: { type: Schema.Types.ObjectId, required: true },
    scheduledDate: { type: String, required: true },
    transactionId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);
run.index({ recurringId: 1, scheduledDate: 1 }, { unique: true });
export const RecurringRun = model("RecurringRun", run);
export const planningModels = [
  Budget,
  Goal,
  GoalContribution,
  Recurring,
  RecurringRun,
];
