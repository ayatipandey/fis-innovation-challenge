import type { CategoryId } from '@shared/types';
import {
  BedDouble,
  Car,
  Clapperboard,
  Coffee,
  Flower2,
  Headphones,
  HeartPulse,
  Plane,
  Shapes,
  Shirt,
  ShoppingBasket,
  UtensilsCrossed,
  Watch,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICON: Record<CategoryId, LucideIcon> = {
  food: UtensilsCrossed,
  coffee: Coffee,
  groceries: ShoppingBasket,
  travel: Plane,
  hotels: BedDouble,
  fashion: Shirt,
  watches: Watch,
  beauty: Flower2,
  tech: Headphones,
  entertainment: Clapperboard,
  transport: Car,
  wellness: HeartPulse,
  other: Shapes,
};
