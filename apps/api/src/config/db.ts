import { coupleModels } from "../modules/couples/models";
import { planningModels } from "../modules/planning/models";
import mongoose from "mongoose";
import { env } from "./env";
import { User } from "../modules/users/model";
import { RefreshToken } from "../modules/auth/model";
import {
  Wallet,
  Category,
  FinancialTransaction,
} from "../modules/finance/models";
import { seedCategories } from "../seeds/categories";
export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([
    ...coupleModels.map((model) => model.init()),
    ...planningModels.map((model) => model.init()),
    User.init(),
    RefreshToken.init(),
    Wallet.init(),
    Category.init(),
    FinancialTransaction.init(),
  ]);
  await seedCategories();
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName) {
    await mongoose.disconnect();
    throw new Error("MongoDB phải chạy replica set để bảo đảm transaction.");
  }
}
