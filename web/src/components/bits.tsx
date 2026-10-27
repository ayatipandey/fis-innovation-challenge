import { programById } from '@shared/demo-data';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** The Perkly mark: a coin with a spark, the moment a balance turns into something. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <circle cx="16" cy="16" r="13" fill="var(--action)" />
      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--text)" strokeOpacity="0.18" />
      <path d="M16 8.5l1.9 5.6 5.6 1.9-5.6 1.9L16 23.5l-1.9-5.6L8.5 16l5.6-1.9z" fill="var(--action-ink)" />
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

export function DemoTag({ children = 'Sample data' }: { children?: ReactNode }) {
  return (
    <span className="demo-tag">
      <FlaskConical aria-hidden />
      {children}
    </span>
  );
}

export function ProgramMark({ programId, size }: { programId: string; size?: 'sm' | 'lg' }) {
  const p = programById(programId);
  return (
    <span className={`monogram ${size ?? ''} pm-${programId}`} aria-hidden>
      {p?.monogram ?? '?'}
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

export function PageHead({ title, lede, children }: { title: string; lede?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-h display">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {children && <div className="page-head-aside">{children}</div>}
    </header>
  );
}
