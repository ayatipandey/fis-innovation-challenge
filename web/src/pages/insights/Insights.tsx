import { useEffect, useState } from 'react';
import { DemoTag, ErrorState, Logo, SkeletonRows } from '../../components/bits';
import { useApi } from '../../lib/useApi';

interface Decile {
  decile: number;
  predictedUplift: number;
  notifiedRate: number;
  controlRate: number;
  actualLift: number;
  members: number;
}
interface Segment {
  share: number;
  notifiedRate: number;
  controlRate: number;
  lift: number;
}
interface Report {
  synthetic: boolean;
  method: string;
  holdoutRows: number;
  overall: { notifiedRate: number; controlRate: number; liftPoints: number };
  targeting: { threshold: number; shareTargeted: number; targetedLiftPoints: number; untargetedLiftPoints: number; causedPer1000Blanket: number; causedPer1000Targeted: number };
  deciles: Decile[];
  segments: Record<'persuadables' | 'sureThings' | 'doNotDisturb' | 'lostCauses', Segment>;
  modelQuality: { aucNotified: number; aucControl: number; upliftCorrelationWithTruth: number };
}
interface InsightsResponse {
  model: Report;
  live: { members: number; linkedPrograms: number; momentsEvaluated: number; momentsSent: number; redemptions: number; holdsExpired: number; ratings: { good: number; fine: number; bad: number } };
  notice: string;
}

const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
const pts = (n: number) => `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)} pts`;

const SEGMENTS: { id: keyof Report['segments']; label: string; what: string }[] = [
  { id: 'persuadables', label: 'Persuadables', what: 'Use the reward because of the reminder. Perkly notifies them.' },
  { id: 'sureThings', label: 'Sure things', what: 'Would use it anyway. A reminder adds nothing.' },
  { id: 'lostCauses', label: 'Lost causes', what: 'Won’t use it either way right now.' },
  { id: 'doNotDisturb', label: 'Do not disturb', what: 'A reminder makes them less likely to use it. Perkly stays quiet.' },
];

/** Partner insights: not linked from the site. Open /insights directly during a presentation. */
export function Insights() {
  const { data, error, reload } = useApi<InsightsResponse>('/insights');
  const [updated, setUpdated] = useState(() => new Date());
  // Live counts change as people use the demo, so refresh every 15 seconds.
  useEffect(() => {
    const t = setInterval(() => void reload().then(() => setUpdated(new Date())), 15_000);
    return () => clearInterval(t);
  }, [reload]);
  const refresh = () => void reload().then(() => setUpdated(new Date()));
  useEffect(() => {
    document.title = 'Partner insights · Perkly';
  }, []);

  return (
    <div className="insights">
      <header className="ins-head wrap">
        <Logo />
        <DemoTag>Invented data</DemoTag>
      </header>
      <main id="main" className="wrap ins-main">
        <p className="eyebrow">For partner programs</p>
        <h1 className="display ins-h">Do Perkly’s notifications change what members do?</h1>
        <p className="ins-lede">
          Proof by control group. 10% of members are never notified. Lift is the redemption rate of notified members minus the control group’s,
          in percentage points.
        </p>

        {error && <ErrorState message={error} onRetry={reload} />}
        {!data && !error && <SkeletonRows n={4} />}
        {data && <Body r={data.model} live={data.live} notice={data.notice} updated={updated} onRefresh={refresh} />}
      </main>
    </div>
  );
}

