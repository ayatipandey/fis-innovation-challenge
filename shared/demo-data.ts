// Synthetic demo data. Every program, merchant, balance and purchase below is
// fictional and exists only to demonstrate the product. In production these
// would come from the member's own programs through bank or loyalty APIs.

import type { Category, CategoryId, Merchant, Program, Purchase, RewardOption } from './types.js';

export const DEMO_NOTICE = 'Sample programs and merchants. Balances and purchases are synthetic.';

export const CATEGORIES: Category[] = [
  { id: 'coffee', label: 'Coffee', subcategories: ['Coffee shops', 'Tea', 'Smoothies'] },
  { id: 'food', label: 'Food and restaurants', subcategories: ['Lunch spots', 'Dinner', 'Takeout'] },
  { id: 'groceries', label: 'Groceries', subcategories: ['Supermarket', 'Snacks', 'Produce'] },
  { id: 'books', label: 'Books and supplies', subcategories: ['Textbooks', 'Fiction', 'Stationery'] },
  { id: 'entertainment', label: 'Entertainment', subcategories: ['Cinema', 'Live events', 'Games'] },
  { id: 'shopping', label: 'Shopping', subcategories: ['Clothing', 'Tech', 'Gifts'] },
  { id: 'transport', label: 'Transport', subcategories: ['Rideshare', 'Transit', 'Fuel'] },
  { id: 'wellness', label: 'Health and fitness', subcategories: ['Gym', 'Pharmacy', 'Yoga'] },
];

export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const PROGRAMS: Program[] = [
  {
    id: 'campus-coffee',
    name: 'Campus Coffee Rewards',
    issuer: 'Campus Coffee',
    kind: 'stamp_card',
    unit: 'points',
    category: 'coffee',
    monogram: 'CC',
    earnRule: '1 point per $1 spent at Campus Coffee.',
    expiryRule: 'Points expire 90 days after they are earned.',
  },
  {
    id: 'northline-card',
    name: 'Northline Rewards Card',
    issuer: 'Northline Bank',
    kind: 'bank_card',
    unit: 'points',
    category: null,
    monogram: 'NB',
    earnRule: '2 points per $1 on dining and coffee, 1 point per $1 on everything else.',
    expiryRule: 'Points expire 12 months after they are earned.',
  },
  {
    id: 'pageturn-books',
    name: 'Pageturn Books Membership',
    issuer: 'Pageturn Books',
    kind: 'store_membership',
    unit: 'points',
    category: 'books',
    monogram: 'PB',
    earnRule: '10 points per $1 spent at Pageturn Books.',
    expiryRule: 'Points expire at the end of each semester.',
  },
  {
    id: 'freshcart',
    name: 'FreshCart Points',
    issuer: 'FreshCart Market',
    kind: 'store_membership',
    unit: 'points',
    category: 'groceries',
    monogram: 'FC',
    earnRule: '10 points per $1 spent at FreshCart.',
    expiryRule: 'Points expire 6 months after they are earned.',
  },
  {
    id: 'reel-stars',
    name: 'Reel Cinemas Stars',
    issuer: 'Reel Cinemas',
    kind: 'stamp_card',
    unit: 'stars',
    category: 'entertainment',
    monogram: 'RC',
    earnRule: '1 star per ticket.',
    expiryRule: 'Stars expire 60 days after they are earned.',
  },
];

export const programById = (id: string) => PROGRAMS.find((p) => p.id === id);

/** A fictional campus neighbourhood. Coordinates are only used for distance. */
/** The demo campus: the University of North Florida area, Jacksonville. The shops around it are fictional. */
export const CAMPUS = { lat: 30.2716, lng: -81.5076, label: 'Campus' };

