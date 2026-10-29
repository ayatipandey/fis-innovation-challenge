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
  { id: 'shopping', label: 'Shopping and beauty', subcategories: ['Clothing', 'Beauty', 'Tech', 'Gifts'] },
  { id: 'transport', label: 'Transport', subcategories: ['Rideshare', 'Transit', 'Fuel'] },
  { id: 'wellness', label: 'Health and fitness', subcategories: ['Gym', 'Pharmacy', 'Yoga'] },
];

export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const PROGRAMS: Program[] = [
  {
    id: 'campus-coffee',
    name: 'Starmucks Rewards',
    issuer: 'Starmucks Coffee',
    kind: 'stamp_card',
    unit: 'points',
    category: 'coffee',
    monogram: 'SM',
    earnRule: '1 point per $1 spent at Starmucks.',
    expiryRule: 'Points expire 90 days after they are earned.',
  },
  {
    id: 'chick-fil-b',
    name: 'Chick-fil-B One',
    issuer: 'Chick-fil-B',
    kind: 'store_membership',
    unit: 'points',
    category: 'food',
    monogram: 'CB',
    earnRule: '10 points per $1 spent at Chick-fil-B.',
    expiryRule: 'Points expire 180 days after they are earned.',
  },
  {
    id: 'sephorra',
    name: 'Sephorra Beauty Insider',
    issuer: 'Sephorra',
    kind: 'store_membership',
    unit: 'points',
    category: 'shopping',
    monogram: 'SP',
    earnRule: '1 point per $1 spent at Sephorra.',
    expiryRule: 'Points expire 12 months after your last purchase.',
  },
  {
    id: 'pageturn-books',
    name: 'Barns & Novel Membership',
    issuer: 'Barns & Novel',
    kind: 'store_membership',
    unit: 'points',
    category: 'books',
    monogram: 'BN',
    earnRule: '10 points per $1 spent at Barns & Novel.',
    expiryRule: 'Points expire 12 months after they are earned.',
  },
  {
    id: 'freshcart',
    name: 'Pubmix Club Points',
    issuer: 'Pubmix',
    kind: 'store_membership',
    unit: 'points',
    category: 'groceries',
    monogram: 'PX',
    earnRule: '10 points per $1 spent at Pubmix.',
    expiryRule: 'Points expire 6 months after they are earned.',
  },
  {
    id: 'reel-stars',
    name: 'AMZ Stubs Stars',
    issuer: 'AMZ Theatres',
    kind: 'stamp_card',
    unit: 'stars',
    category: 'entertainment',
    monogram: 'AM',
    earnRule: '1 star per ticket.',
    expiryRule: 'Stars expire 60 days after they are earned.',
  },
];

export const programById = (id: string) => PROGRAMS.find((p) => p.id === id);

/** Demo locations. The brands are parodies of real local brands and the shops are fictional; only the places are real. */
export const FIS = { lat: 30.3192, lng: -81.6707, label: 'FIS office, 347 Riverside Ave' };
/** The second demo area: the University of North Florida campus, Jacksonville. */
export const CAMPUS = { lat: 30.2716, lng: -81.5076, label: 'UNF campus' };

