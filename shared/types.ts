// Shared domain types for Perkly. Imported by the web app and the Node API.

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

/** How a user can complete a reward. Not every offer supports every method. */
export type PaymentMethodKind = 'apple_pay' | 'saved_card' | 'online_banking' | 'in_store';

export type Channel = 'in_store' | 'online' | 'app';

export interface Program {
  id: string;
  name: string;
  brandId: string | null;
  unit: 'points' | 'miles';
  /** Dollar value of one unit when the program publishes a fixed rate. null = varies by redemption. */
  unitValue: number | null;
  unitValueBasis: string;
}

export interface Brand {
  id: string;
  name: string;
  category: CategoryId;
  /** Two-letter monogram used instead of a logo. Brands are fictional. */
  monogram: string;
}

export type BenefitKind =
  | 'amount_off'
  | 'percent_off'
  | 'points_pay'
  | 'points_multiplier'
  | 'freebie'
  | 'cashback'
  | 'miles_redemption'
  | 'points_redemption'
  | 'service';

export interface SplitRules {
  programId: string;
  /** Dollar value per point at the time of redemption, supplied by the program. */
  unitValue: number;
  minUnits: number;
  step: number;
  /** Optional cap on units per transaction. */
  maxUnits: number | null;
  note: string;
}

export interface Offer {
  id: string;
  brandId: string;
  programId: string | null;
  category: CategoryId;
  subcategory: string;
  /** Editorial headline, e.g. "$2 off your morning flat white". */
  headline: string;
  benefit: {
    kind: BenefitKind;
    /** Dollars for amount_off/cashback, percent for percent_off, multiplier for points_multiplier, units for miles/points redemptions. */
    value: number | null;
    /** Set when a cashback value is a percentage rather than dollars. */
    unit?: 'percent';
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
    paymentMethods: PaymentMethodKind[];
    accounts: string[];
  };
  notValid: {
    exclusions: string[];
    locations: string[];
    transactions: string[];
    stacking: string;
  };
  howToUse: {
    activationRequired: boolean;
    applies: 'automatic' | 'at_checkout' | 'code' | 'provider';
    pointsRedemption: boolean;
    manualStep: string | null;
    credit: 'immediate' | 'later' | 'unknown';
    creditNote: string;
  };
  redemption: {
    methods: PaymentMethodKind[];
    /** Only shown when the user picks in-store payment. */
    couponCode: string | null;
    split: SplitRules | null;
    splitUnsupportedReason: string | null;
    /** Offers whose redemption happens on the provider's side (award seats, hotel nights). */
    providerOnly: boolean;
  };
  demoPurchaseTotal: number | null;
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

export interface PaymentMethod {
  id: string;
  kind: PaymentMethodKind;
  label: string;
  /** Opaque provider reference. Never a card number. */
  tokenRef: string;
  preferred: boolean;
  isDemo: boolean;
}

export interface ProgramLink {
  programId: string;
  status: 'connected' | 'disconnected';
  balance: number;
  linkedAt: string | null;
  isDemo: boolean;
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

export type StepStatus = 'succeeded' | 'failed' | 'skipped' | 'reversed';

export interface RedemptionRecord {
  id: string;
  offerId: string;
  createdAt: string;
  purchaseTotal: number;
  discount: number;
  unitsApplied: number;
  rewardValueApplied: number;
  amountDue: number;
  paymentMethod: PaymentMethodKind | 'rewards_only' | null;
  status: 'completed_demo' | 'partial_failure_demo' | 'failed_demo';
  steps: { reward: StepStatus; payment: StepStatus };
  message: string;
  remainingBalance: number | null;
  isDemo: true;
}

export interface Activity {
  id: string;
  kind: 'earned' | 'redeemed' | 'cashback' | 'expired' | 'pending';
  label: string;
  amount: string;
  date: string;
  isDemo: true;
}
