import type { Brand, Offer } from '@shared/types';
import { AlertTriangle, FlaskConical, Heart, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { daysUntil, expiryPhrase, money } from '../lib/format';

/** The Perkly mark: a swing tag, tilted, the way a perk hangs from something you already own. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <g transform="rotate(-8 16 16)">
        <path d="M9 6.5h9.6L25.5 13.4V25.5a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1z" fill="var(--forest)" />
        <circle cx="19.4" cy="11.4" r="2.1" fill="var(--bg)" />
        <path d="M12.5 21.5h8" stroke="var(--champagne)" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Logo({ to = '/', label = 'Perkly home' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="logo" aria-label={label}>
      <Mark />
      <span className="logo-word">Perkly</span>
    </Link>
  );
}

export function DemoTag({ children = 'Demo data' }: { children?: ReactNode }) {
  return (
    <span className="demo-tag">
      <FlaskConical aria-hidden />
      {children}
    </span>
  );
}

export function Switch(p: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; describedBy?: string }) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={p.checked}
      aria-label={p.label}
      aria-describedby={p.describedBy}
      disabled={p.disabled}
      onClick={() => p.onChange(!p.checked)}
    />
  );
}

export function SwitchRow(p: { id: string; label: string; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="switch-row">
      <div>
        <div className="label" id={`${p.id}-l`}>{p.label}</div>
        {p.hint && <div className="hint" id={`${p.id}-h`}>{p.hint}</div>}
      </div>
      <Switch checked={p.checked} onChange={p.onChange} label={p.label} disabled={p.disabled} describedBy={p.hint ? `${p.id}-h` : undefined} />
    </div>
  );
}

/** One reward as an editorial line: brand, benefit as a headline, then the facts. */
export function RewardRow(p: {
  offer: Offer;
  brand?: Brand;
  reason?: string;
  warning?: string;
  favorite?: boolean;
  onFavorite?: () => void;
  onOpen: () => void;
  size?: 'feature' | 'row' | 'tile';
  showNearby?: boolean;
  status?: string;
}) {
  const { offer, brand } = p;
  const urgent = daysUntil(offer.expiresAt) <= 3;
  const name = brand?.name ?? offer.brandId;
  return (
    <article className={`rrow rrow-${p.size ?? 'row'}`}>
      <div className="rrow-brand">
        <span className={`monogram ${p.size === 'feature' ? 'lg' : ''}`} aria-hidden>{brand?.monogram}</span>
        <span className="rrow-name">{name}</span>
        {offer.sponsored && <span className="tag">Sponsored</span>}
        {p.status && <span className="tag rrow-status">{p.status}</span>}
      </div>
      <h3 className="rrow-head display">
        <button type="button" className="rrow-open" onClick={p.onOpen}>
          {offer.headline}
        </button>
      </h3>
      {p.reason && <p className="rrow-why">{p.reason}</p>}
      <p className="rrow-facts">
        <span className={urgent ? 'is-urgent' : ''}>
          {urgent && <AlertTriangle aria-hidden />}
          {expiryPhrase(offer.expiresAt)}
        </span>
        <span>{offer.minSpend != null ? `Min. spend ${money(offer.minSpend)}` : 'No minimum spend'}</span>
        {p.showNearby && offer.nearby && (
          <span><MapPin aria-hidden /> {offer.nearby.distanceMeters} m away</span>
        )}
      </p>
      {p.warning && (
        <p className="rrow-warn"><AlertTriangle aria-hidden /> {p.warning}</p>
      )}
      <div className="rrow-actions">
        <button type="button" className="btn btn-sm" onClick={p.onOpen} aria-label={`View reward: ${offer.headline}, ${name}`}>
          View reward
        </button>
        {p.onFavorite && (
          <button
            type="button"
            className="fav"
            aria-pressed={!!p.favorite}
            aria-label={p.favorite ? `Remove from favorites: ${offer.headline}` : `Save to favorites: ${offer.headline}`}
            onClick={p.onFavorite}
          >
            <Heart aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}

export function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className="skeleton-rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'grid', gap: 10 }}>
            <div className="skeleton" style={{ height: 22, width: '70%' }} />
            <div className="skeleton" style={{ height: 14, width: '45%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-danger" role="alert">
      <AlertTriangle aria-hidden />
      <div>
        <strong>{message}</strong>
        {onRetry && (
          <div className="notice-actions">
            <button type="button" className="btn btn-sm" onClick={onRetry}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
