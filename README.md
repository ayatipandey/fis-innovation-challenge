# Perkly

**Other apps show you your points. Perkly spends them for you at the right moment.**

Perkly links, read-only, to the points programs people already have: a bank rewards card, a coffee stamp card, a bookstore membership and so on. It never issues or holds points. It reads balances, expiry dates and (with permission) purchase history, turns each balance into specific rewards with a dollar value, and decides when a notification would actually change what the member does.

> **Student prototype.** The programs, shops, balances and purchases are invented sample data, labeled as such throughout. Brand names are parodies of real local brands (Starmucks, Chaste, Pubmix, Barns & Novel, AMZ Theatres, Chick-fil-B); only the locations are real: around the FIS office at 347 Riverside Ave (the default demo area) and the UNF campus in Jacksonville. Program sign-in screens and seller checkouts are mock pages. In real life they would connect through each bank's or brand's API. The web app is a preview of the planned phone app.

## The five steps

1. **Link, read-only.** A mock consent screen for each sample program: balance and expiry dates are always shared; purchase history and store visits are checkboxes.
2. **Turn points into rewards.** The planner (`shared/planner.ts`) ranks every way to spend a balance. For 70 Starmucks points, "7 × $2 off" ($14, no minimum) ranks above "$15 off a $20 order" when the member usually spends about $6. Score = value − 25% of the extra spend a minimum forces − $0.15 per visit − the value of points that would expire before they're used.
3. **Pick the moment.** The moment engine (`services/recommender/app/engine.py`) weighs distance, opening hours, the member's habit at this hour, visit rate, spend velocity, expiry and ratings. It respects quiet hours and a daily limit, for example "You're 400 ft from Starmucks and have a free latte worth $5 that expires in 6 days."
4. **Redeem in one tap.** Show a QR code in store, or go to the seller's (mock) site with the points applied. Points are held for 2 hours and only spent when the program confirms. Holds run in a database write transaction with an idempotency key, so the same points can't be spent twice.
5. **Learn and prove.** Good/Fine/Bad ratings feed the model ("Got it, fewer coffee reminders in the evening."). An uplift model only notifies members it would change. The partner insights page compares redemption rate against a 10% control group.

## Architecture

```
web/                    React + TypeScript + Vite: landing, app, mock program and seller pages, /insights
server/                 Node + Express API: auth, links, holds, moments, ratings, Pilot proxy
services/recommender/   Python FastAPI: uplift model, moment engine, Perkly's Pilot, insights report
shared/                 Types, sample programs and merchants, planner, habits, themes
api/                    Vercel Functions: index.ts (Express) and ai.py (FastAPI)
```

- The browser only talks to `/api`. The Node API calls the Python service at `/api/ai` on Vercel, or port 8001 locally, and can require `RECOMMENDER_SERVICE_KEY`. If the service is down, a rule-based fallback answers, labeled as such.
- The database is libSQL: a local file in development and Turso when deployed.

### The model

`services/recommender/training/train_uplift.py` generates 60,000 invented moments (90% notified, 10% control) and trains a T-learner: two logistic regressions (numpy IRLS), one per group, with uplift as the difference between them. The trained coefficients ship as JSON (`app/model/uplift_model.json`), so the service needs no numpy at runtime. On held-out data: 34.9% redemption when notified vs 23.2% control (+11.7 points); +18.0 points where the model chooses to send; 180 extra redemptions per 1,000 moments vs 117 when everyone is notified. These results come from invented data and only show that the method works.

**Perkly's Pilot** (`app/pilot.py`) answers points questions (best use, what's expiring, is a minimum worth it, what to use near me now or tonight) from the planner, expiry dates and the moment engine. No language model is connected, and the page says so.

## Run it locally

Requires Node 22+ and Python 3.11+.

```bash
npm install
python3 -m pip install -r services/recommender/requirements-dev.txt
npm run dev
```

This starts the AI service on 8001, the API on 4000 and the web app on 5173. Open http://localhost:5173 and use **Try the demo**, which opens John Doe, a fictional member. The partner insights page, at http://localhost:5173/insights, isn't linked from the site.

Retrain the model with `cd services/recommender && python3 training/train_uplift.py`.

## Deploy (Vercel, free Hobby plan)

`vercel.json` builds `web/` as static files and deploys two functions: `api/index.ts` (Express) and `api/ai.py` (FastAPI). For data that persists, add a Turso database through the Vercel Marketplace (free tier). It sets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Without Turso, the API falls back to a temporary per-instance database in `/tmp`, so accounts can disappear. Optionally set the same `RECOMMENDER_SERVICE_KEY` for both functions.

## Tests

```bash
npm test
```

- API (17): consent, password policy, bcrypt, HttpOnly sessions, CSRF header, linking with consent, plan ranking, **concurrent holds can't double-spend**, idempotent holds, confirm spends soonest-expiring points, release/expiry return points, rating effects, quiet hours, fallbacks, insights, export and delete.
- AI service (14): model/feature match, nearby + expiring sends, quiet hours, daily limit, distance gate, Bad ratings lower uplift, affordability, location off, Pilot intents, insights, routing and service key.

## Security and privacy

bcrypt passwords; random session tokens stored hashed in an HttpOnly, SameSite=Lax, Secure cookie; a custom header on every state-changing request (CSRF); rate limits; Helmet CSP; no card numbers; request logs without bodies or emails; location used per check and not stored; unlinking a program deletes its data; export and account deletion in Profile.

## Legal pages

Drafts written for the United States (governing law: Florida), for the UNF Innovation Challenge. Contact: n01511358@unf.edu. The details are set at the top of `web/src/pages/legal/Legal.tsx`. They aren't legal advice; have them reviewed before Perkly handles real users, money or data.

## Web preview vs the phone app

The web demo can't do everything the phone app will:

- Background geofenced notifications. The web checks location only while the page is open; "Simulate a day" stands in.
- Push notifications when the app is closed. The web uses browser notifications while the tab is open.
- Real program connections (OAuth or open-banking APIs) instead of mock consent pages.
- Point-of-sale confirmation of redemptions instead of "The cashier scanned it".
- Wallet passes, NFC, offline QR codes and biometric sign-in.
