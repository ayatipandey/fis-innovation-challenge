import { buildCatalog } from '@shared/demo-data';
import { ArrowDown, Check, ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DemoTag, Logo, Mark } from '../../components/bits';
import { api } from '../../lib/api';
import { longDateline, shortDate } from '../../lib/format';
import { useSession } from '../../state/session';
import { AiDemo, ControlDemo, RedemptionDemo, SolutionDemo } from './LandingDemos';

export function Landing() {
  useEffect(() => {
    document.title = 'Perkly — All your perks. One place.';
  }, []);
  return (
    <div className="landing">
      <a className="skip-link" href="#main">Skip to content</a>
      <LandingHeader />
      <main id="main">
        <Hero />
        <Problem />
        <Solution />
        <Ai />
        <Redemption />
        <Control />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function useTryDemo() {
  const { setSession } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const s = await api<Parameters<typeof setSession>[0]>('/auth/demo', { method: 'POST' });
      setSession(s);
      navigate('/app');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { start, busy, error };
}

function LandingHeader() {
  const { user } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const links = [
    { href: '#product', label: 'Product' },
    { href: '#how', label: 'How It Works' },
    { href: '#ai', label: 'AI Recommendations' },
  ];
  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="site-header-inner">
        <Logo />
        <nav aria-label="Main" className="site-nav">
          {links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <div className="site-cta">
          {user ? (
            <Link to="/app" className="btn btn-primary">Open Perkly</Link>
          ) : (
            <>
              <Link to="/signin" className="btn btn-quiet signin-link">Sign In</Link>
              <Link to="/signup" className="btn btn-primary">Get Started</Link>
            </>
          )}
          <button type="button" className="icon-btn menu-btn" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}>
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Main">
          {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
          {!user && <Link to="/signin" onClick={() => setOpen(false)}>Sign In</Link>}
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-h">
      <div className="hero-copy">
        <h1 id="hero-h" className="display hero-h">Your rewards, finally working for you.</h1>
        <p className="hero-sub">
          Perkly finds the rewards that fit your life, explains exactly how to use them, and helps you get more value from every point, mile,
          and offer.
        </p>
        <div className="hero-ctas">
          <Link to="/signup" className="btn btn-primary btn-lg">Get Started</Link>
          <a href="#how" className="btn btn-lg">
            Explore How It Works
            <ArrowDown aria-hidden />
          </a>
        </div>
        <p className="hero-note">Student prototype. Brands, offers and balances shown are fictional demo data.</p>
      </div>
      <HeroSpread />
    </section>
  );
}

/** The app itself as the hero: a personalized Home with the reward detail laid over it. Illustration only. */
function HeroSpread() {
  const ember = buildCatalog().find((o) => o.id === 'ember-points-pay')!;
  const weekday = new Date(ember.expiresAt).toLocaleDateString('en-US', { weekday: 'long' });
  return (
    <figure className="spread" aria-label="Perkly app preview: Home shows three rewards for Maya, and the open reward explains its conditions next to the Use Reward button. Demo data.">
      <div className="spread-app" inert>
        <p className="spread-date">{longDateline()}</p>
        <p className="display spread-greet">Good morning, Maya.</p>
        <p className="spread-lede">Three rewards fit your morning. One expires on {weekday}.</p>
        <dl className="spread-balances tabular">
          <div><dt>Ember Rewards</dt><dd>140 pts</dd><dd className="sub">$28.00 value</dd></div>
          <div><dt>Greenleaf Plus</dt><dd>6,200 pts</dd><dd className="sub">$62.00 value</dd></div>
          <div><dt>Northwind Miles</dt><dd>48,500</dd><dd className="sub">Value varies</dd></div>
        </dl>
        <div className="spread-recs">
          <div className="spread-rec is-active">
            <span className="monogram sm">EO</span>
            <div>
              <p className="display">Put your Ember points toward this morning’s coffee</p>
              <p className="why">Recommended because you frequently buy coffee.</p>
            </div>
          </div>
          <div className="spread-rec">
            <span className="monogram sm">GM</span>
            <div>
              <p className="display">$10 off a grocery shop of $75 or more</p>
              <p className="why warn">Needs $75, more than your usual $48 shop.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="spread-detail" inert>
        <div className="sd-brand"><span className="monogram sm">EO</span> Ember &amp; Oak Coffee <span className="sd-exp">Expires {shortDate(ember.expiresAt)}</span></div>
        <p className="display sd-head">Put your Ember points toward this morning’s coffee</p>
        <dl className="sd-terms">
          <div><dt>What you get</dt><dd>10 points = $2.00 off any order</dd></div>
          <div><dt>What you pay</dt><dd>No minimum. The rest of your order.</dd></div>
          <div><dt>Valid</dt><dd>All cafés, in store and in the app</dd></div>
          <div><dt>Not valid</dt><dd>Merchandise, gift cards, delivery apps</dd></div>
        </dl>
        <div className="sd-split tabular">
          <div><span>Purchase total</span><span>$10.00</span></div>
          <div><span>10 points applied</span><span>−$2.00</span></div>
          <div className="t"><span>Remaining, Apple Pay</span><span>$8.00</span></div>
        </div>
        <div className="sd-use">Use Reward</div>
      </div>
      <figcaption className="spread-cap"><DemoTag>Demo data</DemoTag></figcaption>
    </figure>
  );
}

function Problem() {
  return (
    <section className="band problem" aria-labelledby="problem-h">
      <div className="wrap problem-grid">
        <h2 id="problem-h" className="display section-h">You earned the rewards. Why is using them so complicated?</h2>
        <div className="problem-list">
          <div className="problem-item">
            <h3>Rewards are scattered across programs.</h3>
            <p>Points in one app, miles in another, cashback somewhere else. Nobody keeps a single list.</p>
            <div className="frag frag-scatter tabular" aria-hidden>
              <span>Ember Rewards 140</span>
              <span>Greenleaf Plus 6,200</span>
              <span>Northwind 48,500 mi</span>
              <span>Maison Circle 220</span>
              <span>Cashback $14.60</span>
            </div>
          </div>
          <div className="problem-item">
            <h3>The terms and expiry dates are hard to find.</h3>
            <p>The rule that matters is usually in the smallest print, next to a date that has already passed.</p>
            <p className="frag frag-fine" aria-hidden>
              Valid on qualifying purchases of $75 or more excluding alcohol, tobacco, lottery, gift cards, pharmacy, delivery fees and tips.
              Not valid at Express kiosks. One per member. <mark>Offer ends Nov 2.</mark> Other restrictions may apply.
            </p>
          </div>
          <div className="problem-item">
            <h3>Too many steps between finding a reward and using it.</h3>
            <p>Find it, activate it, switch apps, copy a code, then pay. Most rewards are lost somewhere along the way.</p>
            <ol className="frag frag-steps" aria-hidden>
              <li>Open app</li><li>Search</li><li>Read terms</li><li>Activate</li><li>Switch apps</li><li>Copy code</li><li>Pay</li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function Solution() {
  return (
    <section id="product" className="band solution" aria-labelledby="solution-h">
      <div className="wrap">
        <h2 id="solution-h" className="display section-h narrow">Less searching. Better decisions. Easier redemption.</h2>
        <div className="pillars">
          <div>
            <h3>Discover</h3>
            <p>Relevant rewards from participating brands, personalized to your preferences and the way you spend.</p>
          </div>
          <div>
            <h3>Decide</h3>
            <p>AI-powered comparisons explain the value, the conditions and the limits of each reward before you commit.</p>
          </div>
          <div>
            <h3>Redeem</h3>
            <p>One clear action takes you into the supported payment or redemption flow, on the same screen.</p>
          </div>
        </div>
        <SolutionDemo />
      </div>
    </section>
  );
}

function Ai() {
  return (
    <section id="ai" className="band ai" aria-labelledby="ai-h">
      <div className="wrap">
        <div className="section-intro">
          <h2 id="ai-h" className="display section-h">The same catalog, ranked for five different people.</h2>
          <p className="section-lede">
            Pick a sample shopper. Perkly’s recommendation service ranks the demo catalog by what they actually buy, and says why each reward
            made the list. A reward that asks for more spending than usual drops down, even when its discount looks bigger.
          </p>
        </div>
        <AiDemo />
      </div>
    </section>
  );
}

function Redemption() {
  return (
    <section id="redeem" className="band redemption" aria-labelledby="redeem-h">
      <div className="wrap redemption-grid">
        <div className="section-intro sticky-intro">
          <h2 id="redeem-h" className="display section-h">Decide and redeem on one screen.</h2>
          <p className="section-lede">
            What you get, what you pay, what’s valid and what isn’t, sit right above the Use Reward button. Split a bill between points and
            money, pick how to pay the rest, and the in-store code appears only when you choose to pay in store.
          </p>
          <ul className="check-list">
            <li><Check aria-hidden /> Drag the points to split the $10.00 bill.</li>
            <li><Check aria-hidden /> Switch between Apple Pay, a saved card and paying in store.</li>
            <li><Check aria-hidden /> Use Reward runs a labeled demo. Nothing is charged.</li>
          </ul>
        </div>
        <RedemptionDemo />
      </div>
    </section>
  );
}

function Control() {
  return (
    <section className="band control" aria-labelledby="control-h">
      <div className="wrap control-grid">
        <div className="section-intro">
          <h2 id="control-h" className="display section-h">Personal, on your terms.</h2>
          <p className="section-lede">
            Perkly uses the interests and brands you choose. Spending-based picks, location and alerts are each a separate switch, and location
            is off until you turn it on. Change any of it later in Profile.
          </p>
        </div>
        <ControlDemo />
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['Set your interests and connect supported reward programs.', 'Choose categories and favorite brands, then link the programs you already belong to.'],
    ['Discover rewards that fit your spending and preferences.', 'Home shows what matters today. Explore holds everything else.'],
    ['Understand the benefit and conditions instantly.', 'Every reward shows what you get, what you pay, and what doesn’t count.'],
    ['Use the reward through a supported method.', 'Apple Pay, a saved card, points plus money, or a code in store, where the offer allows it.'],
  ];
  return (
    <section id="how" className="band how" aria-labelledby="how-h">
      <div className="wrap">
        <h2 id="how-h" className="display section-h narrow">How it works</h2>
        <ol className="how-steps">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <span className="how-n display" aria-hidden>{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FAQS: [string, string][] = [
  ['What is Perkly?', 'Perkly brings rewards from participating brands and the programs you already use into one place, explains their conditions, and helps you use them in one step where the provider supports it.'],
  ['Is Perkly a bank?', 'No. Perkly isn’t a bank, lender or card issuer. It doesn’t hold your money. Payments are processed by the payment provider you choose.'],
  ['Does Perkly issue its own points?', 'No. Perkly has no points currency. It works with the points, miles, cashback and offers you already have.'],
  ['How does AI personalize recommendations?', 'A transparent scoring service ranks rewards using only what you allow: the categories and brands you pick, spending categories if you switch them on, expiry dates, time of day, and location if you turn it on. Each recommendation says why it appears. The current version uses clear rules rather than a trained model, so it can explain every result.'],
  ['Does Perkly need access to my location?', 'No. Location is off by default. If you turn it on, Perkly can show participating places nearby. You can turn it off at any time.'],
  ['How do saved payment methods work?', 'In a live version, cards are added through a payment provider’s secure form and Perkly keeps only a token. This prototype uses demo methods like “Demo Visa ending in 4242” and never asks for real card details.'],
  ['Can I use rewards without Apple Pay?', 'Yes. Depending on the offer, you can pay with a saved card, online banking, or in store with cash or a physical card using a code.'],
  ['Does every reward support one-step redemption?', 'No. Some rewards need activation, a booking on the provider’s site, or a code at the register. Perkly tells you which steps each reward needs instead of pretending they don’t exist.'],
  ['Does Perkly store my card details?', 'No. Perkly is designed never to store card numbers or security codes. A live version would store only a payment provider’s token. This prototype stores demo references only.'],
  ['Is the current demonstration connected to real accounts?', 'No. Every brand, offer, balance and transaction is fictional. Payments, point redemptions and program connections are simulated and clearly labeled. No real money or points move.'],
];

function Faq() {
  return (
    <section className="band faq" aria-labelledby="faq-h">
      <div className="wrap faq-grid">
        <h2 id="faq-h" className="display section-h">Questions, answered plainly</h2>
        <div className="faq-list">
          {FAQS.map(([q, a]) => (
            <details key={q}>
              <summary>
                <span>{q}</span>
                <ChevronDown aria-hidden />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const demo = useTryDemo();
  return (
    <section className="final" aria-labelledby="final-h">
      <div className="wrap final-inner">
        <Mark size={44} />
        <h2 id="final-h" className="display final-h">Make more of the rewards you already have.</h2>
        <div className="hero-ctas center">
          <Link to="/signup" className="btn btn-lg btn-light">Create Your Perkly Account</Link>
          <button type="button" className="btn btn-lg btn-outline-light" onClick={demo.start} disabled={demo.busy}>
            {demo.busy && <span className="spinner" aria-hidden />}
            Try the Demo
          </button>
        </div>
        {demo.error && <p className="final-err" role="alert">{demo.error}</p>}
        <p className="final-note">The demo opens a fictional account with sample rewards. Nothing you do there is real.</p>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Logo />
          <p>All your perks. One place.</p>
          <p className="footer-small">
            A student prototype by [Group name] for [Course or competition name]. Perkly is not a registered company, a bank, or a card issuer,
            and has no partnerships with the brands shown.
          </p>
        </div>
        <nav aria-label="Legal and support" className="footer-links">
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/cookies">Cookies</Link>
          <Link to="/legal/refunds">Refunds</Link>
          <Link to="/legal/accessibility">Accessibility</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/signin">Sign In</Link>
        </nav>
      </div>
      <div className="wrap">
        <div className="footer-base">
          <span>© 2026 [Group name]. All rights reserved.</span>
          <span>Demo data throughout. Apple Pay is a trademark of Apple Inc.; it is simulated here and not affiliated.</span>
        </div>
      </div>
    </footer>
  );
}
