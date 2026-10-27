import { CATEGORIES } from '@shared/demo-data';
import type { CategoryId, Preferences } from '@shared/types';
import { ArrowLeft, Bell, Check, LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DemoTag, Logo, Mark, ProgramMark, SwitchRow } from '../../components/bits';
import type { ProgramsResponse } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { useSession } from '../../state/session';
import { useToast } from '../../state/toast';

const STEPS = [
  { id: 'interests', title: 'What do you usually spend on?' },
  { id: 'programs', title: 'Link the programs you already have' },
  { id: 'location', title: 'Let Perkly know when you’re close' },
  { id: 'notifications', title: 'How often should Perkly nudge you?' },
  { id: 'accessibility', title: 'Make Perkly comfortable to read' },
] as const;

const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function Onboarding() {
  const { preferences, updatePreferences } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const step = Math.min(STEPS.length - 1, Math.max(0, Number(params.get('step') ?? 0) || 0));
  const [draft, setDraft] = useState<Preferences>(preferences!);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const programs = useApi<ProgramsResponse>(step === 1 ? '/me/programs' : null);

  useEffect(() => {
    document.title = 'Set up Perkly';
  }, []);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, done]);

  const current = STEPS[step];
  const linked = programs.data?.programs.filter((p) => p.link).length ?? 0;

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
    const skipped = skip ? [...new Set([...draft.onboarding.skipped, current.id])] : draft.onboarding.skipped.filter((s) => s !== current.id);
    const last = step === STEPS.length - 1;
    const next: Preferences = { ...draft, onboarding: { completed: last, skipped } };
    setDraft(next);
    if (!(await persist(next))) return;
    if (last) setDone(true);
    else setParams({ step: String(step + 1) });
  }

  function askLocation() {
    setLocMsg(null);
    if (!('geolocation' in navigator)) {
      setLocMsg('This browser can’t share location. You can still use the simulated campus day.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setDraft((d) => ({ ...d, privacy: { ...d.privacy, location: true }, notifications: { ...d.notifications, locationAlerts: true } }));
        setLocMsg('Location is on. Perkly checks distance only while the app is open.');
      },
      () => setLocMsg('Location was blocked in the browser. You can allow it later, and the simulated day works without it.'),
      { timeout: 10000 },
    );
  }

  if (done) {
    return (
      <div className="onb onb-done">
        <div className="onb-done-inner glass panel">
          <Mark size={48} />
          <h1 className="display onb-done-h" tabIndex={-1} ref={headingRef}>
            {draft.displayName ? `You’re all set, ${draft.displayName}.` : 'You’re all set.'}
          </h1>
          <p className="onb-done-lede">
            Home shows what your points are worth and the right moment to use them. Explore ranks every way to spend each balance.
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/app', { replace: true })}>Go to Home</button>
        </div>
      </div>
    );
  }

  const n = draft.notifications;
  const a = draft.accessibility;
  return (
    <div className="onb">
      <header className="onb-head">
        <Logo to="/onboarding" label="Perkly" />
        <div className="onb-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          <span className="onb-progress-text">Step {step + 1} of {STEPS.length}</span>
          <div className="onb-bar" aria-hidden><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        </div>
      </header>
      <main className="onb-main glass panel">
        {step > 0 && (
          <button type="button" className="btn btn-quiet btn-sm onb-back" onClick={() => setParams({ step: String(step - 1) })}>
            <ArrowLeft aria-hidden /> Back
          </button>
        )}
        <h1 className="display onb-h" tabIndex={-1} ref={headingRef}>{current.title}</h1>

        {current.id === 'interests' && (
          <div className="onb-body">
            <div className="field">
              <label htmlFor="ob-name">Your first name <span className="hint">(optional)</span></label>
              <input id="ob-name" value={draft.displayName} maxLength={40} autoComplete="given-name" onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
            </div>
            <p className="onb-lede">Pick a few. It’s a starting point; the purchase history your programs share counts for more.</p>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" className="chip" aria-pressed={draft.categories.includes(c.id)} onClick={() => setDraft({ ...draft, categories: toggleIn(draft.categories, c.id as CategoryId) })}>
                  {draft.categories.includes(c.id) && <Check aria-hidden />}
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {current.id === 'programs' && (
          <div className="onb-body">
            <p className="onb-lede">
              Perkly reads your balances and expiry dates, and your purchases if you allow it. It never issues, holds or moves your points. <DemoTag>Sample programs</DemoTag>
            </p>
            <ul className="link-list">
              {programs.data?.programs.map(({ program, link }) => (
                <li key={program.id} className="link-item">
                  <ProgramMark programId={program.id} />
                  <div className="link-main">
                    <p className="prog-name">{program.name}</p>
                    <p className="hint">{program.earnRule}</p>
                  </div>
                  <div className="link-side">
                    {link ? (
                      <span className="tag tag-ok"><Check aria-hidden /> Linked · {link.balance.toLocaleString('en-US')} {program.unit}</span>
                    ) : (
                      <Link className="btn btn-sm btn-primary" to={`/connect/${program.id}?return=${encodeURIComponent('/onboarding?step=1')}`}>Link</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="hint">In real life, Link opens the bank’s or brand’s own sign-in through its API. Here it opens a sample consent screen.</p>
          </div>
        )}

        {current.id === 'location' && (
          <div className="onb-body">
            <p className="onb-lede">
              Location turns “you have a free latte” into “you’re 120 m from Campus Coffee and have a free latte that expires in 6 days.” Perkly checks distance while the app is open and doesn’t keep a record of where you’ve been.
            </p>
            <div className="onb-row">
              <button type="button" className="btn btn-primary" onClick={askLocation}><LocateFixed aria-hidden /> Allow location</button>
              {draft.privacy.location && <span className="tag tag-ok"><MapPin aria-hidden /> On</span>}
            </div>
            {locMsg && <p className="notice" role="status">{locMsg}</p>}
            <p className="hint">The sample shops sit around a demo campus, so “Simulate a day” on Home shows the engine at work wherever you are.</p>
          </div>
        )}

        {current.id === 'notifications' && (
          <div className="onb-body">
            <p className="onb-lede">Perkly only notifies you when a reminder is likely to change what you do. You set the ceiling.</p>
            <div className="switch-row">
              <div><div className="label" id="ob-nl">Most per day</div></div>
              <div className="stepper" role="group" aria-labelledby="ob-nl">
                <button type="button" className="icon-btn" aria-label="Fewer per day" disabled={n.dailyLimit === 0} onClick={() => setDraft({ ...draft, notifications: { ...n, dailyLimit: n.dailyLimit - 1 } })}><Minus aria-hidden /></button>
                <output className="tabular" aria-live="polite">{n.dailyLimit}</output>
                <button type="button" className="icon-btn" aria-label="More per day" disabled={n.dailyLimit === 10} onClick={() => setDraft({ ...draft, notifications: { ...n, dailyLimit: n.dailyLimit + 1 } })}><Plus aria-hidden /></button>
              </div>
            </div>
            <SwitchRow id="ob-q" label={`Quiet hours, ${n.quietHours.start} to ${n.quietHours.end}`} hint="Change the times in Profile." checked={n.quietHours.enabled} onChange={(v) => setDraft({ ...draft, notifications: { ...n, quietHours: { ...n.quietHours, enabled: v } } })} />
            <SwitchRow id="ob-e" label="Expiring points" hint="Let points about to expire count toward the right moment." checked={n.expirationReminders} onChange={(v) => setDraft({ ...draft, notifications: { ...n, expirationReminders: v } })} />
            <div className="switch-row">
              <div>
                <div className="label">Browser notifications</div>
                <div className="hint">{perm === 'granted' ? 'On.' : perm === 'denied' ? 'Blocked in the browser.' : perm === 'unsupported' ? 'Not supported in this browser.' : 'Shows Perkly’s notifications while this tab is open.'}</div>
              </div>
              {perm === 'default' && (
                <button type="button" className="btn btn-sm" onClick={async () => setPerm(await Notification.requestPermission())}><Bell aria-hidden /> Turn on</button>
              )}
            </div>
          </div>
        )}

        {current.id === 'accessibility' && (
          <div className="onb-body">
            <div className="switch-row">
              <div><div className="label" id="ob-ts">Text size</div></div>
              <div className="seg" role="group" aria-labelledby="ob-ts">
                {(['default', 'large', 'larger'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={a.textSize === s} onClick={() => setDraft({ ...draft, accessibility: { ...a, textSize: s } })}>{s === 'default' ? 'Default' : s === 'large' ? 'Large' : 'Larger'}</button>
                ))}
              </div>
            </div>
            <SwitchRow id="ob-hc" label="High contrast" hint="Solid panels instead of glass." checked={a.highContrast} onChange={(v) => setDraft({ ...draft, accessibility: { ...a, highContrast: v } })} />
            <SwitchRow id="ob-rm" label="Reduce motion" hint="Turns off animations." checked={a.reducedMotion} onChange={(v) => setDraft({ ...draft, accessibility: { ...a, reducedMotion: v } })} />
            <p className="hint">Themes are in Profile, under Appearance.</p>
          </div>
        )}

        <div className="onb-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => go(false)} disabled={saving}>
            {step === STEPS.length - 1 ? 'Finish' : current.id === 'programs' && linked === 0 ? 'Continue without linking' : 'Continue'}
          </button>
          {current.id !== 'programs' && (
            <button type="button" className="btn btn-quiet" onClick={() => go(true)} disabled={saving}>Skip for now</button>
          )}
        </div>
      </main>
    </div>
  );
}