export const MERCHANTS: Merchant[] = [
  { id: 'cc-union', name: 'Campus Coffee, Student Union', category: 'coffee', subcategory: 'Coffee shops', address: 'Student Union, ground floor', lat: 30.2722, lng: -81.5079, opens: 7, closes: 20, website: 'https://campus-coffee.example' },
  { id: 'cc-library', name: 'Campus Coffee, Library', category: 'coffee', subcategory: 'Coffee shops', address: 'Main Library, level 1', lat: 30.2697, lng: -81.5098, opens: 8, closes: 22, website: 'https://campus-coffee.example' },
  { id: 'olive-ash', name: 'Olive & Ash Kitchen', category: 'food', subcategory: 'Dinner', address: '12 College Row', lat: 30.278, lng: -81.5005, opens: 11, closes: 22, website: 'https://olive-ash.example' },
  { id: 'pageturn', name: 'Pageturn Books', category: 'books', subcategory: 'Textbooks', address: '4 Campus Walk', lat: 30.2745, lng: -81.504, opens: 9, closes: 20, website: 'https://pageturn-books.example' },
  { id: 'freshcart', name: 'FreshCart Market', category: 'groceries', subcategory: 'Supermarket', address: '220 Beach Parkway', lat: 30.2808, lng: -81.4987, opens: 7, closes: 23, website: 'https://freshcart.example' },
  { id: 'reel', name: 'Reel Cinemas', category: 'entertainment', subcategory: 'Cinema', address: '300 Beach Parkway', lat: 30.284, lng: -81.495, opens: 12, closes: 24, website: 'https://reel-cinemas.example' },
];

export const merchantById = (id: string | null) => (id ? MERCHANTS.find((m) => m.id === id) : undefined);

const both: RewardOption['channels'] = ['in_store', 'online'];

