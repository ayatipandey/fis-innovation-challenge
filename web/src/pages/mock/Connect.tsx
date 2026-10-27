import { programById } from '@shared/demo-data';
import { Check, FlaskConical, Lock, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../../lib/api';
import type { ProgramsResponse } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { useSession } from '../../state/session';

const safeReturn = (r: string | null) => (r && r.startsWith('/') && !r.startsWith('//') ? r : '/app/profile/programs');

/**
 * A stand-in for the program's own consent screen. In the real app this is the
 * bank's or brand's site (OAuth or open-banking consent); here it's a sample.
 */
export function Connect() {
  const { programId = '' } = useParams();
  const [params] = useSearchParams();
  const back = safeReturn(params.get('return'));
  const program = programById(programId);
  const navigate = useNavigate();
  const { preferences } = useSession();
  const { data } = useApi<ProgramsResponse>('/me/programs');
  const existing = data?.programs.find((p) => p.program.id === programId)?.link;
  const [history, setHistory] = useState(true);
  const [visits, setVisits] = useState(true);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = program ? `Connect to Perkly · ${program.issuer} (sample)` : 'Program not found';
  }, [program]);
  useEffect(() => {
    if (existing) {
      setHistory(existing.shares.history);
      setVisits(existing.shares.visits);
    }
  }, [existing]);

  if (!program) {
    return (
      <div className="mock-page"><main className="mock-card"><h1>Program not found</h1><Link to={back}>Back to Perkly</Link></main></div>
    );
  }
  const domain = `connect.${program.issuer.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}.example`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!agree) {
      setError('Tick the box to allow read-only access, or cancel.');
      document.getElementById('cx-agree')?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/me/programs/${program!.id}/link`, { method: 'POST', body: { shareHistory: history, shareVisits: visits, agree: true } });
      navigate(back, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t connect. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className={`mock-page brand-${program.id}`}>
      <div className="mock-bar" aria-hidden>
        <Lock /> <span>{domain}</span>
      </div>
      <p className="mock-banner" role="note">
        <FlaskConical aria-hidden /> Sample program site. In the real app, this is {program.issuer}’s own sign-in and consent screen, reached through its API.
      </p>
      <main className="mock-card">
        <header className="mock-brand">
          <span className={`monogram lg pm-${program.id}`} aria-hidden>{program.monogram}</span>
          <div>
            <p className="mock-issuer">{program.issuer}</p>
            <p className="mock-signed">Signed in as {preferences?.displayName || 'you'} · sample account</p>
          </div>
        </header>
        <h1 className="mock-h">Perkly would like read-only access to {program.name}</h1>
        <form onSubmit={submit} className="mock-form">
          <section>
            <h2>Always shared</h2>
            <ul className="mock-list">
              <li><Check aria-hidden /> Your {program.unit} balance</li>
              <li><Check aria-hidden /> When your {program.unit} expire</li>
              <li><Check aria-hidden /> The rewards your {program.unit} can buy</li>
            </ul>
          </section>
          <section>
            <h2>You choose</h2>
            <label className="checkbox">
              <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
              <span>
                <strong>Purchase history, last 90 days</strong>
                <span className="hint">Where, when and how much. Perkly uses it to learn your habits, like coffee on weekday mornings.</span>
              </span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={visits} onChange={(e) => setVisits(e.target.checked)} />
              <span>
                <strong>Store visits</strong>
                <span className="hint">Which locations you redeem at, so Perkly knows the shops you use.</span>
              </span>
            </label>
          </section>
          <section>
            <h2>Never shared</h2>
            <ul className="mock-list is-never">
              <li><X aria-hidden /> Card numbers, passwords or PINs</li>
              <li><X aria-hidden /> The ability to move money or spend {program.unit} without your tap</li>
            </ul>
          </section>
          <label className="checkbox mock-agree">
            <input id="cx-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} aria-describedby={error ? 'cx-err' : undefined} />
            <span>I allow Perkly to read this information. I can unlink at any time from Perkly or from {program.issuer}.</span>
          </label>
          {error && <p id="cx-err" className="form-error" role="alert">{error}</p>}
          <div className="mock-actions">
            <button type="submit" className="mock-btn" disabled={busy}>{existing ? 'Save sharing choices' : 'Allow read-only access'}</button>
            <Link to={back} className="mock-cancel">Cancel and go back to Perkly</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
