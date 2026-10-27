// Shared domain types for Perkly. Imported by the web app and the Node API.
//
// Perkly is a free membership network: partner brands offer rewards to Perkly
// members. Members use a reward on the brand's own website, or in store with a
// code. Perkly never takes payment and issues no points.

export type CategoryId =
  | 'food'
  | 'coffee'
  | 'groceries'
  | 'travel'
  | 'hotels'
  | 'fashion'
  | 'watches'
  | 'beauty'
  | 'tech'
  | 'entertainment'
  | 'transport'
  | 'wellness'
  | 'other';

export interface Category {
  id: CategoryId;
  label: string;
  subcategories: string[];
}

export type Channel = 'online' | 'in_store';

export interface Brand {
  id: string;
  name: string;
  category: CategoryId;
  /** Two-letter monogram used instead of a logo. Brands are fictional. */
  monogram: string;
  /** The partner's website. Demo brands use reserved .example domains. */
  website: string;
}

export type BenefitKind = 'amount_off' | 'percent_off' | 'freebie' | 'service';

export interface Offer {
  id: string;
  brandId: string;
  category: CategoryId;
  subcategory: string;
  /** Editorial headline, e.g. "$2 off your morning flat white". */
  headline: string;
  benefit: {
    kind: BenefitKind;
    /** Dollars for amount_off, percent for percent_off. */
    value: number | null;
    summary: string;
  };
  valueEstimate: { amount: number | null; basis: string };
  minSpend: number | null;
  maxBenefit: number | null;
  youPay: { summary: string; knownFees: string[]; feesUnknown: boolean };
  validFrom: string;
  expiresAt: string;
  valid: {
    items: string[];
    locations: string[];
    channels: Channel[];
    /** Who qualifies, e.g. "All Perkly members", "New customers only". */
    who: string[];
  };
  notValid: {
    exclusions: string[];
    locations: string[];
    transactions: string[];
    stacking: string;
  };
  /** Plain-language steps for each channel the offer supports. */
  howToUse: { online: string | null; inStore: string | null; whenYouGetIt: string };
  redemption: {
    /** Deep link to the partner's site. Demo links point at .example domains and are simulated. */
    url: string | null;
    /** Member code, shown for in-store use and applied automatically online when supported. */
    code: string;
    codeAutoAppliedOnline: boolean;
  };
  nearby: { label: string; distanceMeters: number } | null;
  routine: Array<'weekday_morning' | 'evening' | 'weekend'>;
  sponsored: boolean;
  source: 'synthetic_demo';
  verification: 'unverified_demo';
  termsUrl: string | null;
}

export interface SpendingSummary {
  /** Share of spend by category over the last 90 days, 0–1. */
  share: Partial<Record<CategoryId, number>>;
  /** Typical transaction size by category, in dollars. */
  typicalSpend: Partial<Record<CategoryId, number>>;
  source: 'synthetic_demo' | 'none';
}

export interface NotificationPrefs {
  preset: 'essential' | 'balanced' | 'personalized';
  dailyLimit: number;
  categories: CategoryId[];
  favoriteBrandAlerts: boolean;
  expirationReminders: boolean;
  locationAlerts: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
  days: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>;
  channels: Array<'push' | 'email'>;
  routineAlerts: boolean;
}

export interface AccessibilityPrefs {
  textSize: 'default' | 'large' | 'larger';
  highContrast: boolean;
  reducedMotion: boolean;
}

export interface PrivacyPrefs {
  personalization: boolean;
  spendingData: boolean;
  location: boolean;
  marketing: boolean;
}

export interface Preferences {
  displayName: string;
  categories: CategoryId[];
  subcategories: string[];
  favoriteBrands: string[];
  notifications: NotificationPrefs;
  accessibility: AccessibilityPrefs;
  privacy: PrivacyPrefs;
  onboarding: {
    completed: boolean;
    skipped: string[];
  };
}

export interface Recommendation {
  offerId: string;
  score: number;
  reasons: string[];
  warnings: string[];
}

export interface RecommendationResult {
  items: Recommendation[];
  engine: 'perkly-scorer-v1' | 'local-fallback-v1';
  generatedAt: string;
  note: string;
}

/** A reward a member used. In the demo the partner's report is simulated. */
export interface RewardUse {
  id: string;
  offerId: string;
  channel: Channel;
  createdAt: string;
  /** Estimated saving from the offer's stated value, when one exists. */
  estimatedSaving: number | null;
  status: 'reported_demo';
  isDemo: true;
}

export interface Activity {
  id: string;
  kind: 'used' | 'saved' | 'expired';
  label: string;
  amount: string;
  date: string;
  isDemo: true;
}