function Body({ r, live, notice, updated, onRefresh }: { r: Report; live: InsightsResponse['live']; notice: string; updated: Date; onRefresh: () => void }) {
  const t = r.targeting;
  return (
    <>
      <section className="ins-tiles" aria-label="Headline results">
        <div className="tile glass">
          <p className="tile-label">Lift in redemption rate</p>
          <p className="tile-n display tabular">+{r.overall.liftPoints.toFixed(1)} pts</p>
          <p className="tile-sub tabular">{pct(r.overall.notifiedRate)} notified vs {pct(r.overall.controlRate)} control</p>
        </div>
        <div className="tile glass">
          <p className="tile-label">Lift where the model chooses to send</p>
          <p className="tile-n display tabular">+{t.targetedLiftPoints.toFixed(1)} pts</p>
          <p className="tile-sub tabular">{pct(t.shareTargeted, 0)} of moments clear the {pct(t.threshold, 0)} uplift bar</p>
        </div>
        <div className="tile glass">
          <p className="tile-label">Extra redemptions per 1,000 moments</p>
          <p className="tile-n display tabular">{t.causedPer1000Targeted}</p>
          <p className="tile-sub tabular">vs {t.causedPer1000Blanket} when everyone is notified, with {pct(1 - t.shareTargeted, 0)} fewer notifications</p>
        </div>
      </section>

      <section className="glass panel ins-chart" aria-labelledby="c1-h">
        <h2 className="h2" id="c1-h">Redemption rate: notified vs control</h2>
        <p className="panel-lede tabular">{r.holdoutRows.toLocaleString('en-US')} held-out moments the model never trained on.</p>
        <HBars
          rows={[
            { label: 'Notified (90%)', value: r.overall.notifiedRate, series: 1 },
            { label: 'Control, never notified (10%)', value: r.overall.controlRate, series: 0 },
          ]}
          max={0.5}
          format={(v) => pct(v)}
        />
        <p className="ins-callout tabular">Lift: <strong>+{r.overall.liftPoints.toFixed(1)} percentage points</strong></p>
      </section>

      <section className="glass panel ins-chart" aria-labelledby="c2-h">
        <h2 className="h2" id="c2-h">The model knows who a reminder will change</h2>
        <p className="panel-lede">Moments ranked into ten groups by predicted uplift. Bars are the lift actually measured against the control group; dots are what the model predicted.</p>
        <DecileChart deciles={r.deciles} threshold={t.threshold} />
        <details className="ins-table">
          <summary>Show as a table</summary>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Lift by decile">
            <table className="data-table tabular">
              <thead><tr><th scope="col">Group</th><th scope="col">Predicted uplift</th><th scope="col">Notified</th><th scope="col">Control</th><th scope="col">Measured lift</th><th scope="col">Moments</th></tr></thead>
              <tbody>
                {r.deciles.map((d) => (
                  <tr key={d.decile}><th scope="row">{d.decile}</th><td>{pts(d.predictedUplift)}</td><td>{pct(d.notifiedRate)}</td><td>{pct(d.controlRate)}</td><td>{pts(d.actualLift)}</td><td>{d.members.toLocaleString('en-US')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="glass panel ins-chart" aria-labelledby="c3-h">
        <h2 className="h2" id="c3-h">Notify everyone, or only the persuadable?</h2>
        <p className="panel-lede">Redemptions the notifications caused, per 1,000 moments.</p>
        <HBars
          rows={[
            { label: 'Uplift targeting', value: t.causedPer1000Targeted, series: 1 },
            { label: 'Notify everyone', value: t.causedPer1000Blanket, series: 0 },
          ]}
          max={200}
          format={(v) => String(Math.round(v))}
        />
        <p className="panel-lede tabular">Notifying members below the bar lowers their redemption rate ({t.untargetedLiftPoints.toFixed(1)} pts), so holding back helps.</p>
      </section>

      <section className="glass panel" aria-labelledby="seg-h">
        <h2 className="h2" id="seg-h">Four kinds of moment</h2>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Segments">
          <table className="data-table tabular">
            <thead><tr><th scope="col">Segment</th><th scope="col">Share</th><th scope="col">Notified</th><th scope="col">Control</th><th scope="col">Lift</th><th scope="col">What it means</th></tr></thead>
            <tbody>
              {SEGMENTS.map((s) => {
                const v = r.segments[s.id];
                return (
                  <tr key={s.id}><th scope="row">{s.label}</th><td>{pct(v.share, 0)}</td><td>{pct(v.notifiedRate)}</td><td>{pct(v.controlRate)}</td><td>{pts(v.lift)}</td><td className="wrap-cell">{s.what}</td></tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">Segments come from the invented ground truth, which only exists because the data is synthetic. With real members they can’t be observed directly, which is why the control group matters.</p>
      </section>

      <section className="glass panel" aria-labelledby="mq-h">
        <h2 className="h2" id="mq-h">How it works</h2>
        <ul className="plain-list">
          <li>A T-learner: two logistic regressions, one trained on notified moments and one on control, on 60,000 invented moments. Uplift is the difference between their predictions.</li>
          <li>Inputs: distance to the shop, whether it’s open, the member’s habit at this hour, visit rate, spend velocity, days until points expire, reward value, any extra spend a minimum needs, and Bad ratings for that kind of reminder at that time.</li>
          <li className="tabular">Accuracy on held-out data: AUC {r.modelQuality.aucNotified.toFixed(2)} (notified) and {r.modelQuality.aucControl.toFixed(2)} (control); predicted uplift correlates {r.modelQuality.upliftCorrelationWithTruth.toFixed(2)} with the true effect.</li>
          <li>Live, it only sends a notification when predicted uplift is at least {pct(t.threshold, 0)}, within the member’s daily limit and outside quiet hours.</li>
        </ul>
      </section>

      <section className="glass panel" aria-labelledby="live-h">
        <div className="section-row">
          <h2 className="h2" id="live-h">This demo, live</h2>
          <span className="live-refresh">
            <span className="hint" aria-live="polite">Updated {updated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
            <button type="button" className="btn btn-sm" onClick={onRefresh}>Refresh</button>
          </span>
        </div>
        <dl className="live-grid tabular">
          <div><dt>Member accounts</dt><dd>{live.members}</dd></div>
          <div><dt>Programs linked</dt><dd>{live.linkedPrograms}</dd></div>
          <div><dt>Moments evaluated</dt><dd>{live.momentsEvaluated}</dd></div>
          <div><dt>Notifications sent</dt><dd>{live.momentsSent}</dd></div>
          <div><dt>Redemptions confirmed</dt><dd>{live.redemptions}</dd></div>
          <div><dt>Ratings (Good / Fine / Bad)</dt><dd>{live.ratings.good} / {live.ratings.fine} / {live.ratings.bad}</dd></div>
        </dl>
        <p className="hint">{notice}</p>
      </section>
    </>
  );
}

function HBars({ rows, max, format }: { rows: { label: string; value: number; series: 0 | 1 }[]; max: number; format: (v: number) => string }) {
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track">
            <span className={`hbar s${r.series}`} style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }} title={`${r.label}: ${format(r.value)}`} />
            <span className="hbar-value">{format(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function DecileChart({ deciles, threshold }: { deciles: Decile[]; threshold: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 300;
  const m = { t: 16, r: 12, b: 40, l: 52 };
  const lo = -0.2;
  const hi = 0.45;
  const y = (v: number) => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
  const band = (W - m.l - m.r) / deciles.length;
  const x = (i: number) => m.l + band * i + band / 2;
  const bw = Math.min(40, band * 0.56);
  const ticks = [-0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4];
  const h = hover != null ? deciles[hover] : null;

  return (
    <div className="decile">
      <div className="legend" aria-hidden>
        <span><i className="sw s1" /> Measured lift</span>
        <span><i className="sw dot" /> Predicted uplift</span>
      </div>
      <div className="decile-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Measured lift falls from about +40 points in the top group to about −15 in the bottom group, closely following the predicted uplift.">
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={m.l} x2={W - m.r} y1={y(tk)} y2={y(tk)} className={tk === 0 ? 'axis-zero' : 'grid'} />
              <text x={m.l - 8} y={y(tk)} className="tick" textAnchor="end" dominantBaseline="middle">{`${tk > 0 ? '+' : ''}${Math.round(tk * 100)}`}</text>
            </g>
          ))}
          <line x1={m.l} x2={W - m.r} y1={y(threshold)} y2={y(threshold)} className="threshold" />
          <text x={W - m.r} y={y(threshold) - 6} className="tick" textAnchor="end">send bar ({Math.round(threshold * 100)} pts)</text>
          {deciles.map((d, i) => {
            const top = Math.min(y(d.actualLift), y(0));
            const hgt = Math.max(2, Math.abs(y(d.actualLift) - y(0)));
            const pos = d.actualLift >= 0;
            return (
              <g key={d.decile} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={m.l + band * i} y={m.t} width={band} height={H - m.t - m.b} fill="transparent" />
                <path className={`bar s1 ${hover === i ? 'is-hover' : ''}`} d={roundedBar(x(i) - bw / 2, top, bw, hgt, pos)} />
                <circle cx={x(i)} cy={y(d.predictedUplift)} r={5} className="pred" />
                <text x={x(i)} y={H - m.b + 18} className="tick" textAnchor="middle">{d.decile}</text>
                {(i === 0 || i === deciles.length - 1) && (
                  <text x={x(i)} y={pos ? top - 8 : top + hgt + 16} className="dlabel" textAnchor="middle">{`${pos ? '+' : ''}${(d.actualLift * 100).toFixed(0)}`}</text>
                )}
              </g>
            );
          })}
          <text x={m.l} y={H - 6} className="tick">Group 1 = highest predicted uplift</text>
          <text x={14} y={m.t + 4} className="tick" transform={`rotate(-90 14 ${m.t + 4})`} textAnchor="end">pts</text>
        </svg>
        {h && hover != null && (
          <div className="viz-tip tabular" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <strong>Group {h.decile}</strong>
            <span>Measured {pts(h.actualLift)}</span>
            <span>Predicted {pts(h.predictedUplift)}</span>
            <span>{pct(h.notifiedRate)} vs {pct(h.controlRate)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** A bar with 4px rounded corners on the data end only. */
function roundedBar(x: number, y: number, w: number, h: number, up: boolean) {
  const r = Math.min(4, h / 2, w / 2);
  if (up) return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
  return `M${x},${y} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + w - r} Q${x + w},${y + h} ${x + w},${y + h - r} V${y} Z`;
}
