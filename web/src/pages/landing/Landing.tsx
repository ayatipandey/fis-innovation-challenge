import { ArrowRight, BellRing, Brain, Link2, Lock, Menu, MousePointerClick, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DemoTag, Logo, Mark } from '../../components/bits';
import { api } from '../../lib/api';
import { useSession } from '../../state/session';
import { TEAM } from '../legal/Legal';

export const PITCH = 'Other apps show you your points. Perkly spends them for you at the right moment.';

export function Landing() {
  useEffect(() => {
    document.title = 'Perkly · Use the points you already have';
  }, []);
  return (
    <div className="landing">
      <a className="skip-link" href="#main">Skip to content</a>
      <LandingHeader />
      <main id="main">
        <Hero />
        <Steps />
        <Example />
        <Privacy />
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

function TryDemo({ big }: { big?: boolean }) {
  const { start, busy, error } = useTryDemo();
  return (
    <>
      <button type="button" className={`btn btn-primary ${big ? 'btn-lg' : ''}`} onClick={start} disabled={busy}>
        {busy && <span className="spinner" aria-hidden />}
        Try the demo
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}

function LandingHeader() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const links = [
    { href: '#how', label: 'How it works' },
    { href: '#example', label: 'An example' },
    { href: '#privacy', label: 'Privacy' },
  ];
  return (
    <header className="site-header">
      <div className="site-header-inner glass">
        <Logo />
        <nav aria-label="Main" className="site-nav">
          {links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <div className="site-cta">
          {user ? (
            <Link to="/app" className="btn btn-primary">Open Perkly</Link>
          ) : (
            <>
              <Link to="/signin" className="btn btn-quiet signin-link">Sign in</Link>
              <Link to="/signup" className="btn btn-primary">Get started</Link>
            </>
          )}
          <button type="button" className="icon-btn menu-btn" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}>
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" className="mobile-nav glass" aria-label="Main">
          {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
          {!user && <Link to="/signin" onClick={() => setOpen(false)}>Sign in</Link>}
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="hero wrap" aria-labelledby="hero-h">
      <div className="hero-copy">
        <p className="eyebrow">For anyone with points they never get around to using</p>
        <h1 id="hero-h" className="display hero-h">
          Other apps show you your points. <span className="hero-accent">Perkly spends them for you at the right moment.</span>
        </h1>
        <p className="hero-sub">
          Link the coffee card, store memberships and rewards apps you already have. Perkly turns each balance into real rewards with a dollar value, and
          tells you when and where to use them, before they expire.
        </p>
        <div className="hero-ctas">
          <TryDemo big />
          <Link to="/signup" className="btn btn-lg">Create an account</Link>
        </div>
        <p className="hero-note">Student prototype. The programs, shops and balances are samples; nothing real is linked.</p>
      </div>
      <HeroPhone />
    </section>
  );
}

/** Illustration of the moment: a lock-screen notification over a balance. Described in text for screen readers. */
function HeroPhone() {
  return (
    <figure className="hero-phone" aria-label="Example: a notification says you’re 400 ft from Starmucks and have a free latte worth $5 that expires in 6 days.">
      <div className="phone" aria-hidden>
        <p className="phone-time tabular">8:10</p>
        <p className="phone-date">Tuesday</p>
        <div className="notif glass">
          <span className="notif-app"><Mark size={18} /> Perkly <span className="notif-now">now</span></span>
          <p className="notif-title">Starmucks: a free latte</p>
          <p className="notif-body">You’re 400 ft from Starmucks and have a free latte worth $5 that expires in 6 days.</p>
        </div>
        <div className="phone-card glass">
          <p className="phone-card-h">Starmucks Rewards</p>
          <p className="phone-card-n tabular">70 points</p>
          <ol className="phone-plans">
            <li><span>7 × $2 off any drink</span><strong>$14</strong></li>
            <li><span>$15 off a $20 order</span><strong>$15</strong></li>
          </ol>
          <p className="phone-card-note">Ranked first: no minimum, and your usual order is about $6.</p>
        </div>
      </div>
      <figcaption className="visually-hidden">Illustration with sample data.</figcaption>
    </figure>
  );
}

const STEPS = [
  { icon: Link2, title: 'Link, read-only', body: 'Connect the programs you have. Perkly reads balances, expiry dates and, if you allow it, purchase history. It never issues or holds points. Samples here; in real life, through each bank’s or brand’s API.' },
  { icon: Sparkles, title: 'Turn points into rewards', body: '600 Chick-fil-B points cover a free sandwich. 500 Sephorra points cover $10 off. Perkly ranks every way to spend a balance by what you actually get.' },
  { icon: BellRing, title: 'Pick the moment', body: 'A moment engine weighs where you are, the time of day, your habits and what’s about to expire, then decides whether a notification is worth sending.' },
  { icon: MousePointerClick, title: 'Redeem in one tap', body: 'Show a code in store or jump to the seller’s site with the points applied. Points stay on hold for 2 hours until the purchase is confirmed, so they can’t be spent twice.' },
  { icon: Brain, title: 'Learn and prove it', body: 'Rate a notification Good, Fine or Bad and the next one changes. An uplift model only notifies people it would actually change, and a 10% control group measures the lift.' },
];

function Steps() {
  return (
    <section id="how" className="wrap section" aria-labelledby="how-h">
      <h2 id="how-h" className="display section-h">How it works</h2>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="step glass">
            <span className="step-n tabular" aria-hidden>{i + 1}</span>
            <s.icon aria-hidden className="step-icon" />
            <h3 className="step-h">{s.title}</h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Example() {
  return (
    <section id="example" className="wrap section example" aria-labelledby="ex-h">
      <div className="example-copy">
        <h2 id="ex-h" className="display section-h">70 coffee points. Two ways to spend them.</h2>
        <p>
          The $15 reward looks bigger. But it needs a $20 order, and you usually spend about $6. Seven $2-off drinks give you $14 with nothing extra
          to buy, so Perkly ranks them first and says why.
        </p>
        <DemoTag>Sample program</DemoTag>
      </div>
      <div className="compare">
        <div className="compare-card glass is-best">
          <p className="compare-tag">Ranked first</p>
          <p className="compare-h">7 × $2 off any drink</p>
          <p className="compare-n display tabular">$14</p>
          <ul>
            <li>No minimum spend</li>
            <li>Fits your 5 coffees a week</li>
            <li>Uses the 30 points that expire in 6 days</li>
          </ul>
        </div>
        <div className="compare-card glass">
          <p className="compare-tag">Option 2</p>
          <p className="compare-h">$15 off a $20 order</p>
          <p className="compare-n display tabular">$15</p>
          <ul>
            <li>Needs about $14 more than you usually spend</li>
            <li>One visit</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section id="privacy" className="wrap section privacy" aria-labelledby="pv-h">
      <div className="privacy-inner glass">
        <Lock aria-hidden className="privacy-icon" />
        <div>
          <h2 id="pv-h" className="display section-h">Read-only, and your call</h2>
          <ul className="privacy-list">
            <li>Each program shows its own consent screen. You pick what it shares.</li>
            <li>No card numbers, passwords or PINs. Perkly can’t move money or spend points without your tap.</li>
            <li>Location is optional, checked while the app is open, and not stored.</li>
            <li>A daily limit and quiet hours you set. Unlink a program and its data is deleted.</li>
          </ul>
          <Link to="/legal/privacy" className="link-more">Read the privacy policy <ArrowRight aria-hidden /></Link>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="wrap section final" aria-labelledby="final-h">
      <h2 id="final-h" className="display final-h">See it with a sample member.</h2>
      <p>John Doe has a coffee card, Chick-fil-B and Sephorra points, a bookstore membership, grocery points and cinema stars. Walk through his workday near the FIS office.</p>
      <div className="hero-ctas">
        <TryDemo big />
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
          <p className="footer-pitch">{PITCH}</p>
          <p className="footer-small">
            A student prototype by {TEAM.join(', ')}. Perkly is not a registered company and has no partnerships with the sample programs shown.
          </p>
        </div>
        <nav aria-label="Legal and support" className="footer-links">
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/cookies">Cookies</Link>
          <Link to="/legal/refunds">Refunds</Link>
          <Link to="/legal/accessibility">Accessibility</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/signin">Sign in</Link>
        </nav>
      </div>
      <div className="wrap">
        <div className="footer-base">
          <span>© 2026 The Perkly team</span>
          <span>Web preview of the Perkly phone app. Sample data throughout.</span>
        </div>
      </div>
    </footer>
  );
}