export const MERCHANTS: Merchant[] = [
  // Around the FIS office (Riverside / Brooklyn, Jacksonville).
  { id: 'cc-riverside', name: 'Starmucks, Riverside Ave', category: 'coffee', subcategory: 'Coffee shops', address: 'Riverside Ave, Brooklyn', lat: 30.3186, lng: -81.6714, opens: 6, closes: 19, website: 'https://starmucks.example' },
  { id: 'cc-brooklyn', name: 'Starmucks, Brooklyn Station', category: 'coffee', subcategory: 'Coffee shops', address: 'Brooklyn Station, Riverside Ave', lat: 30.316, lng: -81.6733, opens: 6, closes: 21, website: 'https://starmucks.example' },
  { id: 'cfb-riverside', name: 'Chick-fil-B, Riverside', category: 'food', subcategory: 'Quick service', address: 'Riverside Ave', lat: 30.3166, lng: -81.6748, opens: 7, closes: 22, website: 'https://chick-fil-b.example' },
  { id: 'px-brooklyn', name: 'Pubmix, Brooklyn Station', category: 'groceries', subcategory: 'Supermarket', address: 'Brooklyn Station, Riverside Ave', lat: 30.3134, lng: -81.675, opens: 7, closes: 22, website: 'https://pubmix.example' },
  { id: 'bn-fivepoints', name: 'Barns & Novel, Five Points', category: 'books', subcategory: 'Bookstore', address: 'Park St, Five Points', lat: 30.3108, lng: -81.6799, opens: 9, closes: 21, website: 'https://barns-and-novel.example' },
  { id: 'amz-downtown', name: 'AMZ Theatres, Downtown', category: 'entertainment', subcategory: 'Cinema', address: 'Bay St, Downtown', lat: 30.3262, lng: -81.6612, opens: 11, closes: 24, website: 'https://amz-theatres.example' },
  { id: 'sp-sanmarco', name: 'Sephorra, San Marco', category: 'shopping', subcategory: 'Beauty', address: 'San Marco Square', lat: 30.3046, lng: -81.6553, opens: 10, closes: 21, website: 'https://sephorra.example' },
  // Around the UNF campus.
  { id: 'cc-union', name: 'Starmucks, UNF Student Union', category: 'coffee', subcategory: 'Coffee shops', address: 'Student Union, ground floor', lat: 30.2722, lng: -81.5079, opens: 7, closes: 20, website: 'https://starmucks.example' },
  { id: 'cc-library', name: 'Starmucks, UNF Library', category: 'coffee', subcategory: 'Coffee shops', address: 'Library, level 1', lat: 30.2697, lng: -81.5098, opens: 8, closes: 22, website: 'https://starmucks.example' },
  { id: 'olive-ash', name: 'Chick-fil-B, St. Johns Bluff', category: 'food', subcategory: 'Quick service', address: 'St. Johns Bluff Rd', lat: 30.278, lng: -81.5005, opens: 7, closes: 22, website: 'https://chick-fil-b.example' },
  { id: 'pageturn', name: 'Barns & Novel, UNF Bookstore', category: 'books', subcategory: 'Bookstore', address: 'UNF Bookstore', lat: 30.2745, lng: -81.504, opens: 9, closes: 20, website: 'https://barns-and-novel.example' },
  { id: 'freshcart', name: 'Pubmix, Beach Blvd', category: 'groceries', subcategory: 'Supermarket', address: 'Beach Blvd', lat: 30.2808, lng: -81.4987, opens: 7, closes: 22, website: 'https://pubmix.example' },
  { id: 'sp-towncenter', name: 'Sephorra, St. Johns Town Center', category: 'shopping', subcategory: 'Beauty', address: 'St. Johns Town Center', lat: 30.2566, lng: -81.5268, opens: 10, closes: 21, website: 'https://sephorra.example' },
  { id: 'reel', name: 'AMZ Theatres, Southside', category: 'entertainment', subcategory: 'Cinema', address: 'Southside Blvd', lat: 30.284, lng: -81.495, opens: 12, closes: 24, website: 'https://amz-theatres.example' },
];

export const merchantById = (id: string | null) => (id ? MERCHANTS.find((m) => m.id === id) : undefined);

const both: RewardOption['channels'] = ['in_store', 'online'];

