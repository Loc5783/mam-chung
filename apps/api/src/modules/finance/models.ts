import { Schema, model } from "mongoose";
const walletSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["cash", "bank", "ewallet"], required: true },
    currency: { type: String, default: "VND" },
    balance: { type: Number, default: 0 },
    allowNegative: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    color: { type: String, default: "#7E9B57" },
    icon: { type: String, default: "Wallet" },
    revision: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
walletSchema.index({ userId: 1, deletedAt: 1, archived: 1 });
export const Wallet = model("Wallet", walletSchema);
export type WalletRecord = InstanceType<typeof Wallet>;
const categorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    nameKey: { type: String, required: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    icon: { type: String, default: "Ellipsis" },
    systemKey: { type: String, default: undefined },
    revision: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
categorySchema.index(
  { userId: 1, type: 1, nameKey: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
categorySchema.index(
  { systemKey: 1 },
  { unique: true, partialFilterExpression: { systemKey: { $type: "string" } } },
);
export const Category = model("Category", categorySchema);
export type CategoryRecord = InstanceType<typeof Category>;
const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    walletId: { type: Schema.Types.ObjectId, required: true },
    categoryId: { type: Schema.Types.ObjectId, default: null },
    type: { type: String, enum: ["income", "expense"], required: true },
    kind: {
      type: String,
      enum: ["transaction", "transfer", "opening"],
      default: "transaction",
    },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    description: { type: String, required: true },
    notes: { type: String, default: "" },
    tags: { type: [String], default: [] },
    transferId: { type: String, default: null },
    counterWalletId: { type: Schema.Types.ObjectId, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ walletId: 1, deletedAt: 1 });
transactionSchema.index({ userId: 1, categoryId: 1 });
transactionSchema.index({ userId: 1, transferId: 1 });
export const FinancialTransaction = model(
  "FinancialTransaction",
  transactionSchema,
  "transactions",
);
export type TransactionRecord = InstanceType<typeof FinancialTransaction>;
