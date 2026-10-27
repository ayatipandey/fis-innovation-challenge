import { merchantById, optionById, programById } from '@shared/demo-data';
import type { Hold } from '@shared/types';
import { CheckCircle2, Clock, FlaskConical, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../../lib/api';
import { countdown, money } from '../../lib/format';
import { useApi } from '../../lib/useApi';

/** A stand-in for the seller's site after Perkly's redirect, with the points already applied. */
export function Checkout() {
  const { holdId = '' } = useParams();
  const { data, error: loadErr } = useApi<{ holds: Hold[] }>('/me/holds');
  const [hold, setHold] = useState<Hold | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = data?.holds.find((x) => x.id === holdId);
    if (h) setHold(h);
  }, [data, holdId]);

  const option = hold ? optionById(hold.optionId) : undefined;
  const program = option ? programById(option.programId) : undefined;
  const merchant = option ? merchantById(option.merchantIds[0] ?? null) : undefined;
  const seller = merchant?.name.split(',')[0] ?? program?.issuer ?? 'Seller';

  useEffect(() => {
    document.title = `Checkout · ${seller} (sample)`;
  }, [seller]);

  if (loadErr) return <div className="mock-page"><main className="mock-card"><p role="alert">{loadErr}</p><Link to="/app">Back to Perkly</Link></main></div>;
  if (!data) return <div className="mock-page"><main className="mock-card" aria-busy="true">Loading checkout…</main></div>;
  if (!hold || !option || !program) {
    return <div className="mock-page"><main className="mock-card"><h1 className="mock-h">This checkout link isn’t valid</h1><Link to="/app">Back to Perkly</Link></main></div>;
  }

  const free = /^A free/.test(option.title);
  const subtotal = option.minSpend ? option.minSpend + 4.5 : free ? option.value : option.value + 3.9;
  const total = Math.max(0, subtotal - option.value);
  const domain = option.url ? new URL(option.url).host : `${program.issuer.toLowerCase().replace(/[^a-z]+/g, '-')}.example`;

  async function act(action: 'confirm' | 'release') {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ hold: Hold }>(`/me/holds/${hold!.id}/${action}`, { method: 'POST' });
      setHold(r.hold);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`mock-page brand-${program.id}`}>
      <div className="mock-bar" aria-hidden><Lock /> <span>{domain}/checkout</span></div>
      <p className="mock-banner" role="note">
        <FlaskConical aria-hidden /> Sample seller site. Perkly sent you here with the points already applied. Nothing is charged.
      </p>
      <main className="mock-card">
        <header className="mock-brand">
          <span className={`monogram lg pm-${program.id}`} aria-hidden>{program.monogram}</span>
          <div>
            <p className="mock-issuer">{seller}</p>
            <p className="mock-signed">Checkout</p>
          </div>
        </header>

        {hold.status === 'held' && (
          <>
            <h1 className="mock-h">Review your order</h1>
            <table className="mock-order tabular">
              <tbody>
                <tr><th scope="row">{free ? option.title.replace(/^A free /, '').replace(/^./, (c) => c.toUpperCase()) : 'Your order'}</th><td>{money(subtotal)}</td></tr>
                <tr className="is-applied"><th scope="row">{option.title} · {hold.points.toLocaleString('en-US')} {program.unit} via Perkly</th><td>−{money(option.value)}</td></tr>
                <tr className="is-total"><th scope="row">Total</th><td>{money(total)}</td></tr>
              </tbody>
            </table>
            <p className="mock-hold"><Clock aria-hidden /> Your {program.unit} are on hold for {countdown(hold.expiresAt)}. They’re used only when this order goes through.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="mock-actions">
              <button type="button" className="mock-btn" onClick={() => act('confirm')} disabled={busy}>Place order (sample)</button>
              <button type="button" className="mock-cancel as-btn" onClick={() => act('release')} disabled={busy}>Cancel and release the {program.unit}</button>
            </div>
          </>
        )}

        {hold.status === 'confirmed' && (
          <div className="mock-done" role="status">
            <CheckCircle2 aria-hidden />
            <h1 className="mock-h">Order placed</h1>
            <p>{program.issuer} confirmed it, so {hold.points.toLocaleString('en-US')} {program.unit} were used and you saved {money(option.value)}.</p>
            <Link to="/app" className="mock-btn">Back to Perkly</Link>
          </div>
        )}

        {(hold.status === 'released' || hold.status === 'expired') && (
          <div className="mock-done" role="status">
            <h1 className="mock-h">{hold.status === 'expired' ? 'The hold expired' : 'Order cancelled'}</h1>
            <p>Your {hold.points.toLocaleString('en-US')} {program.unit} are back in your balance.</p>
            <Link to="/app" className="mock-btn">Back to Perkly</Link>
          </div>
        )}
      </main>
    </div>
  );
}