export const OPTIONS: RewardOption[] = [
  // Starmucks: the 70-point example. Small, frequent rewards vs one big one with a minimum.
  {
    id: 'cc-2off', programId: 'campus-coffee', merchantIds: ['cc-riverside', 'cc-brooklyn', 'cc-union', 'cc-library'], title: '$2 off any drink', cost: 10, value: 2,
    valueBasis: 'Fixed $2.00 discount.', minSpend: null, channels: both,
    valid: ['Any drink, any size', 'All Starmucks locations and the mobile-order app'],
    notValid: ['Bags of coffee beans and merchandise', 'Gift cards'], stacking: 'One reward per order.',
    howToUse: { online: 'Order ahead in the Starmucks app with the points already applied.', inStore: 'Show your code at the counter before you pay.' },
    url: 'https://starmucks.example/order',
  },
  {
    id: 'cc-latte', programId: 'campus-coffee', merchantIds: ['cc-riverside', 'cc-brooklyn', 'cc-union', 'cc-library'], title: 'A free latte', cost: 25, value: 5,
    valueBasis: 'Menu price of a regular latte.', minSpend: null, channels: both,
    valid: ['Regular latte, any milk', 'All Starmucks locations'],
    notValid: ['Large size upgrades are charged', 'Gift cards'], stacking: 'One reward per order.',
    howToUse: { online: 'Order ahead with the points already applied.', inStore: 'Show your code at the counter.' },
    url: 'https://starmucks.example/order',
  },
  {
    id: 'cc-15off', programId: 'campus-coffee', merchantIds: ['cc-riverside', 'cc-brooklyn', 'cc-union', 'cc-library'], title: '$15 off an order of $20 or more', cost: 70, value: 15,
    valueBasis: 'Fixed $15.00 discount on orders of $20.00 or more.', minSpend: 20, channels: both,
    valid: ['Drinks, food and catering trays'],
    notValid: ['Gift cards', 'Merchandise'], stacking: 'One reward per order.',
    howToUse: { online: 'Order ahead with the points already applied.', inStore: 'Show your code at the counter.' },
    url: 'https://starmucks.example/order',
  },

  // Chick-fil-B One points.
  {
    id: 'cfb-sandwich', programId: 'chick-fil-b', merchantIds: ['cfb-riverside', 'olive-ash'], title: 'A free chicken sandwich', cost: 600, value: 6.5,
    valueBasis: 'Menu price of a chicken sandwich.', minSpend: null, channels: both,
    valid: ['Original or spicy chicken sandwich', 'Any Chick-fil-B'],
    notValid: ['Meals and sides', 'Catering'], stacking: 'One reward per order.',
    howToUse: { online: 'Order ahead in the Chick-fil-B app with the points already applied.', inStore: 'Show your code at the counter.' },
    url: 'https://chick-fil-b.example/order',
  },
  {
    id: 'cfb-nuggets', programId: 'chick-fil-b', merchantIds: ['cfb-riverside', 'olive-ash'], title: 'Free 8-count nuggets', cost: 500, value: 5.25,
    valueBasis: 'Menu price of an 8-count nuggets.', minSpend: null, channels: both,
    valid: ['Grilled or breaded nuggets'],
    notValid: ['Meals and sides', 'Catering'], stacking: 'One reward per order.',
    howToUse: { online: 'Order ahead in the Chick-fil-B app with the points already applied.', inStore: 'Show your code at the counter.' },
    url: 'https://chick-fil-b.example/order',
  },
  {
    id: 'cfb-catering', programId: 'chick-fil-b', merchantIds: ['cfb-riverside', 'olive-ash'], title: '$10 off a catering order of $40 or more', cost: 1200, value: 10,
    valueBasis: 'Fixed $10.00 discount on catering orders of $40.00 or more.', minSpend: 40, channels: both,
    valid: ['Catering trays and family meals'],
    notValid: ['Delivery fees', 'Gift cards'], stacking: 'One reward per order.',
    howToUse: { online: 'Order catering in the Chick-fil-B app with the points already applied.', inStore: 'Show your code when you order at the counter.' },
    url: 'https://chick-fil-b.example/catering',
  },

  // Sephorra Beauty Insider points.
  {
    id: 'sp-sample', programId: 'sephorra', merchantIds: ['sp-sanmarco', 'sp-towncenter'], title: 'A free deluxe sample', cost: 250, value: 4,
    valueBasis: 'Typical retail value of a deluxe sample.', minSpend: null, channels: both,
    valid: ['Skincare, makeup and fragrance samples, while stocks last'],
    notValid: ['Full-size products'], stacking: 'Up to 3 samples per order.',
    howToUse: { online: 'Add it at checkout on Sephorra’s site with the points already applied.', inStore: 'Show your code at the register.' },
    url: 'https://sephorra.example/rewards',
  },
  {
    id: 'sp-10off', programId: 'sephorra', merchantIds: ['sp-sanmarco', 'sp-towncenter'], title: '$10 off any purchase', cost: 500, value: 10,
    valueBasis: 'Fixed $10.00 discount.', minSpend: null, channels: both,
    valid: ['Makeup, skincare, fragrance and hair'],
    notValid: ['Gift cards', 'Services'], stacking: 'One reward per order.',
    howToUse: { online: 'Shop on Sephorra’s site with the points already applied.', inStore: 'Show your code at the register.' },
    url: 'https://sephorra.example/shop',
  },
  {
    id: 'sp-20off', programId: 'sephorra', merchantIds: ['sp-sanmarco', 'sp-towncenter'], title: '$20 off an order of $50 or more', cost: 750, value: 20,
    valueBasis: 'Fixed $20.00 discount on orders of $50.00 or more.', minSpend: 50, channels: both,
    valid: ['Makeup, skincare, fragrance and hair'],
    notValid: ['Gift cards', 'Services'], stacking: 'One reward per order.',
    howToUse: { online: 'Shop on Sephorra’s site with the points already applied.', inStore: 'Show your code at the register.' },
    url: 'https://sephorra.example/shop',
  },

  // Barns & Novel membership.
  {
    id: 'pt-5off', programId: 'pageturn-books', merchantIds: ['bn-fivepoints', 'pageturn'], title: '$5 off any purchase', cost: 250, value: 5,
    valueBasis: 'Fixed $5.00 discount.', minSpend: null, channels: both,
    valid: ['Books, stationery and gifts'],
    notValid: ['Gift cards', 'Textbook rentals'], stacking: 'One reward per order.',
    howToUse: { online: 'Shop on Barns & Novel’s site with the points already applied.', inStore: 'Show your code at the register.' },
    url: 'https://barns-and-novel.example/shop',
  },
  {
    id: 'pt-15off', programId: 'pageturn-books', merchantIds: ['bn-fivepoints', 'pageturn'], title: '$15 off textbooks over $50', cost: 600, value: 15,
    valueBasis: 'Fixed $15.00 discount on textbooks totalling $50.00 or more.', minSpend: 50, channels: both,
    valid: ['New and used textbooks'],
    notValid: ['Textbook rentals', 'Digital access codes'], stacking: 'One reward per order.',
    howToUse: { online: 'Shop on Barns & Novel’s site with the points already applied.', inStore: 'Show your code at the register.' },
    url: 'https://barns-and-novel.example/textbooks',
  },

  // Pubmix grocery points.
  {
    id: 'fc-5off', programId: 'freshcart', merchantIds: ['px-brooklyn', 'freshcart'], title: '$5 off your shop', cost: 500, value: 5,
    valueBasis: 'Fixed $5.00 discount.', minSpend: null, channels: both,
    valid: ['Groceries and household items'],
    notValid: ['Alcohol and tobacco', 'Gift cards'], stacking: 'One reward per shop.',
    howToUse: { online: 'Shop on Pubmix’s site with the points already applied.', inStore: 'Scan your code at the register.' },
    url: 'https://pubmix.example/shop',
  },
  {
    id: 'fc-12off', programId: 'freshcart', merchantIds: ['px-brooklyn', 'freshcart'], title: '$12 off a shop of $40 or more', cost: 1000, value: 12,
    valueBasis: 'Fixed $12.00 discount on shops of $40.00 or more.', minSpend: 40, channels: both,
    valid: ['Groceries and household items'],
    notValid: ['Alcohol and tobacco', 'Gift cards', 'Delivery fees'], stacking: 'One reward per shop.',
    howToUse: { online: 'Shop on Pubmix’s site with the points already applied.', inStore: 'Scan your code at the register.' },
    url: 'https://pubmix.example/shop',
  },

  // AMZ Theatres stars.
  {
    id: 'rc-popcorn', programId: 'reel-stars', merchantIds: ['amz-downtown', 'reel'], title: 'Free medium popcorn', cost: 5, value: 6.5,
    valueBasis: 'Menu price of a medium popcorn.', minSpend: null, channels: ['in_store'],
    valid: ['Medium popcorn, any flavor'],
    notValid: ['Combo meals'], stacking: 'One per visit.',
    howToUse: { online: null, inStore: 'Show your code at the concession stand.' },
    url: null,
  },
  {
    id: 'rc-ticket', programId: 'reel-stars', merchantIds: ['amz-downtown', 'reel'], title: 'A free standard ticket', cost: 12, value: 13,
    valueBasis: 'Price of a standard evening ticket.', minSpend: null, channels: both,
    valid: ['Standard 2D screenings'],
    notValid: ['IMAX, 3D and special events'], stacking: 'One per booking.',
    howToUse: { online: 'Book on AMZ’s site with the stars already applied.', inStore: 'Show your code at the box office.' },
    url: 'https://amz-theatres.example/book',
  },
];

