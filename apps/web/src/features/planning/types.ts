export type Budget = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  month: string;
  amount: number;
  spent: number;
  remaining: number;
  progress: number;
  status: "healthy" | "warning" | "exceeded";
};
export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  notes: string;
  color: string;
  progress: number;
  createdAt: string;
};
export type Contribution = {
  id: string;
  amount: number;
  date: string;
  notes: string;
};
export type Recurring = {
  id: string;
  type: "income" | "expense";
  amount: number;
  walletId: string;
  categoryId: string;
  description: string;
  notes: string;
  tags: string[];
  frequency: "weekly" | "monthly";
  nextDate: string;
  endDate: string | null;
  enabled: boolean;
  lastError: string | null;
  lastRunAt: string | null;
};
export type Report = {
  timezone: string;
  endMonth: string;
  months: { month: string; income: number; expense: number; net: number }[];
  categories: {
    categoryId: string;
    name: string;
    amount: number;
    months: number[];
  }[];
  totalIncome: number;
  totalExpense: number;
  comparison: { incomeChange: number | null; expenseChange: number | null };
};