export const OPTIONS: RewardOption[] = [
  // Campus Coffee: the 70-point example. Small, frequent rewards vs one big one with a minimum.
  {
    id: 'cc-2off', programId: 'campus-coffee', merchantIds: ['cc-union', 'cc-library'], title: '$2 off any drink', cost: 10, value: 2,
    valueBasis: 'Fixed $2.00 discount.', minSpend: null, channels: both,
    valid: ['Any drink, any size', 'All Campus Coffee locations and the order-ahead site'],
    notValid: ['Bags of coffee beans and merchandise', 'Gift cards'], stacking: 'One reward per order.',
    howToUse: { online: 'Order ahead on Campus Coffee’s site with the points already applied.', inStore: 'Show your code at the counter before you pay.' },
    url: 'https://campus-coffee.example/order',
  },
  {
    id: 'cc-latte', programId: 'campus-coffee', merchantIds: ['cc-union', 'cc-library'], title: 'A free latte', cost: 25, value: 5,
    valueBasis: 'Menu price of a regular latte.', minSpend: null, channels: both,
    valid: ['Regular latte, any milk', 'All Campus Coffee locations'],
    notValid: ['Large size upgrades are charged', 'Gift cards'], stacking: 'One reward per order.',
    howToUse: { online: 'Order ahead with the points already applied.', inStore: 'Show your code at the counter.' },
    url: 'https://campus-coffee.example/order',
  },
  {
    id: 'cc-15off', programId: 'campus-coffee', merchantIds: ['cc-union', 'cc-library'], title: '$15 off an order of $20 or more', cost: 70, value: 15,
    valueBasis: 'Fixed $15.00 discount on orders of $20.00 or more.', minSpend: 20, channels: both,
    valid: ['Drinks, food and catering trays'],
    notValid: ['Gift cards', 'Merchandise'], stacking: 'One reward per order.',
    howToUse: { online: 'Order ahead with the points already applied.', inStore: 'Show your code at the counter.' },
    url: 'https://campus-coffee.example/order',
  },

  // Northline bank card points, spendable at participating merchants.
  {
    id: 'nl-latte', programId: 'northline-card', merchantIds: ['cc-union', 'cc-library'], title: 'A free latte at Campus Coffee', cost: 800, value: 5,
    valueBasis: 'Menu price of a regular latte.', minSpend: null, channels: ['in_store'],
    valid: ['Regular latte at any Campus Coffee'],
    notValid: ['Order-ahead orders'], stacking: 'Can’t be combined with Campus Coffee Rewards on the same order.',
    howToUse: { online: null, inStore: 'Show your code at the counter, then pay with your Northline card.' },
    url: null,
  },
  {
    id: 'nl-dinner', programId: 'northline-card', merchantIds: ['olive-ash'], title: '$24 off dinner at Olive & Ash', cost: 2400, value: 24,
    valueBasis: 'Fixed $24.00 discount on a dinner bill of $40.00 or more.', minSpend: 40, channels: ['in_store'],
    valid: ['Dinner menu, from 5 pm', 'Olive & Ash Kitchen'],
    notValid: ['Alcohol', 'Lunch menu'], stacking: 'One per table.',
    howToUse: { online: null, inStore: 'Show your code when you ask for the bill.' },
    url: null,
  },
  {
    id: 'nl-books', programId: 'northline-card', merchantIds: ['pageturn'], title: '$5 off at Pageturn Books', cost: 500, value: 5,
    valueBasis: 'Fixed $5.00 discount.', minSpend: null, channels: both,
    valid: ['Any purchase at Pageturn Books'],
    notValid: ['Gift cards'], stacking: 'Combines with Pageturn membership rewards.',
    howToUse: { online: 'Shop on Pageturn’s site with the points already applied.', inStore: 'Show your code at the register.' },
    url: 'https://pageturn-books.example/shop',
  },
  {
    id: 'nl-credit', programId: 'northline-card', merchantIds: [], title: '$10 statement credit', cost: 1000, value: 10,
    valueBasis: '1 cent per point, credited to your card.', minSpend: null, channels: ['online'],
    valid: ['Any Northline Rewards Card account'],
    notValid: [], stacking: 'Not applicable.',
    howToUse: { online: 'Northline applies the credit to your next statement.', inStore: null },
    url: 'https://northline-bank.example/rewards',
  },

  // Pageturn Books membership.
  {
    id: 'pt-5off', programId: 'pageturn-books', merchantIds: ['pageturn'], title: '$5 off any purchase', cost: 250, value: 5,
    valueBasis: 'Fixed $5.00 discount.', minSpend: null, channels: both,
    valid: ['Books, stationery and campus merchandise'],
    notValid: ['Gift cards', 'Textbook rentals'], stacking: 'One reward per order.',
    howToUse: { online: 'Shop on Pageturn’s site with the points already applied.', inStore: 'Show your code at the register.' },
    url: 'https://pageturn-books.example/shop',
  },
  {
    id: 'pt-15off', programId: 'pageturn-books', merchantIds: ['pageturn'], title: '$15 off textbooks over $50', cost: 600, value: 15,
    valueBasis: 'Fixed $15.00 discount on textbooks totalling $50.00 or more.', minSpend: 50, channels: both,
    valid: ['New and used textbooks'],
    notValid: ['Textbook rentals', 'Digital access codes'], stacking: 'One reward per order.',
    howToUse: { online: 'Shop on Pageturn’s site with the points already applied.', inStore: 'Show your code at the register.' },
    url: 'https://pageturn-books.example/textbooks',
  },

  // FreshCart grocery points.
  {
    id: 'fc-5off', programId: 'freshcart', merchantIds: ['freshcart'], title: '$5 off your shop', cost: 500, value: 5,
    valueBasis: 'Fixed $5.00 discount.', minSpend: null, channels: both,
    valid: ['Groceries and household items'],
    notValid: ['Alcohol and tobacco', 'Gift cards'], stacking: 'One reward per shop.',
    howToUse: { online: 'Shop on FreshCart’s site with the points already applied.', inStore: 'Scan your code at the register.' },
    url: 'https://freshcart.example/shop',
  },
  {
    id: 'fc-12off', programId: 'freshcart', merchantIds: ['freshcart'], title: '$12 off a shop of $40 or more', cost: 1000, value: 12,
    valueBasis: 'Fixed $12.00 discount on shops of $40.00 or more.', minSpend: 40, channels: both,
    valid: ['Groceries and household items'],
    notValid: ['Alcohol and tobacco', 'Gift cards', 'Delivery fees'], stacking: 'One reward per shop.',
    howToUse: { online: 'Shop on FreshCart’s site with the points already applied.', inStore: 'Scan your code at the register.' },
    url: 'https://freshcart.example/shop',
  },

  // Reel Cinemas stars.
  {
    id: 'rc-popcorn', programId: 'reel-stars', merchantIds: ['reel'], title: 'Free medium popcorn', cost: 5, value: 6.5,
    valueBasis: 'Menu price of a medium popcorn.', minSpend: null, channels: ['in_store'],
    valid: ['Medium popcorn, any flavor'],
    notValid: ['Combo meals'], stacking: 'One per visit.',
    howToUse: { online: null, inStore: 'Show your code at the concession stand.' },
    url: null,
  },
  {
    id: 'rc-ticket', programId: 'reel-stars', merchantIds: ['reel'], title: 'A free standard ticket', cost: 12, value: 13,
    valueBasis: 'Price of a standard evening ticket.', minSpend: null, channels: both,
    valid: ['Standard 2D screenings'],
    notValid: ['IMAX, 3D and special events'], stacking: 'One per booking.',
    howToUse: { online: 'Book on Reel’s site with the stars already applied.', inStore: 'Show your code at the box office.' },
    url: 'https://reel-cinemas.example/book',
  },
];

