import { Category } from "../modules/finance/models";
const seed = [
  ["expense", "Ăn uống", "Utensils", "food"],
  ["expense", "Di chuyển", "Car", "transport"],
  ["expense", "Mua sắm", "ShoppingBag", "shopping"],
  ["expense", "Hóa đơn", "Receipt", "bills"],
  ["expense", "Giải trí", "Gamepad2", "entertainment"],
  ["expense", "Sức khỏe", "HeartPulse", "health"],
  ["expense", "Giáo dục", "GraduationCap", "education"],
  ["expense", "Nhà ở", "House", "housing"],
  ["expense", "Khác", "Ellipsis", "other-expense"],
  ["income", "Lương", "Briefcase", "salary"],
  ["income", "Thưởng", "Gift", "bonus"],
  ["income", "Khác", "Ellipsis", "other-income"],
] as const;
export async function seedCategories() {
  await Category.bulkWrite(
    seed.map(([type, name, icon, systemKey]) => ({
      updateOne: {
        filter: { systemKey },
        update: {
          $setOnInsert: {
            userId: null,
            type,
            name,
            nameKey: name.normalize("NFKC").toLowerCase(),
            icon,
            systemKey,
            deletedAt: null,
            revision: 0,
          },
        },
        upsert: true,
      },
    })),
  );
}
