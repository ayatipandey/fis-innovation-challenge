import { optionById } from '@shared/demo-data';
import type { Moment, Rating } from '@shared/types';
import { BellOff, BellRing } from 'lucide-react';
import { useState } from 'react';
import { ApiError, api } from '../lib/api';
import { timeOfDay } from '../lib/format';
import { Mark, ProgramMark } from './bits';

const RATINGS: { id: Rating; label: string }[] = [
  { id: 'good', label: 'Good' },
  { id: 'fine', label: 'Fine' },
  { id: 'bad', label: 'Bad' },
];

/** A notification as it would land on the phone, with why it was (or wasn't) sent. */
export function MomentCard(p: { moment: Moment; onUse?: (optionId: string) => void; onRated?: (m: Moment) => void; compact?: boolean; timeLabel?: string }) {
  const [m, setM] = useState(p.moment);
  const [error, setError] = useState<string | null>(null);
  const option = optionById(m.optionId);

  async function rate(r: Rating) {
    setError(null);
    try {
      const res = await api<{ moment: Moment; message: string }>(`/me/moments/${m.id}/rate`, { method: 'POST', body: { rating: r } });
      setM(res.moment);
      p.onRated?.(res.moment);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn’t save that. Try again.');
    }
  }

  const lift = Math.round(m.uplift * 100);
  return (
    <article className={`moment ${m.sent ? 'is-sent' : 'is-held'} ${p.compact ? 'is-compact' : ''}`}>
      <div className="moment-status">
        {m.sent ? <BellRing aria-hidden /> : <BellOff aria-hidden />}
        <span>{m.sent ? 'Sent' : 'Not sent'}</span>
        <span className="moment-time">{p.timeLabel ?? timeOfDay(m.at)}</span>
      </div>
      <div className="notif">
        <span className="notif-app"><Mark size={20} /> Perkly</span>
        <div className="notif-main">
          {option && <ProgramMark programId={option.programId} size="sm" />}
          <div>
            <p className="notif-title">{m.title}</p>
            <p className="notif-body">{m.body}</p>
          </div>
        </div>
      </div>
      {!m.sent && m.suppressedBecause && <p className="moment-why-not">{m.suppressedBecause}</p>}
      {!p.compact && (
        <details className="moment-why">
          <summary>Why {m.sent ? 'now' : 'not'}</summary>
          <ul>
            {m.reasons.filter((r) => !r.startsWith('Model:')).map((r) => <li key={r}>{r}</li>)}
          </ul>
          <p className="moment-model tabular">
            Chance you’d use it: {Math.round(m.pIfNotified * 100)}% with a reminder, {Math.round(m.pIfNot * 100)}% without
            {lift !== 0 && <> ({lift > 0 ? '+' : ''}{lift} points)</>}.
          </p>
        </details>
      )}
      <div className="moment-actions">
        {m.sent && option && p.onUse && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => p.onUse!(m.optionId)}>Use it</button>
        )}
        {m.sent && (
          <div className="rate" role="group" aria-label="Rate this notification">
            <span className="rate-q">Was this useful?</span>
            {RATINGS.map((r) => (
              <button key={r.id} type="button" className="chip" aria-pressed={m.rating === r.id} onClick={() => rate(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {m.ratingMessage && <p className="rate-effect" role="status">{m.ratingMessage}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}