export const optionById = (id: string) => OPTIONS.find((o) => o.id === id);
export const optionsFor = (programId: string) => OPTIONS.filter((o) => o.programId === programId);

/** Starting balances and expiring batches granted when a sample program is linked. */
export const DEMO_BALANCES: Record<string, { balance: number; expiring: { points: number; inDays: number }[] }> = {
  'campus-coffee': { balance: 70, expiring: [{ points: 30, inDays: 6 }, { points: 40, inDays: 52 }] },
  'northline-card': { balance: 3150, expiring: [{ points: 1200, inDays: 21 }, { points: 1950, inDays: 240 }] },
  'pageturn-books': { balance: 420, expiring: [{ points: 200, inDays: 12 }, { points: 220, inDays: 95 }] },
  freshcart: { balance: 1350, expiring: [{ points: 1350, inDays: 140 }] },
  'reel-stars': { balance: 9, expiring: [{ points: 9, inDays: 4 }] },
};

/** The fictional student behind "Try the Demo". */
export const DEMO_PERSON = {
  displayName: 'Maya',
  categories: ['coffee', 'food', 'groceries', 'books'] as CategoryId[],
  linked: ['campus-coffee', 'northline-card', 'pageturn-books', 'freshcart', 'reel-stars'],
};

/** Habit profile used to generate a believable synthetic purchase history. */
const ROUTINE: { merchantId: string; perWeek: number; spend: [number, number]; hours: [number, number]; days: number[] }[] = [
  { merchantId: 'cc-union', perWeek: 4, spend: [4.5, 8.5], hours: [7, 10], days: [0, 1, 2, 3, 4] },
  { merchantId: 'cc-library', perWeek: 1.5, spend: [4, 7], hours: [14, 21], days: [0, 1, 2, 3, 6] },
  { merchantId: 'olive-ash', perWeek: 1, spend: [12, 36], hours: [12, 20], days: [3, 4, 5] },
  { merchantId: 'freshcart', perWeek: 1.2, spend: [28, 58], hours: [16, 20], days: [2, 5, 6] },
  { merchantId: 'pageturn', perWeek: 0.35, spend: [12, 45], hours: [13, 17], days: [0, 1, 2, 3, 4] },
  { merchantId: 'reel', perWeek: 0.5, spend: [11, 22], hours: [18, 22], days: [4, 5] },
];

/** Which merchants a program can see purchases from. A bank card sees all of them. */
export function programSeesMerchant(programId: string, merchantId: string) {
  if (programId === 'northline-card') return true;
  const p = programById(programId);
  const m = merchantById(merchantId);
  return !!p && !!m && p.category === m.category;
}

