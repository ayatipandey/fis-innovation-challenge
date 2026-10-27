import { CATEGORIES, merchantById, programById } from '@shared/demo-data';
import { THEMES } from '@shared/themes';
import type { Activity, CategoryId, Preferences, Purchase } from '@shared/types';
import { Bell, Check, Download, Link2, LogOut, Minus, Plus, RotateCcw, Trash2, Unlink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { DemoTag, ErrorState, ProgramMark, SkeletonRows, SwitchRow } from '../../components/bits';
import { Dialog } from '../../components/Dialog';
import { api } from '../../lib/api';
import { daysUntil, money, points, shortDate } from '../../lib/format';
import type { ProgramsResponse } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../state/app';
import { useSession } from '../../state/session';
import { useToast } from '../../state/toast';

const SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'programs', label: 'Linked programs' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy and data' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'history', label: 'History' },
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
        <div>
          <h1 className="display page-h">Profile</h1>
          <p className="page-lede">Your account, linked programs, look and permissions. Changes apply right away.</p>
        </div>
      </header>
      <div className="profile-grid">
        <nav aria-label="Profile sections" className="profile-nav glass">
          {SECTIONS.map((s) => (
            <NavLink key={s.id} to={`/app/profile/${s.id}`} className="profile-link">{s.label}</NavLink>
          ))}
        </nav>
        <section className="profile-body glass panel" aria-labelledby="pf-h">
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
      return <Programs />;
    case 'appearance':
      return <Appearance />;
    case 'notifications':
      return <NotificationSettings />;
    case 'privacy':
      return <Privacy />;
    case 'accessibility':
      return <AccessibilitySettings />;
    case 'history':
      return <History />;
  }
}

function usePrefs() {
  const { preferences, updatePreferences } = useSession();
  const toast = useToast();
  const { reload } = useApp();
  const update = (fn: (p: Preferences) => Preferences, msg = 'Saved') =>
    updatePreferences(fn).then(
      () => {
        toast(msg);
        void reload();
      },
      (e) => toast((e as Error).message, 'info'),
    );
  return { p: preferences!, update };
}

const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Account() {
  const { user, signOut } = useSession();
  const { p, update } = usePrefs();
  const navigate = useNavigate();
  const [name, setName] = useState(p.displayName);
  return (
    <div className="pf-stack">
      <dl className="pf-dl">
        <div><dt>Account type</dt><dd>{user?.isDemo ? <><DemoTag>Demo account</DemoTag> A fictional member, kept apart from real accounts.</> : 'Free member account. Linked programs are samples.'}</dd></div>
      </dl>
      <form
        className="pf-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          void update((x) => ({ ...x, displayName: name.trim() }), 'Name saved');
        }}
      >
        <div className="field">
          <label htmlFor="pf-name">First name, used in greetings</label>
          <input id="pf-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </div>
        <button type="submit" className="btn" disabled={name.trim() === p.displayName}>Save name</button>
      </form>
      <div className="pf-group">
        <h3 className="h3">What you’re into</h3>
        <p className="hint">Helps Perkly read your linked programs. Your purchase history counts for more.</p>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={p.categories.includes(c.id)} onClick={() => update((x) => ({ ...x, categories: toggleIn(x.categories, c.id as CategoryId) }))}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <button type="button" className="btn" onClick={async () => { await signOut(); navigate('/'); }}>
          <LogOut aria-hidden /> Sign out
        </button>
      </div>
    </div>
  );
}