export const optionById = (id: string) => OPTIONS.find((o) => o.id === id);
export const optionsFor = (programId: string) => OPTIONS.filter((o) => o.programId === programId);

/** Starting balances and expiring batches granted when a sample program is linked. */
export const DEMO_BALANCES: Record<string, { balance: number; expiring: { points: number; inDays: number }[] }> = {
  'campus-coffee': { balance: 70, expiring: [{ points: 30, inDays: 6 }, { points: 40, inDays: 52 }] },
  'chick-fil-b': { balance: 1450, expiring: [{ points: 500, inDays: 15 }, { points: 950, inDays: 160 }] },
  sephorra: { balance: 820, expiring: [{ points: 300, inDays: 9 }, { points: 520, inDays: 300 }] },
  'pageturn-books': { balance: 420, expiring: [{ points: 200, inDays: 12 }, { points: 220, inDays: 95 }] },
  freshcart: { balance: 1350, expiring: [{ points: 1350, inDays: 140 }] },
  'reel-stars': { balance: 9, expiring: [{ points: 9, inDays: 4 }] },
};

/** The fictional member behind "Try the demo". */
export const DEMO_PERSON = {
  displayName: 'John',
  fullName: 'John Doe',
  categories: ['coffee', 'food', 'groceries', 'shopping'] as CategoryId[],
  linked: ['campus-coffee', 'chick-fil-b', 'sephorra', 'pageturn-books', 'freshcart', 'reel-stars'],
};

