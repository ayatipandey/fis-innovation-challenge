import { BRANDS, CATEGORIES, PROGRAMS, buildCatalog } from '@shared/demo-data';
import type { CategoryId, PaymentMethod, PaymentMethodKind, Preferences, ProgramLink } from '@shared/types';
import { ArrowLeft, Check, CreditCard, Landmark, Search, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DemoTag, Logo, Mark, Switch, SwitchRow } from '../../components/bits';
import { api } from '../../lib/api';
import { CATEGORY_ICON } from '../../lib/categoryIcons';
import { useSession } from '../../state/session';
import { useToast } from '../../state/toast';

const STEPS = [
  { id: 'interests', title: 'What are you into?', optional: true },
  { id: 'brands', title: 'Any favorite brands?', optional: true },
  { id: 'programs', title: 'Connect your reward programs', optional: true },
  { id: 'payment', title: 'Make paying with rewards easier', optional: true },
  { id: 'notifications', title: 'How often should Perkly nudge you?', optional: true },
  { id: 'accessibility', title: 'Make Perkly comfortable to read', optional: true },
] as const;

type StepId = (typeof STEPS)[number]['id'];
const catalog = buildCatalog();

export function Onboarding() {
  const { preferences, updatePreferences, user } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Preferences>(preferences!);
  const [skipped, setSkipped] = useState<string[]>(preferences?.onboarding.skipped ?? []);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = 'Set up Perkly';
  }, []);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, done]);

  const current = STEPS[step];

  async function persist(next: Preferences) {
    setSaving(true);
    try {
      await updatePreferences(() => next);
      return true;
    } catch (e) {
      toast((e as Error).message, 'info');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function go(skip: boolean) {
    const nextSkipped = skip ? [...new Set([...skipped, current.id])] : skipped.filter((s) => s !== current.id);
    setSkipped(nextSkipped);
    const last = step === STEPS.length - 1;
    const next: Preferences = {
      ...draft,
      onboarding: { completed: last, skipped: nextSkipped },
    };
    if (!(await persist(next))) return;
    if (last) setDone(true);
    else setStep((s) => s + 1);
  }

  if (done) {
    return (
      <div className="onb onb-done">
        <div className="onb-done-inner">
          <Mark size={48} />
          <h1 className="display onb-done-h" tabIndex={-1} ref={headingRef}>
            {draft.displayName ? `You’re all set, ${draft.displayName}.` : 'You’re all set.'}
          </h1>
          <p className="onb-done-lede">
            Home now shows the rewards that fit {draft.categories.length ? 'what you picked' : 'you'}.
            {skipped.length ? ' You can finish the steps you skipped any time in Profile.' : ''}
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/app', { replace: true })}>Go to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="onb">
      <header className="onb-head">
        <Logo to="/onboarding" label="Perkly" />
        <div className="onb-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          <span className="onb-progress-text">Step {step + 1} of {STEPS.length}</span>
          <div className="onb-bar" aria-hidden><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        </div>
        {user?.isDemo ? <DemoTag>Demo account</DemoTag> : <span />}
      </header>

      <main className="onb-main" id="main">
        <h1 className="display onb-h" tabIndex={-1} ref={headingRef}>{current.title}</h1>
        <StepBody id={current.id} draft={draft} setDraft={setDraft} />
      </main>

      <footer className="onb-foot">
        <div className="onb-foot-inner">
          {step > 0 ? (
            <button type="button" className="btn btn-quiet" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ArrowLeft aria-hidden /> Back
            </button>
          ) : <span />}
          <div className="onb-foot-right">
            {current.optional && (
              <button type="button" className="btn btn-quiet" onClick={() => go(true)} disabled={saving}>Skip for now</button>
            )}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => go(false)} disabled={saving}>
              {saving && <span className="spinner" aria-hidden />}
              {step === STEPS.length - 1 ? 'Finish' : 'Continue'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepBody({ id, draft, setDraft }: { id: StepId; draft: Preferences; setDraft: (fn: (p: Preferences) => Preferences) => void }) {
  switch (id) {
    case 'interests':
      return <Interests draft={draft} setDraft={setDraft} />;
    case 'brands':
      return <Brands draft={draft} setDraft={setDraft} />;
    case 'programs':
      return <Programs />;
    case 'payment':
      return <Payment />;
    case 'notifications':
      return <Notifications draft={draft} setDraft={setDraft} />;
    case 'accessibility':
      return <AccessibilityStep draft={draft} setDraft={setDraft} />;
  }
}

type StepProps = { draft: Preferences; setDraft: (fn: (p: Preferences) => Preferences) => void };
const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Interests({ draft, setDraft }: StepProps) {
  const selected = CATEGORIES.filter((c) => draft.categories.includes(c.id));
  return (
    <div className="onb-step">
      <p className="onb-lede">Pick as many as you like. Perkly uses these to choose what shows up first on Home.</p>
      <div className="field onb-name">
        <label htmlFor="onb-name">What should we call you? <span className="muted">Optional</span></label>
        <input id="onb-name" value={draft.displayName} maxLength={40} autoComplete="given-name" onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))} />
      </div>
      <div className="tiles" role="group" aria-label="Categories">
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c.id];
          const on = draft.categories.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`tile ${on ? 'is-on' : ''}`}
              aria-pressed={on}
              onClick={() =>
                setDraft((p) => ({
                  ...p,
                  categories: toggleIn(p.categories, c.id),
                  subcategories: on ? p.subcategories.filter((s) => !c.subcategories.includes(s)) : p.subcategories,
                }))
              }
            >
              <Icon aria-hidden />
              <span>{c.label}</span>
              <span className="tile-check" aria-hidden><Check /></span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="onb-subs">
          <h2 className="onb-subh">Narrow it down <span className="muted">Optional</span></h2>
          {selected.map((c) => (
            <div key={c.id} className="onb-subgroup">
              <span className="onb-subgroup-label">{c.label}</span>
              <div className="chips">
                {c.subcategories.map((s) => (
                  <button key={s} type="button" className="chip" aria-pressed={draft.subcategories.includes(s)} onClick={() => setDraft((p) => ({ ...p, subcategories: toggleIn(p.subcategories, s) }))}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Brands({ draft, setDraft }: StepProps) {
  const [q, setQ] = useState('');
  const cats = draft.categories.length ? draft.categories : (CATEGORIES.map((c) => c.id) as CategoryId[]);
  const groups = CATEGORIES.filter((c) => cats.includes(c.id))
    .map((c) => ({ c, brands: BRANDS.filter((b) => b.category === c.id && b.name.toLowerCase().includes(q.trim().toLowerCase())) }))
    .filter((g) => g.brands.length);
  return (
    <div className="onb-step">
      <p className="onb-lede">Rewards from favorite brands rank higher. These are fictional sample brands; none of them partners with Perkly.</p>
      <div className="field search-field">
        <label htmlFor="brand-q" className="visually-hidden">Search brands</label>
        <div className="control">
          <Search aria-hidden className="field-icon" />
          <input id="brand-q" type="search" placeholder="Search brands" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="muted">No brands match “{q}”. Try another name.</p>
      ) : (
        groups.map(({ c, brands }) => (
          <div key={c.id} className="onb-subgroup">
            <span className="onb-subgroup-label">{c.label}</span>
            <div className="brand-grid">
              {brands.map((b) => {
                const on = draft.favoriteBrands.includes(b.id);
                return (
                  <button key={b.id} type="button" className={`brand-pick ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setDraft((p) => ({ ...p, favoriteBrands: toggleIn(p.favoriteBrands, b.id) }))}>
                    <span className="monogram" aria-hidden>{b.monogram}</span>
                    <span>{b.name}</span>
                    <span className="tile-check" aria-hidden><Check /></span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function ProgramsList({ compact = false }: { compact?: boolean }) {
  const toast = useToast();
  const [links, setLinks] = useState<ProgramLink[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<ProgramLink[]>('/me/programs').then(setLinks).catch((e) => setError((e as Error).message));
  }, []);
  async function toggle(programId: string, on: boolean) {
    setBusy(programId);
    try {
      setLinks(await api<ProgramLink[]>(`/me/programs/${programId}/${on ? 'connect' : 'disconnect'}`, { method: 'POST' }));
      toast(on ? 'Demo program connected' : 'Program disconnected');
    } catch (e) {
      toast((e as Error).message, 'info');
    } finally {
      setBusy(null);
    }
  }
  if (error) return <div className="notice notice-danger" role="alert">{error}</div>;
  if (!links) return <div className="skeleton" style={{ height: 240 }} />;
  return (
    <div className={`program-list ${compact ? 'is-compact' : ''}`}>
      {PROGRAMS.map((p) => {
        const l = links.find((x) => x.programId === p.id);
        const on = l?.status === 'connected';
        return (
          <div key={p.id} className="switch-row">
            <div>
              <div className="label">{p.name}</div>
              <div className="hint">
                {on ? `Connected. Demo balance ${l!.balance.toLocaleString('en-US')} ${p.unit}.` : p.unitValueBasis}
              </div>
            </div>
            <Switch checked={on} onChange={(v) => toggle(p.id, v)} label={`Connect ${p.name}`} disabled={busy === p.id} />
          </div>
        );
      })}
    </div>
  );
}

function Programs() {
  return (
    <div className="onb-step">
      <p className="onb-lede">Connected programs show their balances on Home and let you pay with points where a brand allows it.</p>
      <div className="notice">
        <ShieldCheck aria-hidden />
        <span>
          Simulated connections. In a live version you’d sign in with each program and Perkly would receive read-only balance access. Here, no
          login happens and the balances are made up.
        </span>
      </div>
      <ProgramsList />
    </div>
  );
}

const PM_OPTIONS: { kind: Exclude<PaymentMethodKind, 'in_store'>; label: string; icon: typeof CreditCard; detail: string }[] = [
  { kind: 'apple_pay', label: 'Apple Pay', icon: Smartphone, detail: 'Simulated. A live version uses Apple’s own payment sheet.' },
  { kind: 'saved_card', label: 'Demo Visa ending in 4242', icon: CreditCard, detail: 'A test card reference. No card number is entered or stored.' },
  { kind: 'online_banking', label: 'Demo checking account', icon: Landmark, detail: 'A test bank reference for online payments.' },
];

export function PaymentMethodsEditor({ showSupport = true }: { showSupport?: boolean }) {
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    api<PaymentMethod[]>('/me/payment-methods').then(setMethods).catch(() => setMethods([]));
  }, []);
  const support = useMemo(() => {
    const count = (k: PaymentMethodKind) => catalog.filter((o) => o.redemption.methods.includes(k)).length;
    return { apple_pay: count('apple_pay'), saved_card: count('saved_card'), online_banking: count('online_banking'), in_store: count('in_store') };
  }, []);
  async function add(kind: PaymentMethodKind) {
    setBusy(kind);
    try {
      setMethods(await api<PaymentMethod[]>('/me/payment-methods', { method: 'POST', body: { kind } }));
      toast('Demo payment method added');
    } catch (e) {
      toast((e as Error).message, 'info');
    } finally {
      setBusy(null);
    }
  }
  async function remove(id: string) {
    setBusy(id);
    try {
      setMethods(await api<PaymentMethod[]>(`/me/payment-methods/${id}`, { method: 'DELETE' }));
      toast('Payment method removed');
    } finally {
      setBusy(null);
    }
  }
  async function prefer(id: string) {
    setMethods(await api<PaymentMethod[]>(`/me/payment-methods/${id}/preferred`, { method: 'POST' }));
  }
  if (!methods) return <div className="skeleton" style={{ height: 200 }} />;
  return (
    <div className="pm-list">
      {PM_OPTIONS.map((o) => {
        const m = methods.find((x) => x.kind === o.kind);
        const Icon = o.icon;
        return (
          <div key={o.kind} className={`pm-item ${m ? 'is-on' : ''}`}>
            <Icon aria-hidden />
            <div className="pm-text">
              <div className="pm-label">{m?.label ?? o.label} {m && <DemoTag>Demo</DemoTag>}</div>
              <div className="hint">{o.detail}</div>
              {showSupport && <div className="hint">Accepted by {support[o.kind]} of {catalog.length} demo offers.</div>}
            </div>
            <div className="pm-actions">
              {m ? (
                <>
                  {m.preferred ? (
                    <span className="tag tag-ok">Preferred</span>
                  ) : (
                    <button type="button" className="btn btn-sm btn-quiet" onClick={() => prefer(m.id)}>Make preferred</button>
                  )}
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(m.id)} disabled={busy === m.id}>Remove</button>
                </>
              ) : (
                <button type="button" className="btn btn-sm" onClick={() => add(o.kind)} disabled={busy === o.kind}>
                  {busy === o.kind && <span className="spinner" aria-hidden />}
                  Add
                </button>
              )}
            </div>
          </div>
        );
      })}
      {showSupport && <p className="hint pm-instore">Paying in store with cash or a physical card needs no setup. It works with {support.in_store} demo offers that give you a code.</p>}
    </div>
  );
}

function Payment() {
  return (
    <div className="onb-step">
      <p className="onb-lede">A saved method lets you split a bill between points and money on the reward screen, without switching apps.</p>
      <div className="notice">
        <ShieldCheck aria-hidden />
        <span>
          Perkly never asks for card numbers or security codes. A live version adds cards through a payment provider’s secure form and keeps only
          a token. This prototype offers demo methods only.
        </span>
      </div>
      <PaymentMethodsEditor />
    </div>
  );
}

const PRESETS: { id: Preferences['notifications']['preset']; title: string; text: string; limit: number }[] = [
  { id: 'essential', title: 'Essential reminders only', text: 'Only expiring rewards you’ve saved or connected. Up to 1 a day.', limit: 1 },
  { id: 'balanced', title: 'A balanced number of alerts', text: 'Expiring rewards plus the best new match. Up to 3 a day.', limit: 3 },
  { id: 'personalized', title: 'Personalized for my favorites', text: 'Alerts for favorite categories and brands. Up to 5 a day.', limit: 5 },
];

function Notifications({ draft, setDraft }: StepProps) {
  return (
    <div className="onb-step">
      <p className="onb-lede">Choose a starting point. Quiet hours, days, channels and location alerts are in Profile whenever you want them.</p>
      <div className="preset-list" role="radiogroup" aria-label="Notification preset">
        {PRESETS.map((p) => {
          const on = draft.notifications.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`preset ${on ? 'is-on' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, notifications: { ...d.notifications, preset: p.id, dailyLimit: p.limit, favoriteBrandAlerts: p.id !== 'essential' } }))}
            >
              <span className="preset-dot" aria-hidden />
              <span>
                <span className="preset-title">{p.title}</span>
                <span className="preset-text">{p.text}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="muted">Location-based alerts stay off. Perkly won’t ask for location unless you turn it on.</p>
    </div>
  );
}

function AccessibilityStep({ draft, setDraft }: StepProps) {
  const a = draft.accessibility;
  // Apply immediately so people can see the effect before saving.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = a.textSize;
    root.dataset.contrast = a.highContrast ? 'high' : 'default';
    root.dataset.motion = a.reducedMotion ? 'reduced' : 'default';
  }, [a]);
  const set = (patch: Partial<Preferences['accessibility']>) => setDraft((d) => ({ ...d, accessibility: { ...d.accessibility, ...patch } }));
  return (
    <div className="onb-step">
      <p className="onb-lede">These apply across Perkly straight away, and you can change them in Profile.</p>
      <div className="switch-row">
        <div><div className="label" id="ts-label">Text size</div><div className="hint">Reward conditions grow with it.</div></div>
        <div className="seg" role="group" aria-labelledby="ts-label">
          {(['default', 'large', 'larger'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={a.textSize === s} onClick={() => set({ textSize: s })}>
              {s === 'default' ? 'Default' : s === 'large' ? 'Large' : 'Larger'}
            </button>
          ))}
        </div>
      </div>
      <SwitchRow id="hc" label="High contrast" hint="Darker text and stronger borders." checked={a.highContrast} onChange={(v) => set({ highContrast: v })} />
      <SwitchRow id="rm" label="Reduce motion" hint="Turns off animations and transitions." checked={a.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
    </div>
  );
}
