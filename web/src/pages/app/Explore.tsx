import { optionById } from '@shared/demo-data';
import { AlertTriangle, Check, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DemoTag, ErrorState, PageHead, ProgramMark, SkeletonRows } from '../../components/bits';
import { daysUntil, money, points } from '../../lib/format';
import { useApp } from '../../state/app';

export function Explore() {
  const { summary, error, loading, reload, redeem } = useApp();
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    document.title = 'Explore · Perkly';
  }, []);

  const programs = summary?.programs ?? [];
  const shown = filter === 'all' ? programs : programs.filter((p) => p.program.id === filter);

  return (
    <div className="page">
      <PageHead
        title="Explore"
        lede="Every way to spend each balance, ranked by what you actually get: the value, any minimum spend beyond what you usually buy, how many visits it takes, and whether points would expire first."
      >
        <DemoTag />
      </PageHead>

      {error && !summary && <ErrorState message={error} onRetry={reload} />}
      {loading && !summary && <SkeletonRows n={4} />}

      {summary && programs.length === 0 && (
        <div className="empty glass panel">
          <h3>Nothing linked yet</h3>
          <p>Link a program and Perkly will show what its balance can buy.</p>
          <Link to="/app/profile/programs" className="btn btn-primary">Link a program</Link>
        </div>
      )}

      {programs.length > 1 && (
        <div className="chips-scroll filter" role="group" aria-label="Show program">
          <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All programs</button>
          {programs.map((p) => (
            <button key={p.program.id} type="button" className="chip" aria-pressed={filter === p.program.id} onClick={() => setFilter(p.program.id)}>
              {p.program.name}
            </button>
          ))}
        </div>
      )}

      <div className="explore">
        {shown.map(({ program, link, plans, nextReward }) => {
          const soon = link.expiries[0];
          const soonDays = soon ? daysUntil(soon.expiresAt) : null;
          return (
            <section key={program.id} className="glass panel plan-group" aria-labelledby={`pg-${program.id}`}>
              <header className="plan-group-head">
                <ProgramMark programId={program.id} size="lg" />
                <div>
                  <h2 className="h2" id={`pg-${program.id}`}>{program.name}</h2>
                  <p className="plan-group-meta tabular">
                    <strong>{points(link.available, program.unit)}</strong> available
                    {link.held > 0 && <> · {link.held.toLocaleString('en-US')} on hold</>}
                    {soon && soonDays != null && soonDays <= 30 && (
                      <span className={soonDays <= 7 ? 'is-urgent' : ''}> · {soon.points.toLocaleString('en-US')} expire in {soonDays} {soonDays === 1 ? 'day' : 'days'}</span>
                    )}
                  </p>
                </div>
              </header>

              {plans.length === 0 ? (
                <p className="notice">
                  {nextReward
                    ? `${points(nextReward.pointsNeeded, program.unit)} more gets you ${optionById(nextReward.optionId)?.title.toLowerCase()}.`
                    : 'This balance doesn’t cover a reward yet.'}
                </p>
              ) : (
                <ol className="plans">
                  {plans.map((plan, i) => (
                    <li key={plan.id} className={`plan ${i === 0 ? 'is-best' : ''}`}>
                      <div className="plan-rank" aria-hidden>{i === 0 ? <Trophy /> : i + 1}</div>
                      <div className="plan-main">
                        <p className="plan-tag">{i === 0 ? 'Best use' : `Option ${i + 1}`}</p>
                        <h3 className="plan-label">{plan.label}</h3>
                        <dl className="plan-facts tabular">
                          <div><dt>You get</dt><dd>{money(plan.totalValue)}</dd></div>
                          <div><dt>Uses</dt><dd>{plan.pointsUsed.toLocaleString('en-US')}{plan.leftover ? ` (${plan.leftover.toLocaleString('en-US')} left)` : ''}</dd></div>
                          <div><dt>Visits</dt><dd>{plan.visits || 'None'}</dd></div>
                          <div><dt>Extra spend</dt><dd>{plan.extraSpend ? money(plan.extraSpend) : 'None'}</dd></div>
                        </dl>
                        <ul className="plan-reasons">
                          {plan.reasons.map((r) => <li key={r}><Check aria-hidden /> {r}</li>)}
                          {plan.warnings.map((w) => <li key={w} className="is-warn"><AlertTriangle aria-hidden /> {w}</li>)}
                        </ul>
                      </div>
                      <div className="plan-use">
                        {plan.steps.map((s) => {
                          const o = optionById(s.optionId);
                          return (
                            <button key={s.optionId} type="button" className={`btn btn-sm ${i === 0 ? 'btn-primary' : ''}`} onClick={() => redeem(s.optionId)} aria-label={`Use ${o?.title}`}>
                              Use {plan.steps.length > 1 ? o?.title.toLowerCase() : 'one now'}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