/** Habit profile used to generate a believable synthetic purchase history: workdays near FIS, evening classes at UNF. */
const ROUTINE: { merchantId: string; perWeek: number; spend: [number, number]; hours: [number, number]; days: number[] }[] = [
  { merchantId: 'cc-riverside', perWeek: 3.5, spend: [4.5, 8.5], hours: [7, 9], days: [0, 1, 2, 3, 4] },
  { merchantId: 'cc-brooklyn', perWeek: 1, spend: [4, 7], hours: [14, 16], days: [0, 1, 2, 3, 4] },
  { merchantId: 'cc-library', perWeek: 1, spend: [4, 7], hours: [17, 20], days: [1, 3] },
  { merchantId: 'cfb-riverside', perWeek: 1.2, spend: [9, 16], hours: [11, 13], days: [0, 1, 2, 3, 4] },
  { merchantId: 'px-brooklyn', perWeek: 1.2, spend: [28, 58], hours: [17, 19], days: [1, 3, 4] },
  { merchantId: 'freshcart', perWeek: 0.4, spend: [30, 55], hours: [10, 14], days: [5, 6] },
  { merchantId: 'pageturn', perWeek: 0.25, spend: [12, 45], hours: [17, 19], days: [1, 3] },
  { merchantId: 'bn-fivepoints', perWeek: 0.2, spend: [12, 30], hours: [12, 16], days: [5, 6] },
  { merchantId: 'sp-towncenter', perWeek: 0.3, spend: [25, 70], hours: [13, 17], days: [5, 6] },
  { merchantId: 'sp-sanmarco', perWeek: 0.2, spend: [20, 60], hours: [17, 19], days: [2, 4] },
  { merchantId: 'amz-downtown', perWeek: 0.5, spend: [11, 22], hours: [18, 22], days: [4, 5] },
];

/** Which merchants a program can see purchases from: its own shops. */
export function programSeesMerchant(programId: string, merchantId: string) {
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
  /** Which demo area the route is in. */
  place: 'fis' | 'unf';
  name: string;
  blurb: string;
  /** 0 = Monday. */
  weekday: number;
  stops: DayStop[];
}

