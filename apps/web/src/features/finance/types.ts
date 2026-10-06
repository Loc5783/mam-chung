export type Wallet = {
  id: string;
  name: string;
  type: "cash" | "bank" | "ewallet";
  currency: "VND";
  balance: number;
  allowNegative: boolean;
  archived: boolean;
  color: string;
  icon: string;
  createdAt: string;
};
export type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  isSystem: boolean;
};
export type Entry = {
  id: string;
  type: "income" | "expense";
  kind: "transaction" | "transfer" | "opening";
  amount: number;
  walletId: string;
  walletName: string;
  walletColor: string;
  walletArchived: boolean;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string;
  date: string;
  description: string;
  notes: string;
  tags: string[];
  transferId: string | null;
  counterWalletId: string | null;
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
export type History = Page<Entry> & {
  summary: { income: number; expense: number; net: number };
};
export type FinanceDashboard = {
  month: string;
  timezone: string;
  totalBalance: number;
  income: number;
  expense: number;
  incomeChange: number | null;
  expenseChange: number | null;
  wallets: Wallet[];
  spending: { categoryId: string; name: string; amount: number }[];
  incomeByCategory: { categoryId: string; name: string; amount: number }[];
  recent: Entry[];
};
export type Reconcile = {
  walletId: string;
  actualBalance: number;
  expectedBalance: number;
  difference: number;
  matched: boolean;
  repaired: boolean;
};
export type Dialog =
  | { kind: "wallet"; wallet?: Wallet }
  | { kind: "entry"; entry?: Entry }
  | { kind: "transfer" }
  | { kind: "category"; category?: Category }
  | { kind: "delete-wallet"; wallet: Wallet }
  | { kind: "delete-category"; category: Category }
  | { kind: "delete-entry"; entry: Entry }
  | { kind: "reconcile"; wallet: Wallet };
