import {
  Wallet,
  Landmark,
  Smartphone,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Gamepad2,
  HeartPulse,
  GraduationCap,
  Briefcase,
  Gift,
  Ellipsis,
  PiggyBank,
  House,
  Coffee,
} from "lucide-react";
const icons: Record<string, typeof Wallet> = {
  Wallet,
  Landmark,
  Smartphone,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Gamepad2,
  HeartPulse,
  GraduationCap,
  Briefcase,
  Gift,
  Ellipsis,
  PiggyBank,
  House,
  Coffee,
};
export function FinanceIcon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name] ?? Wallet;
  return <Icon size={size} aria-hidden="true" />;
}