function Programs() {
  const { data, error, reload } = useApi<ProgramsResponse>('/me/programs');
  const app = useApp();
  const toast = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <SkeletonRows n={4} />;

  async function unlink(id: string) {
    await api(`/me/programs/${id}`, { method: 'DELETE' });
    setConfirm(null);
    toast(`Unlinked ${programById(id)?.name}. Its data was deleted from Perkly.`);
    void reload();
    void app.reload();
  }

  return (
    <div className="pf-stack">
      <p className="notice">
        <Link2 aria-hidden />
        <span>These are sample programs. Perkly reads them, read-only: it can’t move money or spend points without your tap. In real life each one connects through the bank’s or brand’s own sign-in and API.</span>
      </p>
      <ul className="link-list">
        {data.programs.map(({ program, link }) => (
          <li key={program.id} className="link-item">
            <ProgramMark programId={program.id} />
            <div className="link-main">
              <p className="prog-name">{program.name}</p>
              <p className="hint">{program.earnRule}</p>
              {link && (
                <p className="link-shares">
                  <span><Check aria-hidden /> Balance and expiry dates</span>
                  <span className={link.shares.history ? '' : 'is-off'}>{link.shares.history ? <Check aria-hidden /> : <Minus aria-hidden />} Purchase history</span>
                  <span className={link.shares.visits ? '' : 'is-off'}>{link.shares.visits ? <Check aria-hidden /> : <Minus aria-hidden />} Store visits</span>
                </p>
              )}
            </div>
            <div className="link-side">
              {link ? (
                <>
                  <p className="tabular prog-bal"><strong>{link.balance.toLocaleString('en-US')}</strong><span>{program.unit}</span></p>
                  <div className="link-actions">
                    <Link to={`/connect/${program.id}?return=/app/profile/programs`} className="btn btn-sm">Change sharing</Link>
                    <button type="button" className="btn btn-sm btn-quiet" onClick={() => setConfirm(program.id)}><Unlink aria-hidden /> Unlink</button>
                  </div>
                </>
              ) : (
                <Link to={`/connect/${program.id}?return=/app/profile/programs`} className="btn btn-primary btn-sm">Link</Link>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} labelledBy="ul-h">
        <div className="consent">
          <h2 id="ul-h" className="display consent-h">Unlink {programById(confirm ?? '')?.name}?</h2>
          <p>Perkly deletes the balance, expiry dates and purchase history it read. Points on hold are released. Your points stay with the program.</p>
          <div className="consent-actions">
            <button type="button" className="btn btn-lg btn-danger" onClick={() => confirm && unlink(confirm)}>Unlink</button>
            <button type="button" className="btn btn-lg" onClick={() => setConfirm(null)}>Keep it linked</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function Appearance() {
  const { p, update } = usePrefs();
  return (
    <div className="pf-stack">
      <p className="hint">Every theme uses the same layout and type. High contrast in Accessibility swaps the glass for solid panels.</p>
      <div className="themes" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const on = p.theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              className="theme-card"
              onClick={() => update((x) => ({ ...x, theme: t.id }), `${t.name} theme on`)}
            >
              <span
                className="theme-swatch"
                aria-hidden
                style={{
                  background: `radial-gradient(70% 90% at 0% 0%, ${t.orbs[0]}, transparent 70%), radial-gradient(70% 90% at 100% 100%, ${t.orbs[1]}, transparent 70%), ${t.bg}`,
                }}
              >
                <span className="theme-glass" style={{ color: t.text }}>
                  <span className="theme-line" style={{ background: t.text }} />
                  <span className="theme-line short" style={{ background: t.text2 }} />
                  <span className="theme-btn" style={{ background: t.button, color: t.onButton }}>Aa</span>
                </span>
              </span>
              <span className="theme-name">{t.name}{t.id === 'fresh-green' && <span className="hint"> · default</span>}</span>
              {on && <Check aria-hidden className="theme-check" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NotificationSettings() {
  const { p, update } = usePrefs();
  const toast = useToast();
  const n = p.notifications;
  const set = (patch: Partial<Preferences['notifications']>) => update((x) => ({ ...x, notifications: { ...x.notifications, ...patch } }));
  const [start, setStart] = useState(n.quietHours.start);
  const [end, setEnd] = useState(n.quietHours.end);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  async function askPermission() {
    if (typeof Notification === 'undefined') return;
    setPerm(await Notification.requestPermission());
  }

  return (
    <div className="pf-stack">
      <div className="switch-row">
        <div>
          <div className="label">Browser notifications</div>
          <div className="hint">
            {perm === 'granted' ? 'On. Perkly can notify you while this tab is open in the background.' : perm === 'denied' ? 'Blocked in your browser settings.' : perm === 'unsupported' ? 'This browser doesn’t support them.' : 'Lets Perkly notify you while this tab is open.'}
          </div>
        </div>
        {perm === 'default' && <button type="button" className="btn btn-sm" onClick={askPermission}><Bell aria-hidden /> Turn on</button>}
      </div>
      <div className="switch-row">
        <div><div className="label" id="nl-l">Daily maximum</div><div className="hint">The most notifications Perkly sends in a day. It often sends fewer.</div></div>
        <div className="stepper" role="group" aria-labelledby="nl-l">
          <button type="button" className="icon-btn" aria-label="Fewer per day" disabled={n.dailyLimit === 0} onClick={() => set({ dailyLimit: n.dailyLimit - 1 })}><Minus aria-hidden /></button>
          <output className="tabular" aria-live="polite">{n.dailyLimit}</output>
          <button type="button" className="icon-btn" aria-label="More per day" disabled={n.dailyLimit === 10} onClick={() => set({ dailyLimit: n.dailyLimit + 1 })}><Plus aria-hidden /></button>
        </div>
      </div>
      <SwitchRow id="nf-exp" label="Expiring points" hint="Let points that are about to expire count toward the right moment." checked={n.expirationReminders} onChange={(v) => set({ expirationReminders: v })} />
      <SwitchRow
        id="nf-loc"
        label="Nearby alerts"
        hint={p.privacy.location ? 'When you’re close to a shop where your points work.' : <>Needs location, which is off. <Link to="/app/profile/privacy">Privacy settings</Link></>}
        checked={n.locationAlerts && p.privacy.location}
        disabled={!p.privacy.location}
        onChange={(v) => set({ locationAlerts: v })}
      />
      <div className="pf-group">
        <SwitchRow id="nf-q" label="Quiet hours" hint="Nothing is sent between these times." checked={n.quietHours.enabled} onChange={(v) => set({ quietHours: { ...n.quietHours, enabled: v } })} />
        {n.quietHours.enabled && (
          <div className="time-row">
            <div className="field"><label htmlFor="qh-s">From</label><input id="qh-s" type="time" value={start} onChange={(e) => setStart(e.target.value)} onBlur={() => start !== n.quietHours.start && set({ quietHours: { ...n.quietHours, start } })} /></div>
            <div className="field"><label htmlFor="qh-e">Until</label><input id="qh-e" type="time" value={end} onChange={(e) => setEnd(e.target.value)} onBlur={() => end !== n.quietHours.end && set({ quietHours: { ...n.quietHours, end } })} /></div>
          </div>
        )}
      </div>
      <div className="pf-group">
        <h3 className="h3">What Perkly learned from your ratings</h3>
        <p className="hint">Good, Fine and Bad ratings tune the model for that kind of reminder at that time of day.</p>
        <div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              await api('/me/ratings', { method: 'DELETE' });
              toast('Ratings cleared. Perkly starts fresh.');
            }}
          >
            <RotateCcw aria-hidden /> Reset ratings
          </button>
        </div>
      </div>
    </div>
  );
}

function SharedData() {
  const { data } = useApi<{ purchases: Purchase[] }>('/me/purchases');
  if (!data) return null;
  const rows = [...data.purchases].reverse().slice(0, 12);
  return (
    <div className="pf-group">
      <h3 className="h3">What your programs shared <DemoTag /></h3>
      <p className="hint tabular">{data.purchases.length} purchases from the last 90 days, synthetic. Perkly uses them to learn your habits: when you buy coffee, what you usually spend, how often you go.</p>
      {rows.length > 0 && (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Recent shared purchases">
          <table className="data-table tabular">
            <thead><tr><th scope="col">Date</th><th scope="col">Where</th><th scope="col">Amount</th><th scope="col">Shared by</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.programId}-${r.id}`}>
                  <td>{shortDate(r.at)}</td>
                  <td>{merchantById(r.merchantId)?.name}</td>
                  <td>{money(r.amount)}</td>
                  <td>{programById(r.programId)?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Privacy() {
  const { p, update } = usePrefs();
  const { setSession } = useSession();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Preferences['privacy']>) => update((x) => ({ ...x, privacy: { ...x.privacy, ...patch } }));

  async function del() {
    setBusy(true);
    setErr(null);
    try {
      await api('/me/account', { method: 'DELETE' });
      setSession({ user: null });
      navigate('/', { replace: true });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="pf-stack">
      <SwitchRow id="pv-p" label="Personalized moments" hint="Use your habits and ratings to decide when to notify you. Off means only expiry and value count." checked={p.privacy.personalization} onChange={(v) => set({ personalization: v })} />
      <SwitchRow id="pv-h" label="Use purchase history" hint="Learn from the purchases your programs share. Turn it off and Perkly ignores them." checked={p.privacy.useHistory} onChange={(v) => set({ useHistory: v })} />
      <SwitchRow
        id="pv-l"
        label="Location"
        hint="Lets Perkly check distance to shops while the app is open. Your location is used for that check and not stored."
        checked={p.privacy.location}
        onChange={(v) => update((x) => ({ ...x, privacy: { ...x.privacy, location: v }, notifications: { ...x.notifications, locationAlerts: v } }))}
      />
      <SwitchRow id="pv-m" label="Product news by email" hint="Occasional updates about Perkly. Never shared." checked={p.privacy.marketing} onChange={(v) => set({ marketing: v })} />

      <SharedData />

      <div className="pf-group">
        <h3 className="h3">Your data</h3>
        <p className="hint">Perkly doesn’t sell personal data and never stores card numbers. Programs share balances, expiry dates and, if you allow it, purchases.</p>
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
          <p>This permanently removes your account, linked programs, the data they shared, your ratings and history. It can’t be undone.</p>
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
        <div><div className="label" id="pa-ts">Text size</div><div className="hint">Everything scales with it, including reward terms.</div></div>
        <div className="seg" role="group" aria-labelledby="pa-ts">
          {(['default', 'large', 'larger'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={a.textSize === s} onClick={() => set({ textSize: s })}>{s === 'default' ? 'Default' : s === 'large' ? 'Large' : 'Larger'}</button>
          ))}
        </div>
      </div>
      <SwitchRow id="pa-hc" label="High contrast" hint="Solid panels instead of glass, darker text and firmer borders." checked={a.highContrast} onChange={(v) => set({ highContrast: v })} />
      <SwitchRow id="pa-rm" label="Reduce motion" hint="Turns off animations. Perkly also follows your device’s setting." checked={a.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
      <div className="pf-group">
        <h3 className="h3">Keyboard and screen readers</h3>
        <ul className="plain-list">
          <li>Every action works with a keyboard. Tab moves between controls; Escape closes pop-ups.</li>
          <li>A skip link jumps past navigation on each page.</li>
          <li>Notifications, holds and ratings are announced to screen readers.</li>
        </ul>
        <Link to="/legal/accessibility">Accessibility statement</Link>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<Activity['kind'], string> = { redeemed: 'Used', held: 'On hold', released: 'Released', expired: 'Hold expired', linked: 'Linked' };

function History() {
  const { data, error, reload } = useApi<{ activity: Activity[] }>('/me/activity');
  const { summary } = useApp();
  const [filter, setFilter] = useState<'all' | Activity['kind']>('all');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <SkeletonRows n={4} />;
  const acts = data.activity.filter((a) => filter === 'all' || a.kind === filter);
  const soon = summary?.programs.flatMap((p) => p.link.expiries.map((e) => ({ ...e, p: p.program }))).filter((e) => daysUntil(e.expiresAt) <= 60) ?? [];
  return (
    <div className="pf-stack">
      {soon.length > 0 && (
        <div className="pf-group">
          <h3 className="h3">Coming up</h3>
          <ul className="activity-list wide">
            {soon.map((e) => (
              <li key={`${e.p.id}-${e.expiresAt}`}>
                <span className="act-kind act-expired">Expires</span>
                <span className="act-label">{points(e.points, e.p.unit)} · {e.p.name}</span>
                <span className="act-amt tabular">in {daysUntil(e.expiresAt)} days</span>
                <span className="act-date">{shortDate(e.expiresAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="pf-group">
        <h3 className="h3">Activity</h3>
        <div className="chips-scroll" role="group" aria-label="Filter activity">
          {(['all', 'redeemed', 'held', 'released', 'linked'] as const).map((k) => (
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
        <p className="hint">Demo history. Program confirmations are simulated.</p>
      </div>
    </div>
  );
}
