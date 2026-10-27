import type { CategoryId, Channel, Offer } from '@shared/types';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, RewardRow, SkeletonRows, Switch } from '../../components/bits';
import { useData } from '../../state/data';
import { useSession } from '../../state/session';

type RewardType = 'all' | 'discount' | 'complimentary';
type Sort = 'match' | 'value' | 'expiry';
type Where = 'all' | Channel;

const TYPE_LABEL: Record<RewardType, string> = {
  all: 'All types',
  discount: 'Discounts',
  complimentary: 'Free items and extras',
};

const typeOf = (o: Offer): RewardType => (o.benefit.kind === 'amount_off' || o.benefit.kind === 'percent_off' ? 'discount' : 'complimentary');

function valueRatio(o: Offer) {
  if (o.valueEstimate.amount == null) return -1;
  return o.valueEstimate.amount / Math.max(o.minSpend ?? 1, 1);
}

function whereLabel(o: Offer) {
  const on = o.valid.channels.includes('online');
  const store = o.valid.channels.includes('in_store');
  return on && store ? 'Online and in store' : on ? 'Online' : 'In store';
}

export function Explore() {
  const d = useData();
  const { preferences } = useSession();
  const [params, setParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>((params.get('category') as CategoryId) ?? 'all');
  const [sub, setSub] = useState('all');
  const [type, setType] = useState<RewardType>('all');
  const [brand, setBrand] = useState<string | null>(params.get('brand'));
  const [favBrands, setFavBrands] = useState(false);
  const [saved, setSaved] = useState(params.get('saved') === '1');
  const [where, setWhere] = useState<Where>('all');
  const [nearby, setNearby] = useState(false);
  const [sort, setSort] = useState<Sort>('match');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const locationOn = !!preferences?.privacy.location;

  useEffect(() => {
    document.title = 'Explore · Perkly';
  }, []);
  useEffect(() => {
    if (params.get('focus') === 'search') {
      searchRef.current?.focus();
      params.delete('focus');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const catalog = d.catalog.status === 'ready' ? d.catalog.data : null;
  const wallet = d.wallet.status === 'ready' ? d.wallet.data : null;
  const recRank = useMemo(() => new Map((d.recs.status === 'ready' ? d.recs.data.items : []).map((r, i) => [r.offerId, i])), [d.recs]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const term = q.trim().toLowerCase();
    const now = Date.now();
    let list = catalog.offers.filter((o) => new Date(o.expiresAt).getTime() > now);
    if (term) {
      list = list.filter((o) => {
        const b = catalog.brands.find((x) => x.id === o.brandId);
        const cat = catalog.categories.find((c) => c.id === o.category);
        return [b?.name, cat?.label, o.subcategory, o.headline, o.benefit.summary, ...o.valid.items].some((s) => s?.toLowerCase().includes(term));
      });
    }
    if (category !== 'all') list = list.filter((o) => o.category === category);
    if (sub !== 'all') list = list.filter((o) => o.subcategory === sub);
    if (type !== 'all') list = list.filter((o) => typeOf(o) === type);
    if (brand) list = list.filter((o) => o.brandId === brand);
    if (favBrands) list = list.filter((o) => preferences?.favoriteBrands.includes(o.brandId));
    if (saved) list = list.filter((o) => wallet?.favorites.includes(o.id));
    if (where !== 'all') list = list.filter((o) => o.valid.channels.includes(where));
    if (nearby && locationOn) list = list.filter((o) => o.nearby);
    const sorted = [...list];
    if (sort === 'match') sorted.sort((a, b) => (recRank.get(a.id) ?? 999) - (recRank.get(b.id) ?? 999));
    if (sort === 'value') sorted.sort((a, b) => valueRatio(b) - valueRatio(a));
    if (sort === 'expiry') sorted.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, q, category, sub, type, brand, favBrands, saved, where, nearby, sort, recRank, wallet, preferences, locationOn]);

  const activeCount = [category !== 'all', sub !== 'all', type !== 'all', !!brand, favBrands, saved, where !== 'all', nearby].filter(Boolean).length;
  function clearAll() {
    setQ('');
    setCategory('all');
    setSub('all');
    setType('all');
    setBrand(null);
    setFavBrands(false);
    setSaved(false);
    setWhere('all');
    setNearby(false);
    setParams({}, { replace: true });
  }

  const subs = category !== 'all' ? catalog?.categories.find((c) => c.id === category)?.subcategories ?? [] : [];
  const brandName = brand ? catalog?.brands.find((b) => b.id === brand)?.name : null;
  const rec = (id: string) => (d.recs.status === 'ready' ? d.recs.data.items.find((r) => r.offerId === id) : undefined);

  return (
    <div className="page explore">
      <header className="page-head">
        <h1 className="display page-h">Explore</h1>
        <p className="page-lede">Every partner reward included with your membership, with the conditions up front.</p>
      </header>

      <div className="explore-bar">
        <div className="field search-field">
          <label htmlFor="ex-q" className="visually-hidden">Search rewards</label>
          <div className="control">
            <Search aria-hidden className="field-icon" />
            <input ref={searchRef} id="ex-q" type="search" placeholder="Search a brand, category, product, program or benefit" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="explore-sort">
          <label htmlFor="ex-sort" className="visually-hidden">Sort by</label>
          <select id="ex-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="match">Sort: Best match for you</option>
            <option value="value">Sort: Best value for the spend</option>
            <option value="expiry">Sort: Expiring soonest</option>
          </select>
          <button type="button" className="btn filters-toggle" aria-expanded={filtersOpen} aria-controls="ex-filters" onClick={() => setFiltersOpen((v) => !v)}>
            <SlidersHorizontal aria-hidden /> Filters{activeCount ? ` (${activeCount})` : ''}
          </button>
        </div>
      </div>

      <div className="chips-scroll cat-chips" role="group" aria-label="Category">
        <button type="button" className="chip" aria-pressed={category === 'all'} onClick={() => { setCategory('all'); setSub('all'); }}>All</button>
        {catalog?.categories.filter((c) => catalog.offers.some((o) => o.category === c.id)).map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={category === c.id} onClick={() => { setCategory(c.id); setSub('all'); }}>
            {c.label}
          </button>
        ))}
      </div>

      <div id="ex-filters" className={`explore-filters ${filtersOpen ? 'is-open' : ''}`}>
        {subs.length > 0 && (
          <div className="ef-item">
            <label htmlFor="ex-sub" className="ef-label">Subcategory</label>
            <select id="ex-sub" className="select" value={sub} onChange={(e) => setSub(e.target.value)}>
              <option value="all">All subcategories</option>
              {subs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div className="ef-item">
          <label htmlFor="ex-type" className="ef-label">Reward type</label>
          <select id="ex-type" className="select" value={type} onChange={(e) => setType(e.target.value as RewardType)}>
            {(Object.keys(TYPE_LABEL) as RewardType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <label className="ef-switch"><Switch checked={favBrands} onChange={setFavBrands} label="Favorite brands only" /> Favorite brands only</label>
        <label className="ef-switch"><Switch checked={saved} onChange={setSaved} label="Saved rewards only" /> Saved rewards only</label>
        <div className="ef-item">
          <label htmlFor="ex-where" className="ef-label">Where to use it</label>
          <select id="ex-where" className="select" value={where} onChange={(e) => setWhere(e.target.value as Where)}>
            <option value="all">Online or in store</option>
            <option value="online">Online</option>
            <option value="in_store">In store</option>
          </select>
        </div>
        <div className="ef-switch-wrap">
          <label className="ef-switch">
            <Switch checked={nearby && locationOn} onChange={setNearby} label="Nearby only" disabled={!locationOn} /> Nearby only
          </label>
          {!locationOn && <span className="hint"><Link to="/app/profile/privacy">Turn on location</Link> to filter by distance.</span>}
        </div>
      </div>

      <div className="result-bar" aria-live="polite">
        <span>
          {catalog ? `${results.length} ${results.length === 1 ? 'reward' : 'rewards'}` : 'Loading rewards'}
          {brandName && <> from <strong>{brandName}</strong></>}
        </span>
        {(activeCount > 0 || q) && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={clearAll}><X aria-hidden /> Clear filters</button>
        )}
      </div>

      {d.catalog.status === 'loading' ? (
        <SkeletonRows n={6} />
      ) : d.catalog.status === 'error' ? (
        <ErrorState message={`The catalog didn’t load. ${d.catalog.message}`} onRetry={() => window.location.reload()} />
      ) : results.length === 0 ? (
        <div className="empty">
          <h3>No rewards match</h3>
          <p>{q ? `Nothing matches “${q}” with these filters.` : 'Nothing matches these filters.'} Try a broader search or clear the filters.</p>
          <button type="button" className="btn" onClick={clearAll}>Clear filters</button>
        </div>
      ) : (
        <ul className="tile-grid">
          {results.map((o) => (
            <li key={o.id}>
              <RewardRow
                size="tile"
                offer={o}
                brand={catalog!.brands.find((b) => b.id === o.brandId)}
                reason={sort === 'match' ? rec(o.id)?.reasons[0] : undefined}
                warning={rec(o.id)?.warnings[0]}
                favorite={d.isFavorite(o.id)}
                onFavorite={() => d.toggleFavorite(o.id)}
                onOpen={() => d.openReward(o.id)}
                showNearby={locationOn}
                status={whereLabel(o)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
