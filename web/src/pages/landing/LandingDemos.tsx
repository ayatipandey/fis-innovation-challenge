import { BRANDS, CATEGORIES, PERSONAS, buildCatalog, brandById } from '@shared/demo-data';
import type { CategoryId, Channel, Offer, RecommendationResult, RewardUse } from '@shared/types';
import { AlertTriangle, BellRing, Clock, Globe, MapPin, Minus, Plus, Store } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DemoTag, Switch } from '../../components/bits';
import { RewardDetail } from '../../components/RewardDetail';
import { api } from '../../lib/api';
import { expiryPhrase, money } from '../../lib/format';

const catalog = buildCatalog();
const byId = (id: string) => catalog.find((o) => o.id === id)!;

function reducedMotion() {
  return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ── Discover, decide, redeem ─────────────────────────────────────────── */

const SOLUTION_IDS = ['ember-flat-white', 'greenleaf-10-off-75', 'harvest-produce', 'northwind-fares'];
const SOLUTION_WHY: Record<string, string> = {
  'ember-flat-white': 'You buy coffee most weekday mornings, and Ember & Oak is a favorite.',
  'greenleaf-10-off-75': 'Groceries are the biggest share of your spending.',
  'harvest-produce': 'You shop for fresh produce every week.',
  'northwind-fares': 'You fly with Northwind a few times a year.',
};

export function SolutionDemo() {
  const [sel, setSel] = useState(SOLUTION_IDS[0]);
  const o = byId(sel);
  const b = brandById(o.brandId)!;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, i: number) {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + SOLUTION_IDS.length) % SOLUTION_IDS.length;
    setSel(SOLUTION_IDS[n]);
    tabRefs.current[n]?.focus();
  }

  return (
    <div className="solution-demo">
      <div className="sol-list" role="tablist" aria-label="Sample rewards" aria-orientation="vertical">
        {SOLUTION_IDS.map((id, i) => {
          const x = byId(id);
          const xb = brandById(x.brandId)!;
          return (
            <button
              key={id}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              id={`sol-tab-${id}`}
              aria-selected={sel === id}
              aria-controls="sol-panel"
              tabIndex={sel === id ? 0 : -1}
              className="sol-tab"
              onClick={() => setSel(id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span className="monogram sm" aria-hidden>{xb.monogram}</span>
              <span>
                <span className="sol-tab-brand">{xb.name}</span>
                <span className="sol-tab-head">{x.benefit.summary}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="sol-panel" role="tabpanel" id="sol-panel" aria-labelledby={`sol-tab-${sel}`} key={sel}>
        <div className="sol-panel-top">
          <span className="sol-brand">{b.name}</span>
          <DemoTag />
        </div>
        <p className="display sol-head">{o.headline}</p>
        <div className="sol-cols">
          <div>
            <h3>Discover</h3>
            <p className="sol-why">{SOLUTION_WHY[sel]}</p>
            <p className="muted">Shown to a sample shopper. Your own reasons depend on what you allow.</p>
          </div>
          <div>
            <h3>Decide</h3>
            <dl className="sol-dl">
              <div><dt>Estimated value</dt><dd>{o.valueEstimate.amount != null ? money(o.valueEstimate.amount) : 'Depends on the cash price'}</dd></div>
              <div><dt>Minimum spend</dt><dd>{o.minSpend != null ? money(o.minSpend) : 'None'}</dd></div>
              <div><dt>Not valid</dt><dd>{o.notValid.exclusions.slice(0, 2).join('; ')}</dd></div>
              <div><dt>Expiry</dt><dd>{expiryPhrase(o.expiresAt)}</dd></div>
            </dl>
          </div>
          <div>
            <h3>Redeem</h3>
            <ul className="sol-methods">
              {o.valid.channels.includes('online') && <li><Globe aria-hidden /> Online, code applied for you</li>}
              {o.valid.channels.includes('in_store') && <li><Store aria-hidden /> In store, with a QR code</li>}
            </ul>
            <p className="muted">You pay {brandById(o.brandId)?.name} directly. Perkly never handles payment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── AI at work ───────────────────────────────────────────────────────── */

/** Animates list items from their old position to their new one. */
function useFlip(keys: string[]) {
  const refs = useRef(new Map<string, HTMLElement>());
  const prev = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const motion = !reducedMotion();
    refs.current.forEach((el, k) => {
      const before = prev.current.get(k);
      const after = el.getBoundingClientRect();
      if (motion && before) {
        const dy = before.top - after.top;
        if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      } else if (motion && !before) {
        el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
      }
    });
    const next = new Map<string, DOMRect>();
    refs.current.forEach((el, k) => next.set(k, el.getBoundingClientRect()));
    prev.current = next;
  }, [keys.join('|')]);
  return (k: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(k, el);
    else refs.current.delete(k);
  };
}

type PersonaResult = RecommendationResult & { notice: string };

export function AiDemo() {
  const [pid, setPid] = useState(PERSONAS[0].id);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data?: PersonaResult; error?: string }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const persona = PERSONAS.find((p) => p.id === pid)!;

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, status: 'loading' }));
    api<PersonaResult>('/public/persona-recommendations', { method: 'POST', body: { personaId: pid }, timeoutMs: 6000 })
      .then((data) => live && setState({ status: 'ready', data }))
      .catch((e) => live && setState({ status: 'error', error: (e as Error).message }));
    return () => {
      live = false;
    };
  }, [pid, attempt]);

  const items = state.data?.items ?? [];
  const flip = useFlip(items.map((i) => i.offerId));
  const share = Object.entries(persona.spending.share).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="ai-demo">
      <div className="ai-personas" role="radiogroup" aria-label="Sample shopper">
        {PERSONAS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === pid} className="chip" onClick={() => setPid(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="ai-body">
        <aside className="ai-profile" aria-label="Sample shopper profile">
          <p className="display ai-profile-name">{persona.label}</p>
          <p>{persona.line}</p>
          <dl className="ai-share tabular">
            {share.map(([cat, v]) => (
              <div key={cat}>
                <dt>{CATEGORIES.find((c) => c.id === cat)?.label}</dt>
                <dd>
                  <span className="bar" style={{ width: `${Math.round(v * 100)}%` }} aria-hidden />
                  {Math.round(v * 100)}% of spend
                </dd>
              </div>
            ))}
          </dl>
          <p className="ai-profile-fav">Favorite brands: {persona.favoriteBrands.map((b) => brandById(b)?.name).join(', ')}</p>
          <p className="ai-disclaimer">Sample shopper with synthetic spending. Perkly is not reading your data or location.</p>
        </aside>
        <div className="ai-results" aria-live="polite" aria-busy={state.status === 'loading'}>
          {state.status === 'error' && !items.length ? (
            <div className="notice notice-danger" role="alert">
              <AlertTriangle aria-hidden />
              <div>
                <strong>The recommendation service didn’t respond.</strong> {state.error}
                <div className="notice-actions">
                  <button type="button" className="btn btn-sm" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
                </div>
              </div>
            </div>
          ) : (
            <ol className={`ai-list ${state.status === 'loading' ? 'is-loading' : ''}`}>
              {items.map((it, i) => {
                const o = byId(it.offerId);
                const b = brandById(o.brandId)!;
                return (
                  <li key={it.offerId} ref={flip(it.offerId)} className="ai-item">
                    <span className="ai-rank display" aria-label={`Rank ${i + 1}`}>{i + 1}</span>
                    <div>
                      <p className="ai-brand">{b.name}</p>
                      <p className="display ai-head">{o.headline}</p>
                      {it.reasons.slice(0, 2).map((r) => <p key={r} className="rrow-why">{r}</p>)}
                      {it.warnings[0] && <p className="rrow-warn"><AlertTriangle aria-hidden /> {it.warnings[0]}</p>}
                    </div>
                  </li>
                );
              })}
              {!items.length && state.status === 'loading' && Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="ai-item"><div className="skeleton" style={{ height: 64, width: '100%' }} /></li>
              ))}
            </ol>
          )}
          {state.data && (
            <p className="ai-engine">
              {state.data.engine === 'perkly-scorer-v1'
                ? 'Ranked live by Perkly’s rule-based scoring service.'
                : 'The scoring service is offline, so a simpler backup ranking is shown.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Redemption ───────────────────────────────────────────────────────── */

const REDEEM_IDS = ['ember-flat-white', 'greenleaf-10-off-75', 'kin-noodle-online'];

function simulateLocally(offer: Offer, channel: Channel): Promise<RewardUse> {
  const use: RewardUse = {
    id: `local-${Date.now()}`,
    offerId: offer.id,
    channel,
    createdAt: new Date().toISOString(),
    estimatedSaving: offer.valueEstimate.amount,
    status: 'reported_demo',
    isDemo: true,
  };
  return new Promise((resolve) => setTimeout(() => resolve(use), 500));
}

export function RedemptionDemo() {
  const [id, setId] = useState(REDEEM_IDS[0]);
  const offer = byId(id);
  const brand = brandById(offer.brandId)!;
  return (
    <div className="redeem-demo">
      <div className="redeem-switch">
        <span className="redeem-switch-label" id="redeem-switch-l">Try a different reward</span>
        <div className="chips" role="radiogroup" aria-labelledby="redeem-switch-l">
          {REDEEM_IDS.map((x) => (
            <button key={x} type="button" role="radio" aria-checked={x === id} className="chip" onClick={() => setId(x)}>
              {brandById(byId(x).brandId)?.name}
            </button>
          ))}
        </div>
      </div>
      <RewardDetail
        key={id}
        variant="inline"
        offer={offer}
        brand={brand}
        reasons={id === 'ember-flat-white' ? ['Recommended because you frequently buy coffee.', 'Expires soon.'] : undefined}
        onUse={(channel) => simulateLocally(offer, channel)}
      />
    </div>
  );
}

/* ── Personalization and control ──────────────────────────────────────── */

const CONTROL_CATS: CategoryId[] = ['coffee', 'groceries', 'food', 'travel', 'beauty', 'tech'];

export function ControlDemo() {
  const [cats, setCats] = useState<CategoryId[]>(['coffee', 'groceries']);
  const [brands, setBrands] = useState<string[]>(['ember-oak']);
  const [spending, setSpending] = useState(true);
  const [location, setLocation] = useState(false);
  const [expiry, setExpiry] = useState(true);
  const [limit, setLimit] = useState(2);
  const [quiet, setQuiet] = useState(true);
  const [textSize, setTextSize] = useState<'default' | 'large'>('default');

  const preview = useMemo(() => {
    const pool = catalog.filter((o) => cats.includes(o.category) || brands.includes(o.brandId));
    const ranked = [...pool].sort((a, b) => {
      const s = (o: Offer) => (brands.includes(o.brandId) ? 3 : 0) + (location && o.nearby ? 2 : 0) + (o.minSpend ? -1 : 0);
      return s(b) - s(a);
    });
    return ranked.slice(0, Math.max(0, limit));
  }, [cats, brands, location, limit]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const brandOptions = BRANDS.filter((b) => ['ember-oak', 'greenleaf', 'osteria-lume', 'maison-ambre', 'northwind', 'circuit-house'].includes(b.id));

  return (
    <div className="control-demo">
      <div className="control-panel">
        <fieldset className="control-group">
          <legend>Favorite categories</legend>
          <div className="chips">
            {CONTROL_CATS.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={cats.includes(c)} onClick={() => setCats((l) => toggle(l, c))}>
                {CATEGORIES.find((x) => x.id === c)?.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="control-group">
          <legend>Favorite brands</legend>
          <div className="chips">
            {brandOptions.map((b) => (
              <button key={b.id} type="button" className="chip" aria-pressed={brands.includes(b.id)} onClick={() => setBrands((l) => toggle(l, b.id))}>
                {b.name}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="control-switches">
          <div className="switch-row">
            <div><div className="label">Spending-based picks</div><div className="hint">Uses a summary of what you spend by category, never single purchases.</div></div>
            <Switch checked={spending} onChange={setSpending} label="Spending-based picks" />
          </div>
          <div className="switch-row">
            <div><div className="label">Nearby rewards</div><div className="hint">Off by default. Uses location only while you allow it.</div></div>
            <Switch checked={location} onChange={setLocation} label="Nearby rewards" />
          </div>
          <div className="switch-row">
            <div><div className="label">Expiration reminders</div><div className="hint">A reminder before a reward you care about runs out.</div></div>
            <Switch checked={expiry} onChange={setExpiry} label="Expiration reminders" />
          </div>
          <div className="switch-row">
            <div><div className="label">Quiet hours</div><div className="hint">No alerts from 9 pm to 8 am.</div></div>
            <Switch checked={quiet} onChange={setQuiet} label="Quiet hours" />
          </div>
          <div className="switch-row">
            <div><div className="label" id="limit-l">Alerts per day</div><div className="hint">The most Perkly will send you.</div></div>
            <div className="stepper" role="group" aria-labelledby="limit-l">
              <button type="button" className="icon-btn" aria-label="Fewer alerts" onClick={() => setLimit((n) => Math.max(0, n - 1))} disabled={limit === 0}><Minus aria-hidden /></button>
              <output className="tabular" aria-live="polite">{limit}</output>
              <button type="button" className="icon-btn" aria-label="More alerts" onClick={() => setLimit((n) => Math.min(5, n + 1))} disabled={limit === 5}><Plus aria-hidden /></button>
            </div>
          </div>
          <div className="switch-row">
            <div><div className="label" id="ts-l">Text size</div><div className="hint">Also: high contrast and reduced motion.</div></div>
            <div className="seg" role="group" aria-labelledby="ts-l">
              <button type="button" aria-pressed={textSize === 'default'} onClick={() => setTextSize('default')}>Default</button>
              <button type="button" aria-pressed={textSize === 'large'} onClick={() => setTextSize('large')}>Large</button>
            </div>
          </div>
        </div>
      </div>

      <div className={`control-preview ${textSize === 'large' ? 'is-large' : ''}`} aria-live="polite">
        <div className="preview-top">
          <span className="preview-title">Today’s alerts</span>
          <DemoTag />
        </div>
        {limit === 0 ? (
          <p className="muted">Alerts are off. Perkly will still show rewards when you open the app.</p>
        ) : preview.length === 0 ? (
          <p className="muted">Pick a category or a brand to see what Perkly would suggest.</p>
        ) : (
          <ul className="preview-list">
            {preview.map((o) => (
              <li key={o.id}>
                <BellRing aria-hidden />
                <div>
                  <p className="preview-brand">{brandById(o.brandId)?.name}</p>
                  <p className="preview-text">{o.headline}</p>
                  <p className="preview-meta">
                    {location && o.nearby ? (
                      <><MapPin aria-hidden /> {o.nearby.distanceMeters} m away (demo location)</>
                    ) : expiry ? (
                      <><Clock aria-hidden /> {expiryPhrase(o.expiresAt)}</>
                    ) : (
                      brands.includes(o.brandId) ? 'From a favorite brand' : 'Matches your interests'
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="preview-foot">
          {spending ? 'Ranked with spending categories. ' : 'Ranked by your picks only. '}
          {quiet ? 'Held until 8 am during quiet hours.' : 'Delivered any time.'}
        </p>
      </div>
    </div>
  );
}