/** Small deterministic PRNG so each demo account gets the same history every time. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** 90 days of synthetic purchases visible to one linked program. */
export function syntheticPurchases(seed: string, programId: string, now = new Date()): Purchase[] {
  // One history per person; each program sees only the merchants it covers.
  const rand = rng(seed);
  const out: Purchase[] = [];
  for (const r of ROUTINE) {
    const visible = programSeesMerchant(programId, r.merchantId);
    const m = merchantById(r.merchantId)!;
    for (let d = 90; d >= 1; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      const weekday = (date.getDay() + 6) % 7;
      if (!r.days.includes(weekday)) continue;
      // Visits get slightly more frequent in the last two weeks (spend velocity).
      const boost = d <= 14 ? 1.25 : 1;
      if (rand() > (r.perWeek / r.days.length) * boost) continue;
      const hour = r.hours[0] + Math.floor(rand() * (r.hours[1] - r.hours[0] + 1));
      date.setHours(hour, Math.floor(rand() * 60), 0, 0);
      const amount = Math.round((r.spend[0] + rand() * (r.spend[1] - r.spend[0])) * 100) / 100;
      if (visible) out.push({ id: `${r.merchantId}-${d}`, programId, merchantId: m.id, category: m.category, amount, at: date.toISOString() });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export interface DayStop {
  id: string;
  time: string;
  label: string;
  lat: number;
  lng: number;
}

export interface DayRoute {
  id: string;
  name: string;
  blurb: string;
  /** 0 = Monday. */
  weekday: number;
  stops: DayStop[];
}

/** Routes for "Simulate a day": invented days past the sample shops, each in a different part of town. */
export const DAY_ROUTES: DayRoute[] = [
  {
    id: 'campus',
    name: 'Tuesday on campus',
    blurb: 'Classes, a coffee habit and a late study group.',
    weekday: 1,
    stops: [
      { id: 'morning', time: '08:10', label: 'Walking into the Student Union', lat: 30.2723, lng: -81.5081 },
      { id: 'lunch', time: '12:30', label: 'Lunch break on College Row', lat: 30.2778, lng: -81.5008 },
      { id: 'afternoon', time: '15:40', label: 'Between classes on Campus Walk', lat: 30.2743, lng: -81.5043 },
      { id: 'evening', time: '18:20', label: 'Heading home past Beach Parkway', lat: 30.2806, lng: -81.4991 },
      { id: 'late', time: '22:40', label: 'Leaving a late study group', lat: 30.2836, lng: -81.4956 },
    ],
  },
  {
    id: 'errands',
    name: 'Saturday errands',
    blurb: 'Groceries, a bookshop browse and a movie, no classes.',
    weekday: 5,
    stops: [
      { id: 'groceries', time: '10:15', label: 'Parking at the Beach Parkway shops', lat: 30.2811, lng: -81.4983 },
      { id: 'books', time: '13:05', label: 'Walking down Campus Walk', lat: 30.2748, lng: -81.5036 },
      { id: 'coffee', time: '15:30', label: 'Studying at the library', lat: 30.2699, lng: -81.5095 },
      { id: 'movie', time: '19:45', label: 'Meeting friends by the cinema', lat: 30.2843, lng: -81.4954 },
    ],
  },
  {
    id: 'exams',
    name: 'Exam week',
    blurb: 'Early starts and long library hours.',
    weekday: 3,
    stops: [
      { id: 'early', time: '07:20', label: 'First into the Student Union', lat: 30.2725, lng: -81.5083 },
      { id: 'library', time: '11:40', label: 'Settling into the library', lat: 30.2695, lng: -81.5101 },
      { id: 'break', time: '16:10', label: 'Stretching legs on Campus Walk', lat: 30.2741, lng: -81.5046 },
      { id: 'night', time: '20:50', label: 'Back at the library for the evening', lat: 30.2698, lng: -81.5096 },
    ],
  },
  {
    id: 'friday',
    name: 'Friday night out',
    blurb: 'Dinner on College Row, then a late film.',
    weekday: 4,
    stops: [
      { id: 'after-class', time: '16:45', label: 'Leaving the last class', lat: 30.2719, lng: -81.5072 },
      { id: 'dinner', time: '18:30', label: 'Arriving on College Row', lat: 30.2783, lng: -81.5001 },
      { id: 'film', time: '20:40', label: 'Walking to the cinema', lat: 30.2838, lng: -81.4953 },
    ],
  },
];

/** The default route's stops. */
export const DAY_STOPS = DAY_ROUTES[0].stops;

/**
 * For testing with a real device far from the demo campus: treat the first
 * place the member checked from as the Student Union, and measure movement
 * from there. Returns the position in demo-campus coordinates.
 */
export function toCampusSpace(here: { lat: number; lng: number }, anchor: { lat: number; lng: number }) {
  const union = DAY_STOPS[0];
  return { lat: union.lat + (here.lat - anchor.lat), lng: union.lng + (here.lng - anchor.lng) };
}

/** US units for display: feet when close, miles otherwise. */
export function distanceText(m: number) {
  if (m < 161) return `${Math.max(10, Math.round((m * 3.28084) / 10) * 10)} ft`;
  return `${(m / 1609.344).toFixed(1)} mi`;
}

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