/** Routes for "Simulate a day": invented days past the sample shops, around the FIS office first, then the UNF campus. */
export const DAY_ROUTES: DayRoute[] = [
  {
    id: 'fis-workday',
    place: 'fis',
    name: 'Workday at FIS',
    blurb: 'Morning coffee, lunch on Riverside Ave, groceries on the way home.',
    weekday: 1,
    stops: [
      { id: 'arrive', time: '08:20', label: 'Arriving at the FIS office', lat: 30.3192, lng: -81.6707 },
      { id: 'lunch', time: '12:10', label: 'Lunch walk down Riverside Ave', lat: 30.3169, lng: -81.6744 },
      { id: 'break', time: '15:30', label: 'Afternoon break at Brooklyn Station', lat: 30.3163, lng: -81.673 },
      { id: 'home', time: '17:50', label: 'Heading home through Brooklyn Station', lat: 30.3137, lng: -81.6747 },
      { id: 'late', time: '21:40', label: 'Leaving a late film downtown', lat: 30.3258, lng: -81.6616 },
    ],
  },
  {
    id: 'fis-friday',
    place: 'fis',
    name: 'Friday near FIS',
    blurb: 'A short Friday: lunch, a Five Points browse, then a film downtown.',
    weekday: 4,
    stops: [
      { id: 'arrive', time: '08:25', label: 'Walking into the FIS office', lat: 30.319, lng: -81.6709 },
      { id: 'lunch', time: '12:20', label: 'Team lunch on Riverside Ave', lat: 30.3168, lng: -81.6745 },
      { id: 'browse', time: '18:15', label: 'Browsing in Five Points', lat: 30.3111, lng: -81.6795 },
      { id: 'film', time: '20:20', label: 'Walking to the cinema downtown', lat: 30.3259, lng: -81.6615 },
    ],
  },
  {
    id: 'campus',
    place: 'unf',
    name: 'Tuesday at UNF',
    blurb: 'Classes, a coffee habit and a late study group.',
    weekday: 1,
    stops: [
      { id: 'morning', time: '08:10', label: 'Walking into the Student Union', lat: 30.2723, lng: -81.5081 },
      { id: 'lunch', time: '12:30', label: 'Lunch break on College Row', lat: 30.2778, lng: -81.5008 },
      { id: 'afternoon', time: '15:40', label: 'Between classes on Campus Walk', lat: 30.2743, lng: -81.5043 },
      { id: 'evening', time: '18:20', label: 'Heading home along Beach Blvd', lat: 30.2806, lng: -81.4991 },
      { id: 'late', time: '22:40', label: 'Leaving a late study group', lat: 30.2836, lng: -81.4956 },
    ],
  },
  {
    id: 'errands',
    place: 'unf',
    name: 'Saturday near UNF',
    blurb: 'Groceries, a Town Center trip, the library and a movie.',
    weekday: 5,
    stops: [
      { id: 'groceries', time: '10:15', label: 'Parking at the Beach Blvd shops', lat: 30.2811, lng: -81.4983 },
      { id: 'beauty', time: '13:40', label: 'Walking through St. Johns Town Center', lat: 30.2569, lng: -81.5263 },
      { id: 'coffee', time: '15:30', label: 'Studying at the library', lat: 30.2699, lng: -81.5095 },
      { id: 'movie', time: '19:45', label: 'Meeting friends by the cinema', lat: 30.2843, lng: -81.4954 },
    ],
  },
  {
    id: 'exams',
    place: 'unf',
    name: 'Exam week at UNF',
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
    place: 'unf',
    name: 'Friday night near UNF',
    blurb: 'A Chick-fil-B stop, then a late film.',
    weekday: 4,
    stops: [
      { id: 'after-class', time: '16:45', label: 'Leaving the last class', lat: 30.2719, lng: -81.5072 },
      { id: 'dinner', time: '18:30', label: 'Arriving on College Row', lat: 30.2783, lng: -81.5001 },
      { id: 'film', time: '20:40', label: 'Walking to the cinema', lat: 30.2838, lng: -81.4953 },
    ],
  },
];

/** The default route's stops (FIS). */
export const DAY_STOPS = DAY_ROUTES[0].stops;

/** Where Perkly's Pilot stands in each demo area. */
export const DEMO_SPOTS = {
  fis: { id: 'fis', name: 'FIS office', detail: '347 Riverside Ave', lat: 30.3192, lng: -81.6707 },
  unf: { id: 'unf', name: 'UNF campus', detail: 'Student Union', lat: 30.2723, lng: -81.5081 },
} as const;

/**
 * For testing with a real device far from both demo areas: treat the first
 * place the member checked from as the FIS office, and measure movement from
 * there. Returns the position in demo coordinates.
 */
export function toCampusSpace(here: { lat: number; lng: number }, anchor: { lat: number; lng: number }) {
  const office = DEMO_SPOTS.fis;
  return { lat: office.lat + (here.lat - anchor.lat), lng: office.lng + (here.lng - anchor.lng) };
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
