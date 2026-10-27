# Perkly

**All your perks. One place.** Perkly is an AI-powered reward discovery, optimization and redemption prototype. It shows the right reward, explains its conditions clearly, and lets you use it with one action, including splitting a bill between points and money.

> **Student prototype.** Every brand, offer, balance and transaction is fictional demo data. Payments, point redemptions and program connections are simulated and labeled as such. No real money or points move, and no brand shown has a partnership with Perkly.

## What's in it

- **Landing page** with live demos: switch between sample rewards, re-rank the catalog for five sample shoppers (served by the real recommendation service), and try the one-screen redemption with split payment and the in-store code.
- **Accounts**: sign up with inline validation, then a short consent step (nothing pre-ticked, with optional permissions kept separate). Also sign in, and **Try the Demo**, which opens a fresh fictional account per visitor.
- **Onboarding** in six skippable steps: interests, favorite brands, reward programs, payment methods, notifications and accessibility.
- **App**: Home, Explore, AI Copilot and Profile, with responsive layouts at mobile, tablet and desktop widths.
- **One-screen reward view**: what you get, what you pay, what's valid, what isn't, how to use it, the points + money split, how to pay the rest, an in-store code (shown only for in-store payment), and **Use Reward**.
- **Honest failure handling**: a demo scenario picker simulates a declined payment, a points outage, or points stuck on hold, with a recovery path.

## Architecture

```
web/                    React + TypeScript + Vite + React Router
server/                 Node.js + Express API: auth, sessions, preferences, catalog,
                        favorites, history, redemption orchestration
services/recommender/   Python FastAPI: ranking, explanations, eligibility,
                        points/miles value, rule-based Copilot
shared/                 Types, demo catalog, checkout maths and account rules,
                        used by both web and server so numbers never drift
```

- The browser only talks to the Node API (`/api`). The Python service is internal and can require a shared `RECOMMENDER_SERVICE_KEY`.
- If the Python service is down or slow (2.5 s timeout), the API falls back to a simpler local ranking and labels it as a backup. The Copilot reports that it's unavailable rather than inventing an answer.
- Reward redemption and payment are separate adapters (`server/src/adapters`). Only mock adapters exist. A transaction is reported complete only when every required step is confirmed; if payment fails after points are held, the points are returned, or the user is told plainly that they're still on hold and offered **Release points**.
- SQLite (built into Node 22 as `node:sqlite`) stores users, consents, sessions, preferences, favorites, demo payment references, program links, redemptions and activity. Demo accounts are flagged `is_demo` and kept separate from real sign-ups. Use a managed database such as Postgres for deployment.

### Recommendation engine

`services/recommender/app/scoring.py` is a transparent weighted rule set, not a trained model. Signals: category spend share, chosen interests, favorite brands, past use, expiry, estimated value, time-of-day routine, nearby (only with location on), and best value in a category. Penalties: a minimum spend well above the user's usual spend, no supported payment method, and undisclosed fees. Sponsorship never changes the score. The strongest signals are returned as plain-language reasons, such as "Recommended because you frequently buy coffee." The function signature is the seam for a learned model later.

Value per point or mile = (cash price avoided − additional fees) ÷ points or miles required. Missing prices produce "unknown", never a guess.

## Run it locally

Requires Node 22+ and Python 3.11+.

```bash
npm install
pip install -r services/recommender/requirements-dev.txt
cp .env.example .env        # optional for local dev
npm run dev                 # starts the AI service on :8001, the API on :4000 and the web app on :5173
```

Open http://localhost:5173. To see everything quickly, use **Try the Demo**.

Production-style run: `npm run build && npm start`. The API then serves the built app on port 4000. Serve it over HTTPS in any deployment.

## Tests

```bash
npm test
```

- API (16 tests): consent required, password policy, bcrypt hashing, HttpOnly session, auth on protected routes, the custom-header CSRF check, card numbers rejected, the $10 split ($2 in points + $8 card), rewards-only payment, payment failure returning points, partial failure plus recovery, below-minimum spend, in-store payment, provider-only rewards, fallback ranking, Copilot unavailable, data export and account deletion.
- Recommender (11 tests): relevance ranking, extra-spend penalty, expired offers excluded, location only with permission, sponsorship-neutral scores, personalization off, the value formula, unknown not counted as eligible, Copilot labels illustrative maths, and the service key.

The UI was also checked in Chromium at 390, 768 and 1440 px: there's no horizontal scroll and no console errors, and axe-core finds no WCAG 2.2 AA violations on the main pages or the reward sheet.

## Security and privacy notes

- Passwords are hashed with bcrypt (cost 12) and never logged; login timing doesn't reveal whether an account exists.
- Session tokens are random 256-bit values stored as SHA-256 hashes, in an HttpOnly, SameSite=Lax cookie that is Secure in production.
- Login and registration are rate-limited, and so is the Copilot. State-changing requests require a custom header (CSRF defense). Helmet sets a strict Content-Security-Policy.
- The API never accepts card numbers or CVVs; payment methods are demo token references only.
- Request logs record method, path, status and timing, never bodies, cookies or emails.
- No analytics, trackers or third-party embeds; fonts are self-hosted.
- Data export and account deletion are available in Profile, under Privacy.

These controls are part of the prototype's design. They don't make it production-ready or compliant with any regulation on their own.

## Before sharing: placeholders to fill in

The legal pages and footer use bracketed placeholders for your group's details:

| Placeholder | Where |
|---|---|
| `[Group name]` | Footer, Terms, Privacy, Contact |
| `[Course or competition name]` | Footer, Terms, Contact |
| `[contact email]` | Terms, Privacy, Refunds, Accessibility, Contact |
| `[Mailing address]` | Privacy, Contact |
| `[State]` | Terms (governing law) |
| `[hosting provider]` | Privacy |
| `[Date of last update]` | Legal pages |

They're defined at the top of `web/src/pages/legal/Legal.tsx` and in `SiteFooter` in `web/src/pages/landing/Landing.tsx`. The legal pages are drafts written for the United States and are not legal advice; have them reviewed before Perkly handles real users, money or data.

## Known limitations

- No live payment, Apple Pay, bank linking or loyalty-provider integrations; all are simulated.
- The Copilot is rule-based. It answers a set of reward questions and says so. An LLM could be added behind `/api/copilot` later.
- Notifications are in-app only; push and email aren't connected.
- Location is a fixed demo location; the device location is never read.
- No password reset flow.
