import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Logo } from '../../components/bits';
import { SiteFooter } from '../landing/Landing';

// Placeholders the project group fills in before sharing the prototype.
const ORG = '[Group name]';
const EMAIL = '[contact email]';
const ADDRESS = '[Mailing address]';
const PROGRAM = '[Course or competition name]';
const STATE = '[State]';
const UPDATED = '[Date of last update]';

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
          Perkly is a student prototype built by {ORG} for {PROGRAM}. It is not a registered company. Perkly is designed as a free membership:
          partner brands offer rewards to Perkly members. Perkly is not a bank or card issuer, doesn’t process payments, and doesn’t issue
          points.
        </p>
        <h2>What the prototype does</h2>
        <p>
          Perkly shows sample partner rewards, explains their conditions and simulates using them. All partner brands, rewards, savings and
          purchase reports are fictional demo data. Perkly has no real brand partnerships.
        </p>
        <h2>Using rewards and buying from partners</h2>
        <p>
          When you use a reward, you buy from the partner brand, on its site or in its store, and you pay the brand directly. The brand is the
          seller and its own terms apply to your purchase. Rewards are subject to the conditions shown in Perkly and the brand’s terms. In the
          prototype, partner sites and purchases are simulated; nothing is bought and no code works at a real store.
        </p>
        <h2>How Perkly is paid</h2>
        <p>
          Partner brands may pay Perkly a commission or fee when members use their rewards. This never changes how rewards are ranked for you,
          and paid placements are labeled “Sponsored”.
        </p>
        <h2>Your account</h2>
        <ul>
          <li>You need to be at least 18 to create an account.</li>
          <li>Keep your password private. You’re responsible for activity under your account.</li>
          <li>You can delete your account at any time in Profile, under Privacy.</li>
        </ul>
        <h2>Acceptable use</h2>
        <p>Don’t try to break, overload, reverse-engineer or gain unauthorized access to the prototype, and don’t use it to harm others.</p>
        <h2>Recommendations and estimates</h2>
        <p>
          Recommendations and value estimates are produced by rules applied to demo data. They’re illustrations, not financial advice, and may be
          wrong. Always check a provider’s own terms before relying on an offer.
        </p>
        <h2>Availability</h2>
        <p>The prototype may change, break or be taken offline at any time, and data may be reset without notice.</p>
        <h2>Limitation of liability</h2>
        <p>
          The prototype is provided “as is”, without warranties of any kind. To the extent the law allows, {ORG} isn’t liable for any loss arising
          from its use.
        </p>
        <h2>Governing law</h2>
        <p>These terms are governed by the laws of {STATE}, United States, without regard to conflict-of-law rules.</p>
        <h2>Contact</h2>
        <p>Questions about these terms: {EMAIL}.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    lede: 'What Perkly collects, why, and the choices you have.',
    body: (
      <>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account:</strong> your email address and a password, stored only as a bcrypt hash.</li>
          <li><strong>Consent record:</strong> which version of these terms you accepted, when, and your optional choices.</li>
          <li><strong>Preferences you choose:</strong> name for greetings (optional), categories, favorite brands, notification and accessibility settings.</li>
          <li><strong>Activity in the prototype:</strong> favorites, rewards viewed, and rewards you used (reported by partners, simulated in the prototype).</li>
        </ul>
        <p>We don’t ask for your birthday, phone number, home address, or any payment details. Payment happens on partner brands’ own sites and registers.</p>
        <h2>Spending data and location</h2>
        <p>
          Both are off unless you turn them on. In this prototype, “spending data” is a synthetic summary, not your real transactions, and
          “location” is a fixed demo location; your device’s location is never read.
        </p>
        <h2>How we use it</h2>
        <ul>
          <li>To run your account and keep you signed in.</li>
          <li>To rank and explain rewards, using only the signals you’ve allowed.</li>
          <li>To show reminders inside the app according to your notification settings.</li>
        </ul>
        <h2>What we don’t do</h2>
        <ul>
          <li>We don’t sell or share your personal information for money or for cross-context advertising.</li>
          <li>When a partner reports that you used a reward, it tells us which reward and roughly what it was worth, so we can show your history. We don’t receive your card details.</li>
          <li>We don’t use third-party analytics, advertising trackers or embedded social widgets.</li>
          <li>Sponsored offers are labeled, and sponsorship never raises a reward’s ranking.</li>
        </ul>
        <h2>Service providers</h2>
        <p>
          The prototype runs on [hosting provider]. Fonts are served from our own server. When you follow a link to a partner brand’s site, that
          brand’s own privacy policy and cookies apply there, including any it uses to record that you arrived from Perkly.
        </p>
        <h2>Your rights</h2>
        <p>
          Wherever you live in the United States, you can download your data and delete your account from Profile, under Privacy. Residents of
          states with consumer privacy laws, such as California (CCPA/CPRA), may also have the right to know, correct, delete and limit the use of
          sensitive information, and to not be discriminated against for using these rights. Email {EMAIL} to make a request; we’ll respond within
          45 days.
        </p>
        <h2>Retention and security</h2>
        <p>
          We keep account data until you delete your account. Sessions expire after 7 days. Passwords are hashed, session cookies are HttpOnly, and
          the deployed prototype should be served only over HTTPS. No system is perfectly secure, so don’t store anything sensitive in the prototype.
        </p>
        <h2>Children</h2>
        <p>Perkly isn’t meant for anyone under 18, and we don’t knowingly collect data from children under 13.</p>
        <h2>Changes and contact</h2>
        <p>We’ll update the date below when this policy changes. Contact: {EMAIL}, {ADDRESS}.</p>
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
            <tr><th scope="row">perkly_sid</th><td>Keeps you signed in. HttpOnly, SameSite=Lax, and Secure when served over HTTPS.</td><td>7 days, or until you sign out</td></tr>
          </tbody>
        </table>
        <p>This cookie is strictly necessary for signing in, so it doesn’t need consent and there’s no cookie banner.</p>
        <h2>What we don’t use</h2>
        <p>No analytics, advertising, social-media or other third-party cookies, pixels or fingerprinting on Perkly. Fonts are self-hosted, so loading a page doesn’t contact a font service.</p>
        <h2>Partner sites</h2>
        <p>When you use a reward online, you continue on the partner brand’s website. That site may set its own cookies, for example to apply your code or to record that you came from Perkly. Its cookie policy applies there.</p>
        <h2>Controlling cookies</h2>
        <p>You can delete cookies in your browser settings. If you block the session cookie, you won’t be able to sign in.</p>
      </>
    ),
  },
  refunds: {
    title: 'Refund Policy',
    lede: 'Perkly is free and never takes payment, so refunds are handled by the brand you bought from.',
    body: (
      <>
        <h2>Membership</h2>
        <p>Perkly membership is free, so there is nothing for Perkly to refund.</p>
        <h2>Purchases from partner brands</h2>
        <p>
          When you use a reward, you buy from the partner brand and pay the brand directly. The brand is the seller, so refunds, returns and
          exchanges follow that brand’s own policy. Card disputes go through your card issuer.
        </p>
        <h2>Discounts on returned items</h2>
        <p>If you return something you bought with a Perkly reward, the brand normally refunds what you actually paid, after the discount. Whether the reward can be used again is up to the brand.</p>
        <h2>Demo transactions</h2>
        <p>In the prototype, partner sites and purchases are simulated. No money is charged, so there is nothing to refund.</p>
        <h2>Questions</h2>
        <p>Email {EMAIL}.</p>
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
          <li>Text size, high-contrast and reduced-motion settings in Profile, plus support for your device’s reduced-motion setting.</li>
          <li>Full keyboard operation with visible focus, a skip link on every page, and Escape to close the reward screen.</li>
          <li>Labels for buttons, switches and form fields, and live announcements for results and errors.</li>
          <li>Reward conditions in large, plain text rather than fine print.</li>
          <li>Text colors chosen for at least 4.5:1 contrast against their backgrounds.</li>
        </ul>
        <h2>Known limitations</h2>
        <ul>
          <li>This prototype hasn’t been formally audited or tested with every screen reader.</li>
          <li>The decorative app preview on the home page is described in text rather than being interactive.</li>
        </ul>
        <h2>Feedback</h2>
        <p>If something gets in your way, email {EMAIL} and tell us the page and what happened. We aim to reply within 5 business days.</p>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    lede: 'Perkly is a student project. Here’s how to reach the team.',
    body: (
      <>
        <dl className="legal-dl">
          <div><dt>Team</dt><dd>{ORG}</dd></div>
          <div><dt>Program</dt><dd>{PROGRAM}</dd></div>
          <div><dt>Email</dt><dd>{EMAIL}</dd></div>
          <div><dt>Mailing address</dt><dd>{ADDRESS}</dd></div>
        </dl>
        <p>For privacy requests, write “Privacy request” in the subject line. For accessibility problems, include the page you were on.</p>
        <p>Perkly has no customer support line, and can’t help with accounts at the fictional brands shown in the demo.</p>
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
