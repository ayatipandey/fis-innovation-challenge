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
          One free membership unlocks rewards from Perkly’s partner brands. Perkly picks the ones that fit your life and explains exactly how
          to use them, online or in store.
        </p>
        <div className="hero-ctas">
          <Link to="/signup" className="btn btn-primary btn-lg">Get Started</Link>
          <a href="#how" className="btn btn-lg">
            Explore How It Works
            <ArrowDown aria-hidden />
          </a>
        </div>
        <p className="hero-note">Student prototype. The partner brands and rewards shown are fictional demo data.</p>
      </div>
      <HeroSpread />
    </section>
  );
}

/** The app itself as the hero: a personalized Home with the reward detail laid over it. Illustration only. */
function HeroSpread() {
  const catalog = buildCatalog();
  const ember = catalog.find((o) => o.id === 'ember-flat-white')!;
  const thisWeek = catalog.filter((o) => (new Date(o.expiresAt).getTime() - Date.now()) / 86400_000 <= 7).length;
  const weekday = new Date(ember.expiresAt).toLocaleDateString('en-US', { weekday: 'long' });
  return (
    <figure className="spread" aria-label="Perkly app preview: Home shows partner rewards picked for Maya, and the open reward lists its conditions above the Use Reward buttons. Demo data.">
      <div className="spread-app" inert>
        <p className="spread-date">{longDateline()}</p>
        <p className="display spread-greet">Good morning, Maya.</p>
        <p className="spread-lede">Three rewards fit your morning. One expires on {weekday}.</p>
        <dl className="spread-balances tabular">
          <div><dt>Partner rewards</dt><dd>{catalog.length}</dd><dd className="sub">With your membership</dd></div>
          <div><dt>Expiring this week</dt><dd>{thisWeek}</dd><dd className="sub">Across partners</dd></div>
          <div><dt>Saved so far</dt><dd>$19.00</dd><dd className="sub">Estimated</dd></div>
        </dl>
        <div className="spread-recs">
          <div className="spread-rec is-active">
            <span className="monogram sm">EO</span>
            <div>
              <p className="display">$2 off your morning flat white</p>
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
        <p className="display sd-head">$2 off your morning flat white</p>
        <dl className="sd-terms">
          <div><dt>What you get</dt><dd>$2.00 off any handcrafted drink</dd></div>
          <div><dt>What you pay</dt><dd>Menu price minus $2.00. No minimum.</dd></div>
          <div><dt>Valid</dt><dd>All cafés and online ordering</dd></div>
          <div><dt>Not valid</dt><dd>Merchandise, gift cards, delivery apps</dd></div>
          <div><dt>How to use it</dt><dd>Online, the code is applied for you</dd></div>
          <div><dt>Combining</dt><dd>One Perkly reward per order</dd></div>
        </dl>
        <div className="sd-actions">
          <div className="sd-use">Use Reward online</div>
          <div className="sd-use sd-use-alt">Use Reward in store</div>
        </div>
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
            <h3>Good offers are scattered everywhere.</h3>
            <p>A different app for every brand, codes buried in your inbox, and deals you never hear about until they’ve ended.</p>
            <div className="frag frag-scatter tabular" aria-hidden>
              <span>Brand app</span>
              <span>Promo email</span>
              <span>Receipt coupon</span>
              <span>Loyalty card</span>
              <span>Social post</span>
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
            <p>Find it, check it, copy the code, then hope it works at checkout. Most rewards are lost somewhere along the way.</p>
            <ol className="frag frag-steps" aria-hidden>
              <li>Search</li><li>Find a code</li><li>Read terms</li><li>Check it’s still valid</li><li>Copy code</li><li>Paste at checkout</li>
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
            <p>Every partner brand’s rewards, included with one free membership and ranked for what you actually buy.</p>
          </div>
          <div>
            <h3>Decide</h3>
            <p>AI-powered comparisons explain the value, the conditions and the limits of each reward before you commit.</p>
          </div>
          <div>
            <h3>Redeem</h3>
            <p>One clear action takes you to the brand’s site with the code applied, or gives you a code to show in store.</p>
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
          <h2 id="redeem-h" className="display section-h">Every condition, before you commit.</h2>
          <p className="section-lede">
            What you get, what you pay, what’s valid and what isn’t, all in one pop-up, in plain words, with nothing in fine print. Then one
            button takes you to the brand, or gives you a code for the register.
          </p>
          <ul className="check-list">
            <li><Check aria-hidden /> Online: the brand’s site opens with your code applied.</li>
            <li><Check aria-hidden /> In store: show a QR code to the cashier.</li>
            <li><Check aria-hidden /> You pay the brand directly. Perkly never handles payment.</li>
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
            Perkly ranks partner rewards by the interests and brands you choose. Spending-based picks, location and alerts are each a separate
            switch, and location is off until you turn it on. Change any of it later in Profile.
          </p>
        </div>
        <ControlDemo />
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['Join free and tell Perkly what you’re into.', 'Pick categories and favorite brands. It takes a minute, and you can skip any of it.'],
    ['Discover partner rewards that fit you.', 'Home shows what matters today. Explore holds every reward in the network.'],
    ['Understand the benefit and conditions instantly.', 'Every reward shows what you get, what you pay, and what doesn’t count.'],
    ['Use it online or in store.', 'Go to the brand’s site with the code applied, or show a QR code at the register.'],
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
  ['What is Perkly?', 'Perkly is a free membership. Brands partner with Perkly to offer rewards to its members, and Perkly shows you the ones that fit you, with every condition explained before you use them.'],
  ['Which brands partner with Perkly?', 'In this prototype, none yet: every partner and reward shown is fictional, so you can see how the product would work. Real partners would be listed here and labeled in the app.'],
  ['How much does membership cost?', 'Nothing. Membership is free.'],
  ['How does Perkly make money?', 'Partner brands may pay Perkly a commission when a member uses a reward. That never changes how rewards are ranked, and sponsored placements are always labeled.'],
  ['Does Perkly handle my payment?', 'No. You pay the brand directly on its own site or at its register. Perkly never sees or stores your card details.'],
  ['Is Perkly a bank or a points program?', 'Neither. Perkly doesn’t hold money, issue cards, or run a points currency. It connects members with partner rewards.'],
  ['How does AI personalize recommendations?', 'A transparent scoring service ranks rewards using only what you allow: the categories and brands you pick, spending categories if you switch them on, expiry dates, time of day, and location if you turn it on. Each recommendation says why it appears. It uses clear rules rather than a trained model, so it can explain every result.'],
  ['Does Perkly need my location?', 'No. Location is off by default. If you turn it on, Perkly can point out partners nearby. You can turn it off at any time.'],
  ['How do I use a reward in store?', 'Open the reward and choose “Use Reward in store”. Perkly shows a QR code and a member code to give the cashier before you pay.'],
  ['Is the current demonstration connected to real brands?', 'No. Every partner, reward and saving is fictional, and partner sites and purchases are simulated and labeled. Nothing you do in the demo is real.'],
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
        <p className="final-note">Membership is free. The demo opens a fictional account with sample partner rewards; nothing you do there is real.</p>
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
            A student prototype by [Group name] for [Course or competition name]. Perkly is not a registered company. The partner brands shown
            are fictional; Perkly has no real brand partnerships yet. Perkly may earn a commission from partners when you use a reward.
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
          <span>Demo data throughout.</span>
        </div>
      </div>
    </footer>
  );
}
