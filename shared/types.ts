// Shared domain types for Perkly. Imported by the web app and the Node API.
//
// Perkly links, read-only, to the loyalty programs a member already has. It
// reads balances, expiry dates and (with permission) purchase history, turns a
// balance into specific rewards, and picks the right moment to suggest one.
// Perkly never issues or holds points: redemptions are completed by the
// program, and Perkly only places a short hold so the same points can't be
// spent twice while a redemption is in progress.

export type CategoryId =
  | 'coffee'
  | 'food'
  | 'groceries'
  | 'books'
  | 'entertainment'
  | 'shopping'
  | 'transport'
  | 'wellness';

export interface Category {
  id: CategoryId;
  label: string;
  subcategories: string[];
}

export type Channel = 'online' | 'in_store';

export type ProgramKind = 'bank_card' | 'stamp_card' | 'store_membership';

export interface Program {
  id: string;
  name: string;
  /** The business that runs the program. Fictional in the prototype. */
  issuer: string;
  kind: ProgramKind;
  unit: 'points' | 'stars';
  category: CategoryId | null;
  monogram: string;
  /** Plain-language summary of how points are earned. */
  earnRule: string;
  expiryRule: string;
}

export interface Merchant {
  id: string;
  name: string;
  category: CategoryId;
  subcategory: string;
  address: string;
  lat: number;
  lng: number;
  /** Opening hours, 24h clock. */
  opens: number;
  closes: number;
  website: string;
}

/** One thing a balance can buy. */
export interface RewardOption {
  id: string;
  programId: string;
  /** Where the reward can be used in person. Empty for online-only rewards like statement credit. */
  merchantIds: string[];
  title: string;
  cost: number;
  /** Dollar value of the reward. */
  value: number;
  valueBasis: string;
  minSpend: number | null;
  channels: Channel[];
  valid: string[];
  notValid: string[];
  stacking: string;
  howToUse: { online: string | null; inStore: string | null };
  /** Seller deep link. Demo links use reserved .example domains. */
  url: string | null;
}

export interface PointExpiry {
  points: number;
  expiresAt: string;
}

export interface LinkedProgram {
  programId: string;
  balance: number;
  held: number;
  available: number;
  expiries: PointExpiry[];
  linkedAt: string;
  shares: { history: boolean; visits: boolean };
  isDemo: true;
}

export interface Purchase {
  id: string;
  programId: string;
  merchantId: string;
  category: CategoryId;
  amount: number;
  at: string;
}

/** Spending habits derived from shared purchase history. */
export interface Habits {
  /** Visits per week by category. */
  visitsPerWeek: Partial<Record<CategoryId, number>>;
  /** Typical spend per visit by category. */
  typicalSpend: Partial<Record<CategoryId, number>>;
  /** Share of visits by hour of day (0–23) per category, each row sums to 1. */
  hourShare: Partial<Record<CategoryId, number[]>>;
  /** Spend in the last 14 days divided by the 14 days before, by category. */
  spendVelocity: Partial<Record<CategoryId, number>>;
  source: 'linked_history' | 'none';
}

export interface PlanStep {
  optionId: string;
  times: number;
}

/** A way to use a balance, e.g. "7 × $2 off" or "1 × $15 off". */
export interface UsePlan {
  id: string;
  programId: string;
  label: string;
  steps: PlanStep[];
  pointsUsed: number;
  leftover: number;
  totalValue: number;
  valuePerPoint: number;
  visits: number;
  extraSpend: number;
  valueAtRisk: number;
  score: number;
  reasons: string[];
  warnings: string[];
}

export type HoldStatus = 'held' | 'confirmed' | 'released' | 'expired';

export interface Hold {
  id: string;
  programId: string;
  optionId: string;
  points: number;
  channel: Channel;
  code: string;
  status: HoldStatus;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  isDemo: true;
}

export type Rating = 'good' | 'fine' | 'bad';

/** A notification the moment engine decided to send, or chose not to. */
export interface Moment {
  id: string;
  optionId: string;
  merchantId: string | null;
  sent: boolean;
  title: string;
  body: string;
  reasons: string[];
  suppressedBecause: string | null;
  uplift: number;
  pIfNotified: number;
  pIfNot: number;
  distanceM: number | null;
  at: string;
  context: 'simulated' | 'device';
  /** `category:time-of-day`, the bucket a rating tunes. */
  ratingKey: string | null;
  rating: Rating | null;
  ratingMessage: string | null;
  isDemo: true;
}

export type ThemeId = 'fresh-green' | 'ivory-silk' | 'sage-mist' | 'sandy-shore' | 'seafoam-sun';

export interface NotificationPrefs {
  preset: 'essential' | 'balanced' | 'personalized';
  dailyLimit: number;
  expirationReminders: boolean;
  locationAlerts: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
  channels: Array<'push' | 'email'>;
}

export interface AccessibilityPrefs {
  textSize: 'default' | 'large' | 'larger';
  highContrast: boolean;
  reducedMotion: boolean;
}

export interface PrivacyPrefs {
  personalization: boolean;
  location: boolean;
  useHistory: boolean;
  marketing: boolean;
}

export interface Preferences {
  displayName: string;
  categories: CategoryId[];
  theme: ThemeId;
  notifications: NotificationPrefs;
  accessibility: AccessibilityPrefs;
  privacy: PrivacyPrefs;
  onboarding: { completed: boolean; skipped: string[] };
}

export interface Activity {
  id: string;
  kind: 'redeemed' | 'held' | 'released' | 'expired' | 'linked';
  label: string;
  amount: string;
  date: string;
  isDemo: true;
}
