import { z } from 'zod';
import { CATEGORIES, PROGRAMS } from '../../shared/demo-data.js';
import { THEMES } from '../../shared/themes.js';

const categoryIds = CATEGORIES.map((c) => c.id) as [string, ...string[]];
const themeIds = THEMES.map((t) => t.id) as [string, ...string[]];
export const programIds = new Set(PROGRAMS.map((p) => p.id));
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const preferencesSchema = z
  .object({
    displayName: z.string().trim().max(40),
    categories: z.array(z.enum(categoryIds)).max(CATEGORIES.length),
    theme: z.enum(themeIds),
    notifications: z.object({
      preset: z.enum(['essential', 'balanced', 'personalized']),
      dailyLimit: z.number().int().min(0).max(10),
      expirationReminders: z.boolean(),
      locationAlerts: z.boolean(),
      quietHours: z.object({ enabled: z.boolean(), start: time, end: time }),
      channels: z.array(z.enum(['push', 'email'])).max(2),
    }),
    accessibility: z.object({
      textSize: z.enum(['default', 'large', 'larger']),
      highContrast: z.boolean(),
      reducedMotion: z.boolean(),
    }),
    privacy: z.object({
      personalization: z.boolean(),
      location: z.boolean(),
      useHistory: z.boolean(),
      marketing: z.boolean(),
    }),
    onboarding: z.object({ completed: z.boolean(), skipped: z.array(z.string().max(30)).max(10) }),
  })
  .strict();

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254),
    password: z.string().max(128),
    firstName: z.string().trim().max(40).default(''),
    termsAccepted: z.literal(true, { message: 'You need to agree to the Terms of Service to create an account.' }),
    termsVersion: z.string().max(40),
    optional: z
      .object({ location: z.boolean(), history: z.boolean(), marketing: z.boolean() })
      .strict()
      .default({ location: false, history: false, marketing: false }),
  })
  .strict();

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().max(254), password: z.string().max(128) }).strict();

/** The mock program consent screen: balances are always read; history and visits are opt-in. */
export const linkSchema = z
  .object({
    shareHistory: z.boolean(),
    shareVisits: z.boolean(),
    agree: z.literal(true, { message: 'Tick the box to let Perkly read this program.' }),
  })
  .strict();

export const holdSchema = z
  .object({
    optionId: z.string().max(40),
    channel: z.enum(['online', 'in_store']),
    idempotencyKey: z.string().min(8).max(80),
  })
  .strict();

export const contextSchema = z
  .object({
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    hour: z.number().int().min(0).max(23).optional(),
    minute: z.number().int().min(0).max(59).optional(),
    weekday: z.number().int().min(0).max(6).optional(),
    source: z.enum(['simulated', 'device']).default('simulated'),
    session: z.string().max(60).default('default'),
  })
  .strict();

export const pilotSchema = z
  .object({
    message: z.string().trim().min(1, 'Type a question first.').max(1000),
    context: contextSchema.optional(),
  })
  .strict();

export const rateSchema = z.object({ rating: z.enum(['good', 'fine', 'bad']) }).strict();

export function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message && !issue.message.startsWith('Invalid') ? issue.message : 'Some of the information sent was not valid.';
}
