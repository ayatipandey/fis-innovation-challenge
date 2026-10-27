import { categoryLabel } from '@shared/demo-data';
import type { Offer } from '@shared/types';
import { AlertTriangle, ArrowRight, Bell, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorState, RewardRow, SkeletonRows } from '../../components/bits';
import { daysUntil, fullDate, greeting, longDateline, money, shortDate } from '../../lib/format';
import { useData } from '../../state/data';
import { useSession } from '../../state/session';

function partOfDay(h = new Date().getHours()) {
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

function whatToDo(o: Offer) {
  const by = `by ${new Date(o.expiresAt).toLocaleDateString('en-US', { weekday: 'long' })}`;
  if (o.redemption.providerOnly) return `Book it with the provider ${by}.`;
  if (o.howToUse.activationRequired) return `Activate it, then pay with your linked card ${by}.`;
  if (o.redemption.split) return `Use your points at checkout ${by}.`;
  if (o.redemption.couponCode) return `Show the code in store ${by}.`;
  return `Use it at checkout ${by}.`;
}

export function Home() {
  const { preferences } = useSession();
  const d = useData();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Home · Perkly';
  }, []);

  const catalogReady = d.catalog.status === 'ready';
  const recs = d.recs.status === 'ready' ? d.recs.data : null;
  const top = useMemo(() => (recs ? recs.items.filter((r) => d.offer(r.offerId)).slice(0, 5) : []), [recs, d]);
  const feature = top[0];
  const rest = top.slice(1);

  const expiring = useMemo(() => {
    if (d.catalog.status !== 'ready') return [];
    const rank = new Map(recs?.items.map((r, i) => [r.offerId, i]) ?? []);
    return d.catalog.data.offers
      .filter((o) => daysUntil(o.expiresAt) <= 7 && daysUntil(o.expiresAt) >= 0)
      .filter((o) => (rank.get(o.id) ?? 99) < 12 || d.isFavorite(o.id))
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
      .slice(0, 4);
  }, [d, recs]);

  const name = preferences?.displayName;
  const soon = top.map((r) => d.offer(r.offerId)!).filter((o) => daysUntil(o.expiresAt) <= 7).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
  const fit = Math.min(3, top.length);
  const lede = !top.length
    ? 'Tell Perkly what you’re into and the right rewards will appear here.'
    : `${fit === 1 ? 'One reward fits' : `${['', 'One', 'Two', 'Three'][fit]} rewards fit`} your ${partOfDay()}.${soon ? ` One expires on ${new Date(soon.expiresAt).toLocaleDateString('en-US', { weekday: 'long' })}.` : ''}`;

  return (
    <div className="page home">
      <header className="home-head">
        <div>
          <p className="dateline">{longDateline()}</p>
          <h1 className="display home-greet">{greeting()}{name ? `, ${name}` : ''}.</h1>
          <p className="home-lede">{lede}</p>
        </div>
        <div className="home-tools">
          <button type="button" className="btn search-shortcut" onClick={() => navigate('/app/explore?focus=search')}>
            <Search aria-hidden /> Search rewards
          </button>
          <Notifications expiring={expiring} />
        </div>
      </header>

      <Balances />

      <div className="home-grid">
        <section className="home-recs" aria-labelledby="recs-h">
          <div className="section-row">
            <h2 id="recs-h" className="h2">Recommended for you</h2>
            <Link to="/app/explore" className="link-more">All rewards <ArrowRight aria-hidden /></Link>
          </div>
          {d.recs.status === 'loading' || !catalogReady ? (
            <SkeletonRows n={4} />
          ) : d.recs.status === 'error' ? (
            <ErrorState message={`Recommendations didn’t load. ${d.recs.message}`} onRetry={d.refreshRecs} />
          ) : !feature ? (
            <div className="empty">
              <h3>Nothing to recommend yet</h3>
              <p>Pick a few interests or favorite brands and Perkly will rank rewards for you.</p>
              <Link to="/app/profile/favorites" className="btn btn-primary">Choose interests</Link>
            </div>
          ) : (
            <>
              {recs?.engine === 'local-fallback-v1' && (
                <div className="notice" role="status">
                  <AlertTriangle aria-hidden />
                  <span>{recs.note}</span>
                </div>
              )}
              <div className="rec-list">
                <RecRow id={feature.offerId} reason={feature.reasons[0]} warning={feature.warnings[0]} size="feature" />
                {rest.map((r) => <RecRow key={r.offerId} id={r.offerId} reason={r.reasons[0]} warning={r.warnings[0]} />)}
              </div>
              <p className="engine-note">
                {recs?.engine === 'perkly-scorer-v1' ? 'Ranked by Perkly’s rule-based scoring using only what you’ve allowed.' : 'Backup ranking.'}{' '}
                {!preferences?.privacy.spendingData && 'Spending data is off. '}
                <Link to="/app/profile/privacy">Change what’s used</Link>
              </p>
            </>
          )}
        </section>

        <div className="home-side">
          <section aria-labelledby="exp-h" className="side-block">
            <h2 id="exp-h" className="h3">Expiring soon</h2>
            {!catalogReady ? (
              <div className="skeleton" style={{ height: 160 }} />
            ) : expiring.length === 0 ? (
              <p className="muted">Nothing you care about expires this week.</p>
            ) : (
              <ul className="exp-list">
                {expiring.map((o) => {
                  const b = d.brand(o.brandId);
                  const urgent = daysUntil(o.expiresAt) <= 3;
                  return (
                    <li key={o.id}>
                      <button type="button" className="exp-item" onClick={() => d.openReward(o.id)}>
                        <span className={`exp-date ${urgent ? 'is-urgent' : ''}`}>
                          <span className="exp-day display">{new Date(o.expiresAt).getDate()}</span>
                          <span className="exp-mon">{new Date(o.expiresAt).toLocaleDateString('en-US', { month: 'short' })}</span>
                        </span>
                        <span className="exp-text">
                          <span className="exp-brand">{b?.name}</span>
                          <span className="exp-head">{o.benefit.summary}</span>
                          <span className="exp-do">{whatToDo(o)}</span>
                          <span className="visually-hidden">Expires {fullDate(o.expiresAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <QuickAccess />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}

function RecRow({ id, reason, warning, size }: { id: string; reason?: string; warning?: string; size?: 'feature' }) {
  const d = useData();
  const o = d.offer(id);
  if (!o) return null;
  return (
    <RewardRow
      offer={o}
      brand={d.brand(o.brandId)}
      reason={reason}
      warning={warning}
      size={size ?? 'row'}
      favorite={d.isFavorite(o.id)}
      onFavorite={() => d.toggleFavorite(o.id)}
      onOpen={() => d.openReward(o.id)}
      showNearby={d.recs.status === 'ready' && !!d.recs.data.location}
    />
  );
}

function Balances() {
  const d = useData();
  if (d.wallet.status === 'loading' || d.catalog.status !== 'ready') return <div className="skeleton" style={{ height: 96, marginBottom: 48 }} />;
  if (d.wallet.status === 'error') return <ErrorState message={`Balances didn’t load. ${d.wallet.message}`} onRetry={d.refreshWallet} />;
  const w = d.wallet.data;
  const connected = w.programs.filter((p) => p.status === 'connected');
  return (
    <section className="ledger" aria-labelledby="ledger-h">
      <h2 id="ledger-h" className="visually-hidden">Your balances</h2>
      {connected.length === 0 ? (
        <div className="ledger-empty">
          <p>No reward programs connected yet. Connect one to see balances and pay with points.</p>
          <Link to="/app/profile/programs" className="btn btn-sm">Connect programs</Link>
        </div>
      ) : (
        <dl className="ledger-list tabular">
          {connected.map((l) => {
            const p = d.program(l.programId)!;
            return (
              <div key={l.programId}>
                <dt>{p.name}</dt>
                <dd className="ledger-num">{l.balance.toLocaleString('en-US')} <span>{p.unit}</span></dd>
                <dd className="ledger-sub">{p.unitValue != null ? `${money(l.balance * p.unitValue)} value` : 'Value varies by redemption'}</dd>
              </div>
            );
          })}
          <div>
            <dt>Cashback</dt>
            <dd className="ledger-num">{money(w.cashback.available)}</dd>
            <dd className="ledger-sub">{w.cashback.pending > 0 ? `${money(w.cashback.pending)} pending` : 'Nothing pending'}</dd>
          </div>
        </dl>
      )}
      {connected.length > 0 && <p className="ledger-note">Demo balances. Values use each program’s published demo rate; programs without a fixed rate show none.</p>}
    </section>
  );
}

function QuickAccess() {
  const { preferences } = useSession();
  const d = useData();
  const w = d.wallet.status === 'ready' ? d.wallet.data : null;
  const brands = (preferences?.favoriteBrands ?? []).map((id) => d.brand(id)).filter(Boolean);
  const cats = preferences?.categories ?? [];
  const recent = (w?.recentlyViewed ?? []).map((id) => d.offer(id)).filter(Boolean).slice(0, 3) as Offer[];
  return (
    <section aria-labelledby="qa-h" className="side-block">
      <h2 id="qa-h" className="h3">Quick access</h2>
      {brands.length > 0 && (
        <div className="qa-group">
          <h3 className="qa-label">Favorite brands</h3>
          <div className="chips">
            {brands.map((b) => (
              <Link key={b!.id} to={`/app/explore?brand=${b!.id}`} className="chip">{b!.name}</Link>
            ))}
          </div>
        </div>
      )}
      {cats.length > 0 && (
        <div className="qa-group">
          <h3 className="qa-label">Favorite categories</h3>
          <div className="chips">
            {cats.map((c) => <Link key={c} to={`/app/explore?category=${c}`} className="chip">{categoryLabel(c)}</Link>)}
          </div>
        </div>
      )}
      {!!w?.favorites.length && (
        <div className="qa-group">
          <Link to="/app/explore?saved=1" className="chip">Saved rewards ({w.favorites.length})</Link>
        </div>
      )}
      <div className="qa-group">
        <h3 className="qa-label">Recently viewed</h3>
        {recent.length === 0 ? (
          <p className="muted">Rewards you open will appear here.</p>
        ) : (
          <ul className="recent-list">
            {recent.map((o) => (
              <li key={o.id}>
                <button type="button" className="link-btn" onClick={() => d.openReward(o.id)}>{d.brand(o.brandId)?.name}: {o.benefit.summary}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!brands.length && !cats.length && (
        <p className="muted"><Link to="/app/profile/favorites">Add favorites</Link> for one-tap shortcuts.</p>
      )}
    </section>
  );
}

function RecentActivity() {
  const d = useData();
  const items = d.wallet.status === 'ready' ? d.wallet.data.activity.slice(0, 5) : [];
  return (
    <section aria-labelledby="act-h" className="side-block">
      <div className="section-row">
        <h2 id="act-h" className="h3">Recent activity</h2>
        <Link to="/app/profile/history" className="link-more">History <ArrowRight aria-hidden /></Link>
      </div>
      {items.length === 0 ? (
        <p className="muted">Earned, redeemed and expired rewards will show up here.</p>
      ) : (
        <ul className="activity-list">
          {items.map((a) => (
            <li key={a.id}>
              <span className={`act-kind act-${a.kind}`}>{({ earned: 'Earned', redeemed: 'Redeemed', cashback: 'Cashback', expired: 'Expired', pending: 'Pending' })[a.kind]}</span>
              <span className="act-label">{a.label}</span>
              <span className="act-amt tabular">{a.amount}</span>
              <span className="act-date">{shortDate(a.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Notifications({ expiring }: { expiring: Offer[] }) {
  const d = useData();
  const { preferences } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = preferences?.notifications.expirationReminders === false ? [] : expiring.slice(0, preferences?.notifications.dailyLimit ?? 3);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div className="notif" ref={ref}>
      <button type="button" className="icon-btn notif-btn" aria-expanded={open} aria-controls="notif-panel" aria-label={`Notifications, ${items.length} new`} onClick={() => setOpen((v) => !v)}>
        <Bell aria-hidden />
        {items.length > 0 && <span className="notif-count" aria-hidden>{items.length}</span>}
      </button>
      {open && (
        <div id="notif-panel" className="notif-panel" role="region" aria-label="Notifications">
          <p className="notif-title">Reminders</p>
          {items.length === 0 ? (
            <p className="muted">No reminders right now.</p>
          ) : (
            <ul>
              {items.map((o) => (
                <li key={o.id}>
                  <button type="button" className="link-btn" onClick={() => { setOpen(false); d.openReward(o.id); }}>
                    <strong>{d.brand(o.brandId)?.name}</strong> {o.benefit.summary}. Expires {shortDate(o.expiresAt)}.
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="notif-foot">Shown in the app only. Push and email delivery aren’t connected in this prototype. <Link to="/app/profile/notifications" onClick={() => setOpen(false)}>Settings</Link></p>
        </div>
      )}
    </div>
  );
}
