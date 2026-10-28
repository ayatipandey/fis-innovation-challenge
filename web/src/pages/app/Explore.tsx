import { OPTIONS, categoryLabel, merchantById, optionById, programById } from '@shared/demo-data';
import { AlertTriangle, Check, Search, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DemoTag, ErrorState, PageHead, ProgramMark, SkeletonRows } from '../../components/bits';
import { daysUntil, money, points } from '../../lib/format';
import { useApp } from '../../state/app';

export function Explore() {
  const { summary, error, loading, reload, redeem, available } = useApp();
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

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

      {programs.length > 0 && (
        <div className="explore-search" role="search">
          <label htmlFor="ex-q" className="visually-hidden">Search rewards</label>
          <Search aria-hidden className="explore-search-icon" />
          <input
            id="ex-q"
            type="search"
            placeholder="Search rewards: latte, Pubmix, popcorn, Riverside…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQuery('')}>
              <X aria-hidden />
            </button>
          )}
        </div>
      )}

      {query.trim() && <SearchResults query={query} available={available} onUse={redeem} linked={new Set(programs.map((p) => p.program.id))} />}

      {!query.trim() && programs.length > 1 && (
        <div className="chips-scroll filter" role="group" aria-label="Show program">
          <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All programs</button>
          {programs.map((p) => (
            <button key={p.program.id} type="button" className="chip" aria-pressed={filter === p.program.id} onClick={() => setFilter(p.program.id)}>
              {p.program.name}
            </button>
          ))}
        </div>
      )}

      {!query.trim() && (
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
      )}
    </div>
  );
}

/** Every reward, matched on its name, brand, shops, what it covers and category. */
function SearchResults({ query, available, onUse, linked }: { query: string; available: (programId: string) => number; onUse: (optionId: string) => void; linked: Set<string> }) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = OPTIONS.filter((o) => linked.has(o.programId)).filter((o) => {
    const p = programById(o.programId);
    const shops = o.merchantIds.map((id) => merchantById(id));
    const text = [o.title, o.valueBasis, ...o.valid, p?.name, p?.issuer, ...shops.map((m) => `${m?.name} ${m?.address}`), ...shops.map((m) => (m ? categoryLabel(m.category) : '')), p?.category ? categoryLabel(p.category) : '']
      .join(' ')
      .toLowerCase();
    return words.every((w) => text.includes(w));
  });
  return (
    <section className="glass panel" aria-labelledby="sr-h">
      <h2 className="h2" id="sr-h" aria-live="polite">
        {results.length ? `${results.length} ${results.length === 1 ? 'reward matches' : 'rewards match'} “${query.trim()}”` : `No rewards match “${query.trim()}”`}
      </h2>
      {results.length === 0 && <p className="hint">Try a brand (Starmucks, Pubmix), a reward (latte, popcorn) or a place (Riverside, UNF).</p>}
      <ul className="search-results">
        {results.map((o) => {
          const p = programById(o.programId)!;
          const have = available(o.programId);
          const short = Math.max(0, o.cost - have);
          return (
            <li key={o.id} className="search-result">
              <ProgramMark programId={p.id} />
              <div className="search-main">
                <p className="plan-tag">{p.name}</p>
                <h3 className="plan-label">{o.title}</h3>
                <p className="hint tabular">
                  {money(o.value)} for {points(o.cost, p.unit)} · {o.minSpend != null ? `min. spend ${money(o.minSpend)}` : 'no minimum spend'} ·{' '}
                  {o.merchantIds.length ? o.merchantIds.map((id) => merchantById(id)?.name.split(', ')[1]).join(', ') : 'online'}
                </p>
              </div>
              <div className="plan-use">
                {short > 0 ? (
                  <span className="hint tabular">{points(short, p.unit)} more needed</span>
                ) : (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => onUse(o.id)} aria-label={`Use ${o.title}`}>Use</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
