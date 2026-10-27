import { DAY_STOPS, merchantById, optionById } from '@shared/demo-data';
import type { Moment } from '@shared/types';
import { AlertTriangle, ArrowRight, Clock, LocateFixed, MapPin, Play, QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DemoTag, ErrorState, ProgramMark, SkeletonRows } from '../../components/bits';
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

function RightNow({ onUse, onSent }: { onUse: (id: string) => void; onSent: () => void }) {
  const { preferences } = useSession();
  const locationOn = Boolean(preferences?.privacy.location);
  const [device, setDevice] = useState<EvaluateResponse | null>(null);
  const [deviceErr, setDeviceErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<StopResult[]>([]);
  const [playing, setPlaying] = useState(false);
  const simSession = useRef(`sim-${newKey()}`);

  async function checkHere() {
    setDeviceErr(null);
    if (!('geolocation' in navigator)) {
      setDeviceErr('This browser can’t share location. Try “Simulate a day” instead.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const day = new Date().toISOString().slice(0, 10);
          const res = await api<EvaluateResponse>('/me/moments/evaluate', {
            method: 'POST',
            body: { lat: pos.coords.latitude, lng: pos.coords.longitude, ...localTime(), source: 'device', session: `device-${day}` },
          });
          setDevice(res);
          if (res.moment?.sent) notifyDevice(res.moment);
          onSent();
        } catch (e) {
          setDeviceErr(e instanceof ApiError ? e.message : 'Couldn’t check right now.');
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setDeviceErr('Location was blocked, so Perkly can’t tell what’s near you. You can still simulate a day on campus.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function runStop(stop: (typeof DAY_STOPS)[number]) {
    const [h, m] = stop.time.split(':').map(Number);
    const res = await api<EvaluateResponse>('/me/moments/evaluate', {
      method: 'POST',
      body: { lat: stop.lat, lng: stop.lng, hour: h, minute: m, weekday: 1, source: 'simulated', session: simSession.current },
    });
    setResults((r) => [...r.filter((x) => x.stopId !== stop.id), { stopId: stop.id, res }]);
    return res;
  }

  async function playDay() {
    setPlaying(true);
    setResults([]);
    simSession.current = `sim-${newKey()}`;
    try {
      for (const stop of DAY_STOPS) {
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
        <DemoTag>Simulated route</DemoTag>
      </div>
      <p className="panel-lede">
        Perkly’s moment engine weighs where you are, the time, your habits and what’s about to expire, and only notifies you when a reminder would change what you do.
      </p>

      <div className="now-actions">
        <button type="button" className="btn btn-primary" onClick={playDay} disabled={playing}>
          <Play aria-hidden /> {playing ? 'Walking the route…' : results.length ? 'Replay the day' : 'Simulate a day on campus'}
        </button>
        {locationOn ? (
          <button type="button" className="btn" onClick={checkHere} disabled={busy}>
            <LocateFixed aria-hidden /> {busy ? 'Checking…' : 'Check where I am'}
          </button>
        ) : (
          <Link to="/app/profile/privacy" className="btn btn-quiet"><MapPin aria-hidden /> Turn on location</Link>
        )}
      </div>
      {deviceErr && <p className="notice" role="status">{deviceErr}</p>}
      {device && (
        <div className="device-result">
          {device.moment ? (
            <MomentCard key={device.moment.id} moment={device.moment} onUse={onUse} timeLabel="Now, where you are" />
          ) : (
            <p className="notice">{device.decision.suppressedBecause ?? 'Nothing worth a notification here right now.'} The sample shops are near a demo campus, so try the simulated day.</p>
          )}
        </div>
      )}

      {(results.length > 0 || playing) && (
        <ol className="day" aria-live="polite">
          {DAY_STOPS.map((stop) => {
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
