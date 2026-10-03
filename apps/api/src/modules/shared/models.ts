import { Schema, model } from "mongoose";
const base = {
  coupleId: { type: Schema.Types.ObjectId, required: true, index: true },
  deletedAt: { type: Date, default: null },
};
const options = { timestamps: true } as const;
const wallet = new Schema(
  {
    ...base,
    name: { type: String, required: true },
    balance: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  options,
);
export const SharedWallet = model("SharedWallet", wallet, "shared_wallets");
const contribution = new Schema(
  {
    ...base,
    sharedWalletId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, required: true },
    actorName: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    notes: { type: String, default: "" },
  },
  options,
);
export const SharedContribution = model(
  "SharedContribution",
  contribution,
  "shared_contributions",
);
const transaction = new Schema(
  {
    ...base,
    sharedWalletId: { type: Schema.Types.ObjectId, required: true },
    payerId: { type: Schema.Types.ObjectId, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    payerName: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    description: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    categoryName: { type: String, required: true },
    splitType: {
      type: String,
      enum: ["equal", "custom", "percent"],
      required: true,
    },
    paidFrom: { type: String, enum: ["fund", "personal"], required: true },
  },
  options,
);
transaction.index({ coupleId: 1, date: -1 });
export const SharedTransaction = model(
  "SharedTransaction",
  transaction,
  "shared_transactions",
);
const split = new Schema(
  {
    ...base,
    sharedTransactionId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    shareAmount: { type: Number, required: true },
  },
  options,
);
split.index({ sharedTransactionId: 1, userId: 1 }, { unique: true });
export const SharedSplit = model(
  "SharedSplit",
  split,
  "shared_transaction_splits",
);
const settlement = new Schema(
  {
    ...base,
    fromUserId: { type: Schema.Types.ObjectId, required: true },
    toUserId: { type: Schema.Types.ObjectId, required: true },
    fromName: { type: String, required: true },
    toName: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "pending_confirm", "paid"],
      default: "pending",
    },
    sourceTransactionId: { type: Schema.Types.ObjectId, required: true },
    notes: { type: String, default: "" },
    markedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  options,
);
settlement.index({ sourceTransactionId: 1 }, { unique: true });
settlement.index({ coupleId: 1, status: 1, createdAt: -1 });
export const Settlement = model("Settlement", settlement, "settlements");
const goal = new Schema(
  {
    ...base,
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    savedAmount: { type: Number, default: 0 },
    deadline: { type: String, default: null },
    notes: { type: String, default: "" },
  },
  options,
);
export const SharedGoal = model("SharedGoal", goal, "shared_goals");
const goalContribution = new Schema(
  {
    ...base,
    goalId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    actorName: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    notes: { type: String, default: "" },
  },
  options,
);
export const SharedGoalContribution = model(
  "SharedGoalContribution",
  goalContribution,
  "shared_goal_contributions",
);
export const sharedModels = [
  SharedWallet,
  SharedContribution,
  SharedTransaction,
  SharedSplit,
  Settlement,
  SharedGoal,
  SharedGoalContribution,
];
