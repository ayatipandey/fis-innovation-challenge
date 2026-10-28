import { CAMPUS, DAY_ROUTES, distanceM, merchantById, optionById, toCampusSpace, type DayStop } from '@shared/demo-data';
import type { Moment } from '@shared/types';
import { AlertTriangle, ArrowRight, Clock, LocateFixed, MapPin, Play, QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DemoTag, ErrorState, ProgramMark, SkeletonRows, SwitchRow } from '../../components/bits';
import { MomentCard } from '../../components/MomentCard';
import { ApiError, api, localTime, newKey } from '../../lib/api';
import { countdown, daysUntil, greeting, longDateline, money, points } from '../../lib/format';
import type { EvaluateResponse } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../state/app';
import { useSession } from '../../state/session';

/** Shows a system notification too, when the member allowed it and the tab isn't in front. */
function notifyDevice(m: Moment) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
      new Notification(m.title, { body: m.body, tag: m.id });
    }
  } catch {
    /* not supported */
  }
}

export function Home() {
  const { preferences } = useSession();
  const { summary, error, loading, reload, redeem } = useApp();
  const name = preferences?.displayName?.trim();

  useEffect(() => {
    document.title = 'Home · Perkly';
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <p className="dateline">{longDateline()}</p>
        <h1 className="page-h display">{greeting()}{name ? `, ${name}` : ''}.</h1>
      </header>

      {error && !summary && <ErrorState message={error} onRetry={reload} />}
      {loading && !summary && <SkeletonRows n={3} />}

      {summary && (
        <div className="home-grid">
          <section className="worth glass" aria-labelledby="worth-h">
            <p className="eyebrow" id="worth-h">Your points, in dollars <DemoTag /></p>
            {summary.programs.length ? (
              <>
                <p className="worth-n display tabular">{money(summary.totals.bestValue)}</p>
                <p className="worth-sub">
                  across {summary.programs.length} linked {summary.programs.length === 1 ? 'program' : 'programs'}, using each balance its best way.
                </p>
                {summary.atRisk.length > 0 && (
                  <ul className="risk-list">
                    {summary.atRisk.slice(0, 3).map((r) => {
                      const prog = summary.programs.find((p) => p.program.id === r.programId)!;
                      const d = daysUntil(r.expiresAt);
                      return (
                        <li key={`${r.programId}-${r.expiresAt}`} className={d <= 7 ? 'is-urgent' : ''}>
                          <AlertTriangle aria-hidden />
                          <span>
                            <strong>{points(r.points, prog.program.unit)}</strong> {prog.program.name} expire in {d} {d === 1 ? 'day' : 'days'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Link to="/app/explore" className="btn btn-primary">See the best ways to use them <ArrowRight aria-hidden /></Link>
              </>
            ) : (
              <div className="empty">
                <h3>Link a program to start</h3>
                <p>Perkly reads balances and expiry dates from the programs you already have. It never holds your points.</p>
                <Link to="/app/profile/programs" className="btn btn-primary">Link a program</Link>
              </div>
            )}
          </section>

          <RightNow onUse={redeem} onSent={reload} />

          {summary.holds.length > 0 && (
            <section className="glass panel" aria-labelledby="holds-h">
              <h2 className="h2" id="holds-h">On hold</h2>
              <ul className="hold-list">
                {summary.holds.map((h) => {
                  const o = optionById(h.optionId);
                  return (
                    <li key={h.id}>
                      <ProgramMark programId={h.programId} size="sm" />
                      <div>
                        <p className="hold-title">{o?.title}</p>
                        <p className="hold-meta tabular"><Clock aria-hidden /> {h.points.toLocaleString('en-US')} held · {countdown(h.expiresAt)} left</p>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => redeem(h.optionId, h)}>
                        <QrCode aria-hidden /> {h.channel === 'in_store' ? 'Show code' : 'Continue'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="glass panel programs-panel" aria-labelledby="progs-h">
            <div className="section-row">
              <h2 className="h2" id="progs-h">Linked programs</h2>
              <Link to="/app/profile/programs" className="link-more">Manage <ArrowRight aria-hidden /></Link>
            </div>
            <ul className="prog-list">
              {summary.programs.map(({ program, link, plans, nextReward }) => (
                <li key={program.id}>
                  <ProgramMark programId={program.id} />
                  <div className="prog-main">
                    <p className="prog-name">{program.name}</p>
                    <p className="prog-best">
                      {plans[0] ? <>Best use: {plans[0].label} · <strong>{money(plans[0].totalValue)}</strong></> : nextReward ? `${points(nextReward.pointsNeeded, program.unit)} to ${optionById(nextReward.optionId)?.title}` : 'No rewards yet'}
                    </p>
                  </div>
                  <div className="prog-bal tabular">
                    <strong>{link.available.toLocaleString('en-US')}</strong>
                    <span>{link.held > 0 ? `${link.held.toLocaleString('en-US')} on hold` : program.unit}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <RecentMoments onUse={redeem} />
        </div>
      )}
    </div>
  );
}

type StopResult = { stopId: string; res: EvaluateResponse };

const ANCHOR_KEY = 'perkly-anchor';
const FAR_M = 5000;
const TIMES = [
  { id: 'now', label: 'Now' },
  { id: '08:10', label: 'Morning, 8:10' },
  { id: '12:30', label: 'Lunch, 12:30' },
  { id: '15:40', label: 'Afternoon, 3:40' },
  { id: '18:30', label: 'Evening, 6:30' },
];

function readAnchor(): { lat: number; lng: number } | null {
  try {
    const v = localStorage.getItem(ANCHOR_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function writeAnchor(a: { lat: number; lng: number } | null) {
  try {
    if (a) localStorage.setItem(ANCHOR_KEY, JSON.stringify(a));
    else localStorage.removeItem(ANCHOR_KEY);
  } catch {
    /* storage blocked: the anchor lasts for this visit only */
  }
}

function RightNow({ onUse, onSent }: { onUse: (id: string) => void; onSent: () => void }) {
  const { preferences } = useSession();
  const locationOn = Boolean(preferences?.privacy.location);
  const [device, setDevice] = useState<EvaluateResponse | null>(null);
  const [deviceErr, setDeviceErr] = useState<string | null>(null);
  const [deviceNote, setDeviceNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [time, setTime] = useState('now');
  const [routeId, setRouteId] = useState(DAY_ROUTES[0].id);
  const [results, setResults] = useState<StopResult[]>([]);
  const [playing, setPlaying] = useState(false);
  const simSession = useRef(`sim-${newKey()}`);
  const anchor = useRef(readAnchor());
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const route = DAY_ROUTES.find((r) => r.id === routeId) ?? DAY_ROUTES[0];

  async function evaluateAt(lat: number, lng: number) {
    const here = { lat, lng };
    let pos = here;
    const away = distanceM(here, CAMPUS);
    if (away > FAR_M) {
      // Far from the demo campus: place the sample shops around the member instead.
      if (!anchor.current) {
        anchor.current = here;
        writeAnchor(here);
      }
      pos = toCampusSpace(here, anchor.current);
      const moved = distanceM(here, anchor.current);
      setDeviceNote(
        `You’re ${Math.round(away / 1000).toLocaleString('en-US')} km from the demo campus, so Perkly placed the sample shops around you. Where you first checked counts as the Student Union${moved > 20 ? `; you’ve moved ${moved} m since` : ''}. Campus Coffee is about 20 m away, the library café about 330 m, the bookshop about 460 m and Olive & Ash about 1 km.`,
      );
    } else {
      setDeviceNote(null);
    }
    const t = time === 'now' ? localTime() : { ...localTime(), hour: Number(time.slice(0, 2)), minute: Number(time.slice(3)) };
    const day = new Date().toISOString().slice(0, 10);
    const res = await api<EvaluateResponse>('/me/moments/evaluate', {
      method: 'POST',
      body: { lat: pos.lat, lng: pos.lng, ...t, source: 'device', session: `device-${day}-${time}` },
    });
    last.current = { lat, lng, at: Date.now() };
    setDevice(res);
    if (res.moment?.sent) notifyDevice(res.moment);
    onSent();
  }

  function checkHere() {
    setDeviceErr(null);
    if (!('geolocation' in navigator)) {
      setDeviceErr('This browser can’t share location. Try a simulated day instead.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await evaluateAt(pos.coords.latitude, pos.coords.longitude);
        } catch (e) {
          setDeviceErr(e instanceof ApiError ? e.message : 'Couldn’t check right now.');
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setDeviceErr('Location is blocked for this site in your browser, so Perkly can’t tell where you are. Allow it in the address bar, or simulate a day.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  // While the page is open, re-check after moving 75 m or every 5 minutes. The phone app does this in the background.
  useEffect(() => {
    if (!watching || !('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const l = last.current;
        if (!l || distanceM(p, l) >= 75 || Date.now() - l.at >= 5 * 60_000) {
          evaluateAt(p.lat, p.lng).catch(() => setDeviceErr('Couldn’t check right now.'));
        }
      },
      () => setWatching(false),
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching, time]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runStop(stop: DayStop) {
    const [h, m] = stop.time.split(':').map(Number);
    const res = await api<EvaluateResponse>('/me/moments/evaluate', {
      method: 'POST',
      body: { lat: stop.lat, lng: stop.lng, hour: h, minute: m, weekday: route.weekday, source: 'simulated', session: simSession.current },
    });
    setResults((r) => [...r.filter((x) => x.stopId !== stop.id), { stopId: stop.id, res }]);
    return res;
  }

  async function playDay() {
    setPlaying(true);
    setResults([]);
    simSession.current = `sim-${newKey()}`;
    try {
      for (const stop of route.stops) {
        await runStop(stop);
        await new Promise((r) => setTimeout(r, 450));
      }
    } catch {
      /* shown per stop */
    } finally {
      setPlaying(false);
      onSent();
    }
  }

  return (
    <section className="glass panel right-now" aria-labelledby="now-h">
      <div className="section-row">
        <h2 className="h2" id="now-h">The right moment</h2>
        <DemoTag>Sample shops</DemoTag>
      </div>
      <p className="panel-lede">
        Perkly’s moment engine weighs where you are, the time, your habits and what’s about to expire, and only notifies you when a reminder would change what you do.
      </p>

      <div className="now-block">
        <h3 className="h3">Simulate a day</h3>
        <div className="chips" role="group" aria-label="Choose a day">
          {DAY_ROUTES.map((r) => (
            <button
              key={r.id}
              type="button"
              className="chip"
              aria-pressed={r.id === routeId}
              disabled={playing}
              onClick={() => {
                setRouteId(r.id);
                setResults([]);
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
        <p className="hint">{route.blurb} {route.stops.length} stops.</p>
        <div className="now-actions">
          <button type="button" className="btn btn-primary" onClick={playDay} disabled={playing}>
            <Play aria-hidden /> {playing ? 'Walking the route…' : results.length ? 'Replay this day' : `Play ${route.name.toLowerCase()}`}
          </button>
        </div>
      </div>

      {(results.length > 0 || playing) && (
        <ol className="day" aria-live="polite">
          {route.stops.map((stop) => {
            const r = results.find((x) => x.stopId === stop.id)?.res;
            if (!r) return null;
            const merchant = r.moment?.merchantId ? merchantById(r.moment.merchantId) : null;
            return (
              <li key={stop.id} className="day-stop">
                <div className="day-when">
                  <span className="day-time tabular">{stop.time}</span>
                  <span className="day-label">{stop.label}</span>
                </div>
                {r.moment ? (
                  <MomentCard key={r.moment.id} moment={r.moment} onUse={onUse} timeLabel={merchant ? merchant.name.split(',')[0] : stop.time} />
                ) : (
                  <p className="moment-none">{r.decision.suppressedBecause ?? 'Nothing nearby worth a notification.'}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {results.some((r) => r.res.fallback) && <p className="notice">The AI service didn’t answer, so simple rules made these calls.</p>}

      <div className="now-block">
        <h3 className="h3">Where you are now</h3>
        {locationOn ? (
          <>
            <div className="now-actions">
              <button type="button" className="btn" onClick={checkHere} disabled={busy}>
                <LocateFixed aria-hidden /> {busy ? 'Checking…' : 'Check where I am'}
              </button>
              <label className="now-time">
                <span>Time</span>
                <select className="select" value={time} onChange={(e) => setTime(e.target.value)}>
                  {TIMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
            </div>
            <SwitchRow id="now-watch" label="Keep checking while this page is open" hint="Re-checks after you move about 75 m. The phone app will do this in the background." checked={watching} onChange={setWatching} />
          </>
        ) : (
          <Link to="/app/profile/privacy" className="btn btn-quiet"><MapPin aria-hidden /> Turn on location</Link>
        )}
        {deviceErr && <p className="notice" role="status">{deviceErr}</p>}
        {deviceNote && (
          <p className="notice" role="status">
            <span>
              {deviceNote}{' '}
              <button type="button" className="link-btn" onClick={() => { anchor.current = null; writeAnchor(null); setDeviceNote(null); setDevice(null); }}>
                Start again from here
              </button>
            </span>
          </p>
        )}
        {device && (
          <div className="device-result">
            {device.moment ? (
              <MomentCard key={device.moment.id} moment={device.moment} onUse={onUse} timeLabel={time === 'now' ? 'Now, where you are' : `Where you are, at ${TIMES.find((t) => t.id === time)?.label.split(', ')[1]}`} />
            ) : (
              <p className="notice">{device.decision.suppressedBecause ?? 'Nothing worth a notification here right now.'}{time === 'now' ? ' Shops may be closed at this hour; try another time.' : ''}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function RecentMoments({ onUse }: { onUse: (id: string) => void }) {
  const { data, reload } = useApi<{ moments: Moment[] }>('/me/moments');
  const { summary } = useApp();
  useEffect(() => {
    void reload();
  }, [summary, reload]);
  const sent = data?.moments.filter((m) => m.sent).slice(0, 3) ?? [];
  if (!sent.length) return null;
  return (
    <section className="glass panel" aria-labelledby="recent-h">
      <h2 className="h2" id="recent-h">Recent notifications</h2>
      <p className="panel-lede">Rate them and Perkly tunes what it sends next.</p>
      <div className="moment-stack">
        {sent.map((m) => <MomentCard key={m.id} moment={m} onUse={onUse} compact />)}
      </div>
    </section>
  );
}
