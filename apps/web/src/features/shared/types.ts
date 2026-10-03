export type SharedWallet = {
  id: string;
  name: string;
  balance: number;
  archived: boolean;
  createdAt: string;
};
export type Member = { id: string; name: string; active: boolean };
export type SharedSplit = { userId: string; name: string; shareAmount: number };
export type SharedTransaction = {
  id: string;
  sharedWalletId: string;
  walletName: string;
  payerId: string;
  payerName: string;
  createdBy: string;
  amount: number;
  date: string;
  description: string;
  categoryId: string;
  categoryName: string;
  splitType: "equal" | "custom" | "percent";
  paidFrom: "fund" | "personal";
  splits: SharedSplit[];
};
export type Settlement = {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromName: string;
  toName: string;
  amount: number;
  status: "pending" | "pending_confirm" | "paid";
  sourceTransactionId: string;
  notes: string;
  createdAt: string;
  markedAt: string | null;
  paidAt: string | null;
};
export type SharedGoal = {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  notes: string;
  progress: number;
};
export type DebtSummary = {
  amount: number;
  fromUserId: string | null;
  toUserId: string | null;
  fromName: string | null;
  toName: string | null;
  outstandingCount: number;
  pendingConfirmation: number;
};
export type SharedDashboard = {
  month: string;
  readOnly: boolean;
  totalBalance: number;
  monthExpense: number;
  categories: { categoryId: string; name: string; amount: number }[];
  summary: DebtSummary;
  recent: SharedTransaction[];
  goals: SharedGoal[];
};
export type SharedFunds = {
  items: SharedWallet[];
  readOnly: boolean;
  coupleId: string;
  members: Member[];
  role: string;
};
export type SharedPage<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  readOnly: boolean;
};
export type Contribution = {
  id: string;
  userId: string;
  actorName: string;
  amount: number;
  date: string;
  notes: string;
};
