import {
  Building,
  CircleEllipsis,
  Fuel,
  Hammer,
  HardHat,
  Landmark,
  Laptop,
  Megaphone,
  Package,
  Paperclip,
  Plane,
  Shield,
  Smartphone,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';

import type { ExpenseCategory } from '@/domain/expenses';

export const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  MATERIALS: Package,
  TOOLS: Hammer,
  SUBCONTRACTORS: HardHat,
  FUEL: Fuel,
  TRAVEL: Plane,
  MEALS: UtensilsCrossed,
  OFFICE: Paperclip,
  SOFTWARE: Laptop,
  PHONE: Smartphone,
  MARKETING: Megaphone,
  INSURANCE: Shield,
  RENT: Building,
  FEES: Landmark,
  OTHER: CircleEllipsis,
};
