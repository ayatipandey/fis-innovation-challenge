import { merchantById, optionById, programById } from '@shared/demo-data';
import type { Channel, Hold } from '@shared/types';
import { CheckCircle2, Clock, ExternalLink, Lock, QrCode, Store, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api, newKey } from '../lib/api';
import { countdown, money, points } from '../lib/format';
import { useToast } from '../state/toast';
import { DemoTag, ProgramMark } from './bits';
import { Dialog } from './Dialog';

function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Qr({ code }: { code: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B1A20', light: '#FFFFFF' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [code]);
  return <div className="qr" role="img" aria-label={`QR code for ${code}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** One-tap redemption: hold the points, show a code or go to the seller, confirm, done. */
export function RedeemDialog(p: { optionId: string | null; available?: number; hold?: Hold | null; onClose: () => void; onChanged?: () => void }) {
  const option = p.optionId ? optionById(p.optionId) : undefined;
  const program = option ? programById(option.programId) : undefined;
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow();
  const [channel, setChannel] = useState<Channel>('in_store');
  const [hold, setHold] = useState<Hold | null>(p.hold ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per opening: a double tap returns the same hold instead of a second one.
  const key = useMemo(() => newKey(), [p.optionId]);

  useEffect(() => {
    setHold(p.hold ?? null);
    setError(null);
    if (option) setChannel(option.channels.includes('in_store') ? 'in_store' : 'online');
  }, [p.optionId, p.hold]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!option || !program) return <Dialog open={false} onClose={p.onClose} labelledBy="rd-h"><span /></Dialog>;
  const merchant = merchantById(option.merchantIds[0] ?? null);
  const place = merchant?.name.split(',')[0] ?? program.issuer;
  const unit = program.unit;
  const short = p.available != null && p.available < option.cost;

  async function placeHold() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ hold: Hold }>('/me/holds', { method: 'POST', body: { optionId: option!.id, channel, idempotencyKey: key } });
      setHold(r.hold);
      p.onChanged?.();
      if (channel === 'online') {
        p.onClose();
        navigate(`/checkout/${r.hold.id}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn’t place the hold. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resolve(action: 'confirm' | 'release') {
    if (!hold) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ hold: Hold }>(`/me/holds/${hold.id}/${action}`, { method: 'POST' });
      setHold(r.hold);
      p.onChanged?.();
      if (action === 'release') toast(`${points(hold.points, unit)} are available again.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const held = hold?.status === 'held';
  return (
    <Dialog open={Boolean(p.optionId)} onClose={p.onClose} labelledBy="rd-h" className="redeem-modal">
      <div className="redeem">
        <header className="redeem-head">
          <ProgramMark programId={program.id} size="lg" />
          <div className="redeem-title">
            <p className="redeem-program">{program.name} <DemoTag /></p>
            <h2 id="rd-h" className="display">{option.title}</h2>
            <p className="redeem-value tabular">
              <strong>{money(option.value)}</strong> value for <strong>{points(option.cost, unit)}</strong>
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={p.onClose} aria-label="Close">
            <X aria-hidden />
          </button>
        </header>

        {!hold && (
          <div className="redeem-body">
            <dl className="terms">
              <div>
                <dt>Minimum spend</dt>
                <dd>{option.minSpend != null ? money(option.minSpend) : 'None'}</dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>{option.valueBasis}</dd>
              </div>
              <div>
                <dt>Works on</dt>
                <dd><ul>{option.valid.map((v) => <li key={v}>{v}</li>)}</ul></dd>
              </div>
              <div>
                <dt>Doesn’t cover</dt>
                <dd><ul>{option.notValid.map((v) => <li key={v}>{v}</li>)}</ul></dd>
              </div>
              <div>
                <dt>Combining</dt>
                <dd>{option.stacking}</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>{option.merchantIds.length ? option.merchantIds.map((id) => merchantById(id)?.name).join(' · ') : 'Online, from your program account'}</dd>
              </div>
            </dl>

            {option.channels.length > 1 && (
              <div className="seg" role="group" aria-label="How do you want to use it?">
                {option.channels.map((c) => (
                  <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)}>
                    {c === 'in_store' ? <Store aria-hidden /> : <ExternalLink aria-hidden />}
                    {c === 'in_store' ? 'In store' : 'Online'}
                  </button>
                ))}
              </div>
            )}
            <p className="redeem-how">{channel === 'in_store' ? option.howToUse.inStore : option.howToUse.online}</p>

            <p className="redeem-hold-note">
              <Lock aria-hidden />
              Perkly holds these {unit} for 2 hours so they can’t be spent twice. They’re only used when {program.issuer} confirms the purchase. If it doesn’t, they come back.
            </p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={placeHold} disabled={busy || short}>
              {channel === 'in_store' ? <QrCode aria-hidden /> : <ExternalLink aria-hidden />}
              {short
                ? `You need ${points(option.cost - (p.available ?? 0), unit)} more`
                : channel === 'in_store'
                  ? `Hold ${points(option.cost, unit)} and show my code`
                  : `Hold ${points(option.cost, unit)} and go to ${place}`}
            </button>
          </div>
        )}

        {hold && held && hold.channel === 'in_store' && (
          <div className="redeem-body redeem-code">
            <Qr code={hold.code} />
            <div className="redeem-code-side">
              <p className="code tabular" aria-label={`Code ${hold.code.split('').join(' ')}`}>{hold.code}</p>
              <p>Show this at the counter at {place}.</p>
              <p className="hold-timer"><Clock aria-hidden /> {points(hold.points, unit)} on hold · {countdown(hold.expiresAt, now)} left</p>
              <div className="demo-box">
                <p><strong>In the demo</strong> there’s no cashier, so you play the shop.</p>
                <button type="button" className="btn btn-primary btn-block" onClick={() => resolve('confirm')} disabled={busy}>
                  <CheckCircle2 aria-hidden /> The cashier scanned it
                </button>
              </div>
              <button type="button" className="btn btn-quiet btn-block" onClick={() => resolve('release')} disabled={busy}>
                Cancel and release the {unit}
              </button>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
          </div>
        )}

        {hold && held && hold.channel === 'online' && (
          <div className="redeem-body">
            <p className="hold-timer"><Clock aria-hidden /> {points(hold.points, unit)} on hold · {countdown(hold.expiresAt, now)} left</p>
            <div className="redeem-actions">
              <button type="button" className="btn btn-primary" onClick={() => { p.onClose(); navigate(`/checkout/${hold.id}`); }}>
                <ExternalLink aria-hidden /> Continue to {place}
              </button>
              <button type="button" className="btn" onClick={() => resolve('release')} disabled={busy}>Release the {unit}</button>
            </div>
          </div>
        )}

        {hold && !held && (
          <div className="redeem-body redeem-done" role="status">
            <CheckCircle2 aria-hidden className={hold.status === 'confirmed' ? 'ok' : ''} />
            {hold.status === 'confirmed' ? (
              <>
                <h3 className="display">Done. You saved {money(option.value)}.</h3>
                <p>{program.issuer} confirmed it, so {points(hold.points, unit)} were used, soonest-expiring first.</p>
              </>
            ) : (
              <>
                <h3 className="display">{hold.status === 'expired' ? 'The hold expired' : 'Released'}</h3>
                <p>{points(hold.points, unit)} are back in your balance.</p>
              </>
            )}
            <button type="button" className="btn" onClick={p.onClose}>Close</button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
