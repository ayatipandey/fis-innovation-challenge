import { z } from 'zod';
import { BRANDS, CATEGORIES } from '../../shared/demo-data';

const categoryIds = CATEGORIES.map((c) => c.id) as [string, ...string[]];
const subcategories = new Set(CATEGORIES.flatMap((c) => c.subcategories));
const brandIds = new Set(BRANDS.map((b) => b.id));
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const preferencesSchema = z
  .object({
    displayName: z.string().trim().max(40),
    categories: z.array(z.enum(categoryIds)).max(13),
    subcategories: z.array(z.string().refine((s) => subcategories.has(s), 'Unknown subcategory')).max(60),
    favoriteBrands: z.array(z.string().refine((s) => brandIds.has(s), 'Unknown brand')).max(40),
    notifications: z.object({
      preset: z.enum(['essential', 'balanced', 'personalized']),
      dailyLimit: z.number().int().min(0).max(10),
      categories: z.array(z.enum(categoryIds)).max(13),
      favoriteBrandAlerts: z.boolean(),
      expirationReminders: z.boolean(),
      locationAlerts: z.boolean(),
      quietHours: z.object({ enabled: z.boolean(), start: time, end: time }),
      days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).max(7),
      channels: z.array(z.enum(['push', 'email'])).max(2),
      routineAlerts: z.boolean(),
    }),
    accessibility: z.object({
      textSize: z.enum(['default', 'large', 'larger']),
      highContrast: z.boolean(),
      reducedMotion: z.boolean(),
    }),
    privacy: z.object({
      personalization: z.boolean(),
      spendingData: z.boolean(),
      location: z.boolean(),
      marketing: z.boolean(),
    }),
    onboarding: z.object({ completed: z.boolean(), skipped: z.array(z.string().max(30)).max(10) }),
  })
  .strict();

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254),
    password: z.string().max(128),
    termsAccepted: z.literal(true, { message: 'You need to agree to the Terms of Service to create an account.' }),
    termsVersion: z.string().max(40),
    optional: z
      .object({ spendingData: z.boolean(), location: z.boolean(), marketing: z.boolean() })
      .strict()
      .default({ spendingData: false, location: false, marketing: false }),
  })
  .strict();

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().max(254), password: z.string().max(128) }).strict();

export const redeemSchema = z
  .object({
    offerId: z.string().max(80),
    purchaseTotal: z.number().min(0).max(100000),
    unitsApplied: z.number().int().min(0).max(10_000_000),
    method: z.enum(['apple_pay', 'saved_card', 'online_banking', 'in_store', 'rewards_only']).nullable(),
    scenario: z.enum(['normal', 'payment_declined', 'reward_unavailable', 'reversal_failed']).default('normal'),
  })
  .strict();

/** Only a method kind is accepted. Card numbers and CVVs are rejected by shape, not by trust. */
export const paymentMethodSchema = z.object({ kind: z.enum(['apple_pay', 'saved_card', 'online_banking']) }).strict();

export const timeQuery = z.object({
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
});

export const copilotSchema = z
  .object({
    message: z.string().trim().min(1, 'Type a question first.').max(1000),
    weekday: z.number().int().min(0).max(6).optional(),
    hour: z.number().int().min(0).max(23).optional(),
  })
  .strict();

export const eligibilitySchema = z
  .object({
    offerId: z.string().max(80),
    channel: z.enum(['in_store', 'online', 'app']).optional(),
    paymentMethod: z.enum(['apple_pay', 'saved_card', 'online_banking', 'in_store']).optional(),
    purchaseTotal: z.number().min(0).max(100000).optional(),
  })
  .strict();

export function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message && !issue.message.startsWith('Invalid') ? issue.message : 'Some of the information sent was not valid.';
}
