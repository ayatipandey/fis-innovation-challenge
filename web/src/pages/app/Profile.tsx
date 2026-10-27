import { BRANDS, CATEGORIES } from '@shared/demo-data';
import type { Activity, CategoryId, Preferences, RedemptionRecord } from '@shared/types';
import { Download, Heart, LogOut, Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { DemoTag, ErrorState, SwitchRow } from '../../components/bits';
import { Dialog } from '../../components/Dialog';
import { api } from '../../lib/api';
import { METHOD_LABEL, money, shortDate } from '../../lib/format';
import { useData } from '../../state/data';
import { useSession } from '../../state/session';
import { useToast } from '../../state/toast';
import { PaymentMethodsEditor, ProgramsList } from '../onboarding/Onboarding';

const SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'programs', label: 'Reward programs' },
  { id: 'payments', label: 'Payment methods' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'history', label: 'Reward history' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'accessibility', label: 'Accessibility' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function Profile() {
  const { section = 'account' } = useParams();
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  useEffect(() => {
    document.title = `${current.label} · Profile · Perkly`;
  }, [current]);
  return (
    <div className="page profile">
      <header className="page-head">
        <h1 className="display page-h">Profile</h1>
        <p className="page-lede">Your account, preferences and permissions. Changes apply right away.</p>
      </header>
      <div className="profile-grid">
        <nav aria-label="Profile sections" className="profile-nav">
          {SECTIONS.map((s) => (
            <NavLink key={s.id} to={`/app/profile/${s.id}`} className="profile-link">{s.label}</NavLink>
          ))}
        </nav>
        <section className="profile-body" aria-labelledby="pf-h">
          <h2 id="pf-h" className="display pf-h">{current.label}</h2>
          <SectionBody id={current.id} />
        </section>
      </div>
    </div>
  );
}

function SectionBody({ id }: { id: SectionId }) {
  switch (id) {
    case 'account':
      return <Account />;
    case 'programs':
      return (
        <>
          <p className="pf-lede">Connect the programs you belong to. Perkly reads balances and, where a brand allows it, redeems points you choose to apply.</p>
          <div className="notice"><ShieldCheck aria-hidden /><span>Simulated connections with made-up balances. A live version would use each program’s own sign-in and read-only access, and you could disconnect at any time.</span></div>
          <ProgramsList />
        </>
      );
    case 'payments':
      return (
        <>
          <p className="pf-lede">Payment methods let you pay the part of a bill your rewards don’t cover. Only demo references are stored.</p>
          <PaymentMethodsEditor />
        </>
      );
    case 'favorites':
      return <Favorites />;
    case 'history':
      return <History />;
    case 'notifications':
      return <NotificationSettings />;
    case 'privacy':
      return <Privacy />;
    case 'accessibility':
      return <AccessibilitySettings />;
  }
}

function usePrefs() {
  const { preferences, updatePreferences } = useSession();
  const toast = useToast();
  const update = (fn: (p: Preferences) => Preferences, msg = 'Saved') =>
    updatePreferences(fn).then(
      () => toast(msg),
      (e) => toast((e as Error).message, 'info'),
    );
  return { p: preferences!, update };
}

function Account() {
  const { user, signOut } = useSession();
  const { p, update } = usePrefs();
  const navigate = useNavigate();
  const [name, setName] = useState(p.displayName);
  const skipped = p.onboarding.skipped;
  return (
    <div className="pf-stack">
      <dl className="pf-dl">
        <div><dt>Email</dt><dd>{user?.isDemo ? 'Demo account (no email)' : user?.email}</dd></div>
        <div><dt>Account type</dt><dd>{user?.isDemo ? <><DemoTag>Demo account</DemoTag> Fictional data, separate from real accounts.</> : 'Personal prototype account. Offers and balances are demo data.'}</dd></div>
      </dl>
      <form
        className="pf-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          void update((x) => ({ ...x, displayName: name.trim() }), 'Name saved');
        }}
      >
        <div className="field">
          <label htmlFor="pf-name">Name used in greetings</label>
          <input id="pf-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </div>
        <button type="submit" className="btn" disabled={name.trim() === p.displayName}>Save name</button>
      </form>
      {skipped.length > 0 && (
        <div className="notice">
          <span>
            You skipped some setup steps: {skipped.join(', ')}. Finish them here in{' '}
            {skipped.includes('programs') && <Link to="/app/profile/programs">Reward programs</Link>}
            {skipped.includes('payment') && <> <Link to="/app/profile/payments">Payment methods</Link></>}
            {(skipped.includes('interests') || skipped.includes('brands')) && <> <Link to="/app/profile/favorites">Favorites</Link></>}
            {skipped.includes('notifications') && <> <Link to="/app/profile/notifications">Notifications</Link></>}
            {skipped.includes('accessibility') && <> <Link to="/app/profile/accessibility">Accessibility</Link></>}.
          </span>
        </div>
      )}
      <div>
        <button type="button" className="btn" onClick={async () => { await signOut(); navigate('/'); }}>
          <LogOut aria-hidden /> Sign out
        </button>
      </div>
    </div>
  );
}

