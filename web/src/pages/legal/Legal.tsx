import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Logo } from '../../components/bits';
import { SiteFooter } from '../landing/Landing';

// Placeholders the project group fills in before sharing the prototype.
export const TEAM = ['Ayati', 'Pablo', 'Pedro', 'Claudia', 'Elena'];
const ORG = 'the Perkly student team';
const CONTACT = '[contact link or form]';
const PROGRAM = '[Course or competition name]';
const STATE = '[State]';
const UPDATED = '[Date of last update]';
const HOST = 'Vercel (hosting) and Turso (database)';

interface Doc {
  title: string;
  lede: string;
  body: ReactNode;
}

const DRAFT = (
  <p className="legal-draft">
    Draft for a student prototype, written for the United States. It is not legal advice and hasn’t been reviewed by a lawyer. Have it reviewed
    before Perkly handles real users, money or data.
  </p>
);

const DOCS: Record<string, Doc> = {
  terms: {
    title: 'Terms of Service',
    lede: 'The rules for using the Perkly prototype, in plain language.',
    body: (
      <>
        <h2>Who we are</h2>
        <p>
          Perkly is a student prototype built by {ORG} for {PROGRAM}. It is not a registered company, a bank or a loyalty program. Perkly links,
          read-only, to the points programs you already have and helps you use those points well. It never issues, buys, sells or holds points,
          and it doesn’t process payments.
        </p>
        <h2>What the prototype does</h2>
        <p>
          Perkly shows sample programs, balances, expiry dates and purchases, all invented. It turns a balance into ranked rewards, decides when a
          notification would help, and simulates redeeming. The programs, shops, codes and seller sites are fictional; no code works at a real
          store and nothing is charged.
        </p>
        <h2>Redeeming and holds</h2>
        <p>
          When you choose a reward, Perkly asks the program to hold the points for up to 2 hours so they can’t be spent twice. The points are used
          only when the program confirms the purchase; otherwise they come back. The program’s and seller’s own terms apply to the reward and the
          purchase.
        </p>
        <h2>Your account</h2>
        <ul>
          <li>You need to be at least 18 to create an account.</li>
          <li>Keep your password private. You’re responsible for activity under your account.</li>
          <li>You can unlink programs and delete your account at any time in Profile.</li>
        </ul>
        <h2>Acceptable use</h2>
        <p>Don’t try to break, overload, reverse-engineer or gain unauthorized access to the prototype, and don’t use it to harm others.</p>
        <h2>Suggestions and estimates</h2>
        <p>
          Suggestions come from a planner and a model trained on invented data. They’re illustrations, not financial advice, and may be wrong.
          Check a program’s own terms before relying on a reward.
        </p>
        <h2>Availability</h2>
        <p>The prototype may change, break or be taken offline at any time, and data may be reset without notice.</p>
        <h2>Limitation of liability</h2>
        <p>The prototype is provided “as is”, without warranties of any kind. To the extent the law allows, {ORG} isn’t liable for any loss arising from its use.</p>
        <h2>Governing law</h2>
        <p>These terms are governed by the laws of {STATE}, United States, without regard to conflict-of-law rules.</p>
        <h2>Contact</h2>
        <p>Questions about these terms: {CONTACT}.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    lede: 'What Perkly reads, why, and the choices you have.',
    body: (
      <>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account:</strong> your email address (used to sign in, never shown in the app), an optional first name, and a password stored only as a bcrypt hash.</li>
          <li><strong>Consent record:</strong> which version of these terms you accepted, when, and your optional choices.</li>
          <li><strong>From programs you link:</strong> balances, expiry dates and the rewards available. If you tick the box on the program’s consent screen, also purchase history (where, when, how much) for the last 90 days and store visits.</li>
          <li><strong>In the app:</strong> preferences, notifications Perkly decided to send or hold back, your Good/Fine/Bad ratings, and holds and redemptions.</li>
        </ul>
        <p>We never collect card numbers, bank passwords or PINs. Programs can’t give Perkly the ability to move money or spend points without your tap.</p>
        <h2>Location</h2>
        <p>
          Off unless you allow it. When it’s on, the app checks how far you are from shops where your points work, while the app is open. The
          location is used for that check and isn’t stored. In the prototype, “Simulate a day” uses invented positions around a demo campus.
        </p>
        <h2>How we use it</h2>
        <ul>
          <li>To show what your points are worth and rank the ways to use them.</li>
          <li>To decide when a notification would actually help, within your daily limit and quiet hours.</li>
          <li>To learn from your ratings, for example sending fewer coffee reminders in the evening.</li>
          <li>To run your account and keep you signed in.</li>
        </ul>
        <h2>What we don’t do</h2>
        <ul>
          <li>We don’t sell or share your personal information for money or for cross-context advertising.</li>
          <li>We don’t use third-party analytics, advertising trackers or embedded social widgets.</li>
          <li>Partner insights show only aggregate, invented results, never an individual member.</li>
        </ul>
        <h2>Service providers</h2>
        <p>The prototype runs on {HOST}. Fonts are served from our own server.</p>
        <h2>Your rights</h2>
        <p>
          Wherever you live in the United States, you can download your data, unlink programs and delete your account from Profile. Residents of
          states with consumer privacy laws, such as California (CCPA/CPRA), may also have the right to know, correct, delete and limit the use of
          sensitive information, and not to be discriminated against for using these rights. Contact us at {CONTACT}; we’ll respond within 45 days.
        </p>
        <h2>Retention and security</h2>
        <p>
          We keep data until you unlink a program (its data is deleted) or delete your account. Sessions expire after 7 days. Passwords are hashed,
          session cookies are HttpOnly, and the deployed prototype is served over HTTPS. Don’t store anything sensitive in the prototype.
        </p>
        <h2>Children</h2>
        <p>Perkly isn’t meant for anyone under 18, and we don’t knowingly collect data from children under 13.</p>
        <h2>Changes and contact</h2>
        <p>We’ll update the date below when this policy changes. Contact: {CONTACT}.</p>
      </>
    ),
  },
  cookies: {
    title: 'Cookies Policy',
    lede: 'Perkly uses one essential cookie and no tracking.',
    body: (
      <>
        <h2>The cookie we set</h2>
        <table className="legal-table">
          <thead><tr><th scope="col">Name</th><th scope="col">Purpose</th><th scope="col">Duration</th></tr></thead>
          <tbody>
            <tr><th scope="row">perkly_sid</th><td>Keeps you signed in. HttpOnly, SameSite=Lax, and Secure over HTTPS.</td><td>7 days, or until you sign out</td></tr>
          </tbody>
        </table>
        <p>This cookie is strictly necessary for signing in, so it doesn’t need consent and there’s no cookie banner.</p>
        <h2>Local storage</h2>
        <p>Your browser remembers your chosen theme so the page doesn’t flash on reload. It holds nothing else.</p>
        <h2>What we don’t use</h2>
        <p>No analytics, advertising, social-media or other third-party cookies, pixels or fingerprinting.</p>
        <h2>Controlling cookies</h2>
        <p>You can delete cookies in your browser settings. If you block the session cookie, you won’t be able to sign in.</p>
      </>
    ),
  },
  refunds: {
    title: 'Refund Policy',
    lede: 'Perkly is free and never takes payment.',
    body: (
      <>
        <h2>Membership</h2>
        <p>Perkly is free, so there is nothing for Perkly to refund.</p>
        <h2>Purchases and points</h2>
        <p>
          When you redeem points, you buy from the seller and the program applies your points. Refunds, returns and whether points are restored
          follow the seller’s and the program’s own policies.
        </p>
        <h2>Holds</h2>
        <p>If a purchase isn’t confirmed within 2 hours, or you cancel, the held points are released back to your balance automatically.</p>
        <h2>Demo transactions</h2>
        <p>In the prototype, seller sites and purchases are simulated. No money is charged.</p>
        <h2>Questions</h2>
        <p>Contact us at {CONTACT}.</p>
      </>
    ),
  },
  accessibility: {
    title: 'Accessibility Statement',
    lede: 'Perkly aims to be usable by everyone, including people who use assistive technology.',
    body: (
      <>
        <h2>Our target</h2>
        <p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2, level AA.</p>
        <h2>What’s built in</h2>
        <ul>
          <li>Text size, high contrast (solid panels instead of glass) and reduced motion in Profile, plus your device’s reduced-motion and reduced-transparency settings.</li>
          <li>Full keyboard operation with visible focus, a skip link on every page, and Escape to close pop-ups.</li>
          <li>Labels for buttons, switches and fields, and live announcements for notifications, holds and errors.</li>
          <li>Text colors with at least 4.5:1 contrast in every theme.</li>
        </ul>
        <h2>Known limitations</h2>
        <ul>
          <li>This prototype hasn’t been formally audited or tested with every screen reader.</li>
          <li>The chart on the partner insights page also has a table version, which is the complete source.</li>
        </ul>
        <h2>Feedback</h2>
        <p>If something gets in your way, tell us the page and what happened at {CONTACT}. We aim to reply within 5 business days.</p>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    lede: 'Perkly is a student project. Here’s who built it.',
    body: (
      <>
        <dl className="legal-dl">
          <div><dt>Team</dt><dd>{TEAM.join(', ')}</dd></div>
          <div><dt>Program</dt><dd>{PROGRAM}</dd></div>
          <div><dt>Reach us</dt><dd>{CONTACT}</dd></div>
        </dl>
        <p>For privacy requests, say “Privacy request”. For accessibility problems, include the page you were on.</p>
        <p>Perkly has no support line and can’t help with accounts at the fictional programs in the demo.</p>
      </>
    ),
  },
  'not-found': {
    title: 'Page not found',
    lede: 'This page doesn’t exist or has moved.',
    body: (
      <p>
        <Link to="/">Go to the Perkly home page</Link> or <Link to="/app">open the app</Link>.
      </p>
    ),
  },
};

export function LegalPage({ page }: { page?: string }) {
  const params = useParams();
  const key = page ?? params.page ?? 'not-found';
  const doc = DOCS[key] ?? DOCS['not-found'];
  useEffect(() => {
    document.title = `${doc.title} · Perkly`;
  }, [doc]);
  const isLegal = !['contact', 'not-found'].includes(key) && DOCS[key];
  return (
    <div className="legal">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="legal-head">
        <Logo />
        <Link to="/" className="btn btn-quiet btn-sm">Back to home</Link>
      </header>
      <main id="main" className="legal-main">
        <h1 className="display legal-h">{doc.title}</h1>
        <p className="legal-lede">{doc.lede}</p>
        {isLegal && DRAFT}
        <div className="legal-body">{doc.body}</div>
        {isLegal && <p className="legal-updated">Last updated: {UPDATED}</p>}
      </main>
      <SiteFooter />
    </div>
  );
}
