import { FinanceDashboard } from "../finance/types";
import { Budget } from "../planning/types";
import { TaskPage } from "../tasks/types";
import { Report } from "../fitness/types";
import { CoupleData, Activity } from "../couples/types";
import { SharedDashboard } from "../shared/types";
export type HomeData = {
  generatedAt: string;
  finance: FinanceDashboard;
  budgets: { month: string; items: Budget[] };
  tasks: { today: TaskPage; overdue: TaskPage };
  fitness: Report;
  couple: CoupleData | null;
  shared: SharedDashboard | null;
  activity: {
    items: Activity[];
    total: number;
    page: number;
    limit: number;
  } | null;
};
