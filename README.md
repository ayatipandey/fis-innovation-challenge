# Perkly

**All your perks. One place.** Perkly is a free membership that unlocks rewards from partner brands. An AI-powered recommendation engine picks the rewards that fit each member, every reward explains its conditions in plain language before you use it, and one button takes you to the brand's website with your code applied, or gives you a QR code to show in store.

> **Student prototype.** Every partner brand, reward and saving is fictional demo data. Partner websites and purchase reports are simulated and labeled as such. No real brand has partnered with Perkly, and nothing in the demo is real.

## How Perkly works

- **Members join free.** Membership unlocks every partner reward; there's nothing to link.
- **Brands partner with Perkly** to offer rewards to members, and may pay Perkly a commission when a reward is used. Commissions never change rankings, and sponsored placements are labeled.
- **Members pay the brand directly**, on its website or at its register. Perkly never handles payment, holds money, or issues points.
- **Partners report uses back** (in a live network, through an affiliate postback or point-of-sale integration), so members can see their history and estimated savings. In the prototype, the report is simulated.

## What's in it

- **Landing page** with live demos: switch between sample rewards, re-rank the catalog for five sample shoppers (served by the real recommendation service), and open the reward pop-up.
- **Accounts**: sign up with inline validation, then a short consent step (nothing pre-ticked, with optional permissions kept separate). Also sign in, and **Try the Demo**, which opens a fresh fictional member account per visitor.
- **Onboarding** in four skippable steps: interests, favorite partners, notifications and accessibility.
- **App**: Home (today's picks, a member summary, rewards expiring soon), Explore, AI Copilot and Profile, with responsive layouts at mobile, tablet and desktop widths.
- **Reward pop-up**: what you get, what you pay, what's valid, what isn't, and how to use it, all in plain text. It fits without scrolling on a typical laptop and scrolls on phones and with larger text. **Use Reward online** shows the hand-off to the brand's site with the code applied; **Use Reward in store** shows a QR code and member code for the cashier.

## Architecture

```
web/                    React + TypeScript + Vite + React Router
server/                 Node.js + Express API: auth, sessions, preferences, partner
                        catalog, favorites, reward uses and history
services/recommender/   Python FastAPI: ranking, explanations, rule-based Copilot
shared/                 Types, demo partner catalog and account rules, used by both
                        web and server
```

- The browser only talks to the Node API (`/api`). The Python service is internal and can require a shared `RECOMMENDER_SERVICE_KEY`.
- If the Python service is down or slow (2.5 s timeout), the API falls back to a simpler local ranking and labels it as a backup. The Copilot reports that it's unavailable rather than inventing an answer.
- Partner integrations sit behind adapters (`server/src/adapters`, `server/src/services/catalog.ts`). Only mock adapters exist: the partner catalog is synthetic, and purchase reports are simulated.
- SQLite (built into Node 22 as `node:sqlite`) stores users, consents, sessions, preferences, favorites, reward uses and activity. Demo accounts are flagged `is_demo` and kept separate from real sign-ups. Use a managed database such as Postgres for deployment.

### Recommendation engine

`services/recommender/app/scoring.py` is a transparent weighted rule set, not a trained model. Signals: category spend share, chosen interests, favorite partners, past use, expiry, estimated value, time-of-day routine, nearby (only with location on), and best value in a category. Penalties: a minimum spend well above the member's usual spend, and undisclosed fees. Sponsorship never changes the score. The strongest signals are returned as plain-language reasons, such as "Recommended because you frequently buy coffee." The function signature is the seam for a learned model later.

The Copilot (`services/recommender/app/copilot.py`) is rule-based and says so. It finds rewards by category, lists what's expiring, compares offers, checks whether a minimum spend is worth it, and works out what each reward would save on a given amount. Savings are labeled as estimates.

## Run it locally

Requires Node 22+ and Python 3.11+.

```bash
npm install
python3 -m pip install -r services/recommender/requirements-dev.txt
cp .env.example .env
npm run dev
```

`npm run dev` starts the AI service on port 8001, the API on 4000 and the web app on 5173. Copying `.env` is optional for local development.

Install the Python packages with `python3 -m pip`, not plain `pip`: the dev script runs `python3`, and on machines with more than one Python (for example Conda plus python.org), `pip` can install into a different one, which shows up as `No module named uvicorn`.

Open http://localhost:5173. To see everything quickly, use **Try the Demo**.

Production-style run: `npm run build && npm start`. The API then serves the built app on port 4000. Serve it over HTTPS in any deployment.

## Tests

```bash
npm test
```

- API (11 tests): consent required, password policy, bcrypt hashing, HttpOnly session, auth on protected routes, the custom-header CSRF check, recording a reward use with its estimated saving, refusing a channel the partner doesn't accept, unknown rewards and channels, history, fallback ranking, Copilot unavailable, data export and account deletion.
- Recommender (10 tests): relevance ranking, extra-spend penalty, expired offers excluded, location only with permission, sponsorship-neutral scores, personalization off, savings worked out for a given amount (including below the minimum), honesty about points, minimum-spend advice, and the service key.

The UI was also checked in Chromium at 390, 768 and 1440 px: there's no horizontal scroll and no console errors, the reward pop-up fits without scrolling at 1440×900, and axe-core finds no WCAG 2.2 AA violations on the main pages or the reward pop-up.

## Security and privacy notes

- Passwords are hashed with bcrypt (cost 12) and never logged; login timing doesn't reveal whether an account exists.
- Session tokens are random 256-bit values stored as SHA-256 hashes, in an HttpOnly, SameSite=Lax cookie that is Secure in production.
- Login and registration are rate-limited, and so is the Copilot. State-changing requests require a custom header (CSRF defense). Helmet sets a strict Content-Security-Policy.
- Perkly never collects payment details; members pay partner brands directly.
- Request logs record method, path, status and timing, never bodies, cookies or emails.
- No analytics, trackers or third-party embeds on Perkly; fonts are self-hosted. Partner sites have their own cookies and policies.
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

- No real partner brands, partner catalog feed, affiliate tracking or point-of-sale integrations; all are simulated.
- The Copilot is rule-based. It answers a set of reward questions and says so. A language model could be added behind `/api/copilot` later.
- Notifications are in-app only; push and email aren't connected.
- Location is a fixed demo location; the device location is never read.
- No password reset flow.