const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Favorites() {
  const { p, update } = usePrefs();
  const d = useData();
  const saved = d.wallet.status === 'ready' ? d.wallet.data.favorites.map((id) => d.offer(id)).filter(Boolean) : [];
  return (
    <div className="pf-stack">
      <div className="pf-group">
        <h3 className="h3">Favorite categories</h3>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={p.categories.includes(c.id)} onClick={() => update((x) => ({ ...x, categories: toggleIn(x.categories, c.id as CategoryId) }))}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {p.categories.length > 0 && (
        <div className="pf-group">
          <h3 className="h3">Subcategories</h3>
          <div className="chips">
            {CATEGORIES.filter((c) => p.categories.includes(c.id)).flatMap((c) => c.subcategories).map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={p.subcategories.includes(s)} onClick={() => update((x) => ({ ...x, subcategories: toggleIn(x.subcategories, s) }))}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="pf-group">
        <h3 className="h3">Favorite brands</h3>
        <p className="hint">Fictional sample brands. None partners with Perkly.</p>
        <div className="chips">
          {BRANDS.map((b) => (
            <button key={b.id} type="button" className="chip" aria-pressed={p.favoriteBrands.includes(b.id)} onClick={() => update((x) => ({ ...x, favoriteBrands: toggleIn(x.favoriteBrands, b.id) }))}>
              {b.name}
            </button>
          ))}
        </div>
      </div>
      <div className="pf-group">
        <h3 className="h3">Saved rewards</h3>
        {saved.length === 0 ? (
          <p className="muted">Tap the heart on any reward to save it here.</p>
        ) : (
          <ul className="saved-list">
            {saved.map((o) => (
              <li key={o!.id}>
                <button type="button" className="link-btn" onClick={() => d.openReward(o!.id)}>
                  <strong>{d.brand(o!.brandId)?.name}</strong> {o!.benefit.summary}
                </button>
                <button type="button" className="fav" aria-pressed aria-label={`Remove from favorites: ${o!.headline}`} onClick={() => d.toggleFavorite(o!.id)}>
                  <Heart aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const KIND_LABEL: Record<Activity['kind'], string> = { earned: 'Earned', redeemed: 'Redeemed', cashback: 'Cashback received', expired: 'Expired', pending: 'Pending' };
const STATUS_LABEL: Record<RedemptionRecord['status'], string> = {
  completed_demo: 'Completed (demo)',
  failed_demo: 'Not completed',
  partial_failure_demo: 'Needs attention',
};

function History() {
  const d = useData();
  const [data, setData] = useState<{ redemptions: RedemptionRecord[]; activity: Activity[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Activity['kind']>('all');
  const load = () => {
    setError(null);
    api<{ redemptions: RedemptionRecord[]; activity: Activity[] }>('/me/history').then(setData).catch((e) => setError((e as Error).message));
  };
  useEffect(load, []);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <div className="skeleton" style={{ height: 300 }} />;
  const acts = data.activity.filter((a) => filter === 'all' || a.kind === filter);
  return (
    <div className="pf-stack">
      <div className="pf-group">
        <h3 className="h3">Redemptions in Perkly</h3>
        {data.redemptions.length === 0 ? (
          <p className="muted">Rewards you use with Use Reward will be listed here.</p>
        ) : (
          <ul className="history-list">
            {data.redemptions.map((r) => {
              const o = d.offer(r.offerId);
              return (
                <li key={r.id}>
                  <div>
                    <p className="hl-title">{o ? `${d.brand(o.brandId)?.name}: ${o.benefit.summary}` : r.offerId}</p>
                    <p className="hint tabular">
                      {shortDate(r.createdAt)}. Total {money(r.purchaseTotal)}
                      {r.unitsApplied ? `, ${r.unitsApplied.toLocaleString('en-US')} points (${money(r.rewardValueApplied)})` : ''}
                      {r.paymentMethod ? `, ${METHOD_LABEL[r.paymentMethod]}` : ''}.
                    </p>
                    {r.status !== 'completed_demo' && <p className="hint">{r.message}</p>}
                  </div>
                  <span className={`tag ${r.status === 'completed_demo' ? 'tag-ok' : 'tag-urgent'}`}>{STATUS_LABEL[r.status]}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="pf-group">
        <h3 className="h3">Activity</h3>
        <div className="chips-scroll" role="group" aria-label="Filter activity">
          {(['all', 'earned', 'redeemed', 'cashback', 'expired', 'pending'] as const).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {k === 'all' ? 'All' : KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {acts.length === 0 ? (
          <p className="muted">Nothing here yet.</p>
        ) : (
          <ul className="activity-list wide">
            {acts.map((a) => (
              <li key={a.id}>
                <span className={`act-kind act-${a.kind}`}>{KIND_LABEL[a.kind]}</span>
                <span className="act-label">{a.label}</span>
                <span className="act-amt tabular">{a.amount}</span>
                <span className="act-date">{shortDate(a.date)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Demo history. No real transactions are shown.</p>
      </div>
    </div>
  );
}

const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']] as const;

function NotificationSettings() {
  const { p, update } = usePrefs();
  const n = p.notifications;
  const set = (patch: Partial<Preferences['notifications']>) => update((x) => ({ ...x, notifications: { ...x.notifications, ...patch } }));
  const [start, setStart] = useState(n.quietHours.start);
  const [end, setEnd] = useState(n.quietHours.end);
  return (
    <div className="pf-stack">
      <div className="notice"><span>Delivery isn’t connected in this prototype. Your choices are saved and used for the in-app reminders on Home.</span></div>
      <div className="switch-row">
        <div><div className="label" id="nl-l">Daily maximum</div><div className="hint">The most alerts Perkly will send in a day.</div></div>
        <div className="stepper" role="group" aria-labelledby="nl-l">
          <button type="button" className="icon-btn" aria-label="Fewer per day" disabled={n.dailyLimit === 0} onClick={() => set({ dailyLimit: n.dailyLimit - 1 })}><Minus aria-hidden /></button>
          <output className="tabular" aria-live="polite">{n.dailyLimit}</output>
          <button type="button" className="icon-btn" aria-label="More per day" disabled={n.dailyLimit === 10} onClick={() => set({ dailyLimit: n.dailyLimit + 1 })}><Plus aria-hidden /></button>
        </div>
      </div>
      <SwitchRow id="nf-exp" label="Expiration reminders" hint="Before saved or recommended rewards expire." checked={n.expirationReminders} onChange={(v) => set({ expirationReminders: v })} />
      <SwitchRow id="nf-fav" label="Favorite-brand alerts" hint="When a favorite brand has a new reward." checked={n.favoriteBrandAlerts} onChange={(v) => set({ favoriteBrandAlerts: v })} />
      <SwitchRow id="nf-rt" label="Routine-based alerts" hint="For example, coffee rewards on weekday mornings." checked={n.routineAlerts} onChange={(v) => set({ routineAlerts: v })} />
      <SwitchRow
        id="nf-loc"
        label="Location-based alerts"
        hint={p.privacy.location ? 'When you’re near a participating place.' : <>Needs location access, which is off. <Link to="/app/profile/privacy">Privacy settings</Link></>}
        checked={n.locationAlerts && p.privacy.location}
        disabled={!p.privacy.location}
        onChange={(v) => set({ locationAlerts: v })}
      />
      <div className="pf-group">
        <h3 className="h3">Categories to hear about</h3>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={n.categories.includes(c.id)} onClick={() => set({ categories: toggleIn(n.categories, c.id) })}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pf-group">
        <SwitchRow id="nf-q" label="Quiet hours" hint="No alerts between these times." checked={n.quietHours.enabled} onChange={(v) => set({ quietHours: { ...n.quietHours, enabled: v } })} />
        {n.quietHours.enabled && (
          <div className="time-row">
            <div className="field"><label htmlFor="qh-s">From</label><input id="qh-s" type="time" value={start} onChange={(e) => setStart(e.target.value)} onBlur={() => start !== n.quietHours.start && set({ quietHours: { ...n.quietHours, start } })} /></div>
            <div className="field"><label htmlFor="qh-e">Until</label><input id="qh-e" type="time" value={end} onChange={(e) => setEnd(e.target.value)} onBlur={() => end !== n.quietHours.end && set({ quietHours: { ...n.quietHours, end } })} /></div>
          </div>
        )}
      </div>
      <div className="pf-group">
        <h3 className="h3">Days</h3>
        <div className="chips">
          {DAYS.map(([id, label]) => (
            <button key={id} type="button" className="chip" aria-pressed={n.days.includes(id)} onClick={() => set({ days: toggleIn(n.days, id) })}>{label}</button>
          ))}
        </div>
      </div>
      <div className="pf-group">
        <h3 className="h3">Channels</h3>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={n.channels.includes('push')} onClick={() => set({ channels: toggleIn(n.channels, 'push') })}>Push notifications</button>
          <button type="button" className="chip" aria-pressed={n.channels.includes('email')} onClick={() => set({ channels: toggleIn(n.channels, 'email') })}>Email</button>
        </div>
      </div>
    </div>
  );
}

function Privacy() {
  const { p, update } = usePrefs();
  const { setSession } = useSession();
  const d = useData();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Preferences['privacy']>) => update((x) => ({ ...x, privacy: { ...x.privacy, ...patch } }));
  const connected = d.wallet.status === 'ready' ? d.wallet.data.programs.filter((l) => l.status === 'connected') : [];

  async function del() {
    setBusy(true);
    setErr(null);
    try {
      await api('/me/account', { method: 'DELETE', body: { confirm: typed } });
      setSession({ user: null });
      navigate('/', { replace: true });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="pf-stack">
      <SwitchRow id="pv-p" label="Personalized recommendations" hint="Use your interests, favorites and history to rank rewards. Off means rewards are ranked by expiry and value only." checked={p.privacy.personalization} onChange={(v) => set({ personalization: v })} />
      <SwitchRow id="pv-s" label="Spending data" hint="Use spending categories from connected accounts. In this prototype that’s a synthetic summary, never real transactions." checked={p.privacy.spendingData} onChange={(v) => set({ spendingData: v })} />
      <SwitchRow
        id="pv-l"
        label="Location"
        hint="Show participating places nearby. In this prototype a fixed demo location is used; your device location is never read."
        checked={p.privacy.location}
        onChange={(v) => update((x) => ({ ...x, privacy: { ...x.privacy, location: v }, notifications: { ...x.notifications, locationAlerts: v ? x.notifications.locationAlerts : false } }))}
      />
      <SwitchRow id="pv-m" label="Product news by email" hint="Occasional updates about Perkly. Never shared with brands." checked={p.privacy.marketing} onChange={(v) => set({ marketing: v })} />

      <div className="pf-group">
        <h3 className="h3">Connected account access</h3>
        {connected.length === 0 ? (
          <p className="muted">No programs are connected.</p>
        ) : (
          <ul className="plain-list">
            {connected.map((l) => <li key={l.programId}>{d.program(l.programId)?.name}: balance and redemption, simulated.</li>)}
          </ul>
        )}
        <Link to="/app/profile/programs">Manage connections</Link>
      </div>

      <div className="pf-group">
        <h3 className="h3">Your data</h3>
        <p className="hint">Perkly doesn’t sell personal spending data. Sponsored offers are labeled and never ranked higher for being sponsored.</p>
        <div className="pf-actions">
          <a className="btn" href="/api/me/export" download>
            <Download aria-hidden /> Download my data
          </a>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden /> Delete my account
          </button>
        </div>
      </div>

      <Dialog open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} labelledBy="del-h">
        <div className="consent">
          <h2 id="del-h" className="display consent-h">Delete your account?</h2>
          <p>This permanently removes your account, preferences, favorites, connections, payment references and history. It can’t be undone.</p>
          <div className="field">
            <label htmlFor="del-type">Type DELETE to confirm</label>
            <input id="del-type" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
          {err && <div className="notice notice-danger" role="alert">{err}</div>}
          <div className="consent-actions">
            <button type="button" className="btn btn-lg btn-danger" disabled={typed !== 'DELETE' || busy} onClick={del}>
              {busy && <span className="spinner" aria-hidden />}
              Delete account
            </button>
            <button type="button" className="btn btn-lg" onClick={() => setConfirmOpen(false)} disabled={busy}>Keep my account</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function AccessibilitySettings() {
  const { p, update } = usePrefs();
  const a = p.accessibility;
  const set = (patch: Partial<Preferences['accessibility']>) => update((x) => ({ ...x, accessibility: { ...x.accessibility, ...patch } }));
  return (
    <div className="pf-stack">
      <div className="switch-row">
        <div><div className="label" id="pa-ts">Text size</div><div className="hint">Reward conditions and buttons scale with it.</div></div>
        <div className="seg" role="group" aria-labelledby="pa-ts">
          {(['default', 'large', 'larger'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={a.textSize === s} onClick={() => set({ textSize: s })}>{s === 'default' ? 'Default' : s === 'large' ? 'Large' : 'Larger'}</button>
          ))}
        </div>
      </div>
      <SwitchRow id="pa-hc" label="High contrast" hint="Darker text, stronger borders and underlined links." checked={a.highContrast} onChange={(v) => set({ highContrast: v })} />
      <SwitchRow id="pa-rm" label="Reduce motion" hint="Turns off animations. Perkly also follows your device’s reduced-motion setting." checked={a.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
      <div className="pf-group">
        <h3 className="h3">Keyboard and screen readers</h3>
        <ul className="plain-list">
          <li>Every action works with a keyboard. Tab moves between controls; Escape closes the reward screen.</li>
          <li>A skip link jumps past navigation on each page.</li>
          <li>Buttons, switches and reward conditions have text labels for screen readers.</li>
        </ul>
        <Link to="/legal/accessibility">Accessibility statement</Link>
      </div>
    </div>
  );
}
