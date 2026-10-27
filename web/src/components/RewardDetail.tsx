import type { Brand, Channel, Offer, RewardUse } from '@shared/types';
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, Globe, Heart, Store, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useId, useState } from 'react';
import { daysUntil, fullDate, money, shortDate } from '../lib/format';
import { DemoTag } from './bits';

export interface RewardDetailProps {
  offer: Offer;
  brand: Brand;
  reasons?: string[];
  warnings?: string[];
  favorite?: { active: boolean; toggle: () => void };
  /** Records the use once the partner reports it. Simulated in this prototype. */
  onUse: (channel: Channel) => Promise<RewardUse>;
  onClose?: () => void;
  headingId?: string;
  /** Inline renders inside the landing page instead of a dialog. */
  variant?: 'sheet' | 'inline';
}

type Mode = 'details' | Channel;

export function RewardDetail(props: RewardDetailProps) {
  const { offer, brand, variant = 'sheet' } = props;
  const uid = useId();
  const headingId = props.headingId ?? `${uid}-h`;
  const [mode, setMode] = useState<Mode>('details');
  const [done, setDone] = useState<RewardUse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = daysUntil(offer.expiresAt);
  const urgent = days <= 3;
  const online = offer.valid.channels.includes('online');
  const inStore = offer.valid.channels.includes('in_store');
  const notValid = [...offer.notValid.exclusions, ...offer.notValid.locations, ...offer.notValid.transactions];

  async function confirm(channel: Channel) {
    setBusy(true);
    setError(null);
    try {
      setDone(await props.onUse(channel));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setMode('details');
    setDone(null);
    setError(null);
  }

  return (
    <article className={`reward reward-${variant}`} aria-labelledby={headingId}>
      <header className="reward-top">
        <div className="reward-brand">
          <span className="monogram" aria-hidden>{brand.monogram}</span>
          <div>
            <div className="reward-brand-name">{brand.name}</div>
            <div className="reward-brand-sub">Perkly partner</div>
          </div>
        </div>
        <div className="reward-top-actions">
          <DemoTag />
          {offer.sponsored && <span className="tag" title="Sponsored rewards are ranked like any other.">Sponsored</span>}
          {props.favorite && (
            <button
              type="button"
              className="fav"
              aria-pressed={props.favorite.active}
              aria-label={props.favorite.active ? `Remove ${brand.name} reward from favorites` : `Save ${brand.name} reward to favorites`}
              onClick={props.favorite.toggle}
            >
              <Heart aria-hidden />
            </button>
          )}
          {props.onClose && (
            <button type="button" className="icon-btn" aria-label="Close reward" onClick={props.onClose}>
              <X aria-hidden />
            </button>
          )}
        </div>
      </header>

      {mode === 'details' ? (
        <>
          <div className="reward-body">
            <section className="reward-hero">
              <h2 id={headingId} className="display reward-headline">{offer.headline}</h2>
              <div className="reward-meta">
                <span className={`reward-expiry ${urgent ? 'is-urgent' : ''}`}>
                  {urgent && <AlertTriangle aria-hidden />}
                  {days <= 0 ? 'Expires today' : `Expires ${fullDate(offer.expiresAt)}`}
                  {days > 0 && <span className="muted"> ({days} {days === 1 ? 'day' : 'days'} left)</span>}
                </span>
                <span className="reward-channels">
                  {online && <span className="tag"><Globe aria-hidden /> Online</span>}
                  {inStore && <span className="tag"><Store aria-hidden /> In store</span>}
                </span>
              </div>
              {!!props.reasons?.length && (
                <ul className="reward-why" aria-label="Why this reward">
                  {props.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
              {!!props.warnings?.length && (
                <ul className="reward-warnings">
                  {props.warnings.map((w) => <li key={w}><AlertTriangle aria-hidden /> {w}</li>)}
                </ul>
              )}
            </section>

            <div className="terms" role="group" aria-label="Reward conditions">
              <section className="term">
                <h3>What you get</h3>
                <p className="term-lead">{offer.benefit.summary}</p>
                <p className="term-line">
                  <span className="term-label">Estimated value</span>
                  {offer.valueEstimate.amount != null ? `${money(offer.valueEstimate.amount)}. ` : 'Not available. '}
                  <span className="muted">{offer.valueEstimate.basis}</span>
                </p>
              </section>

              <section className="term">
                <h3>What you pay</h3>
                <p className="term-lead">{offer.youPay.summary}</p>
                <p className="term-line">
                  <span className="term-label">Minimum spend</span>
                  {offer.minSpend != null ? money(offer.minSpend) : 'None'}
                </p>
                <p className="term-line">
                  <span className="term-label">Known fees</span>
                  {offer.youPay.knownFees.length ? offer.youPay.knownFees.join('. ') + '.' : 'None disclosed.'}
                </p>
                {offer.youPay.feesUnknown && <p className="term-line is-flag">Some prices or fees weren’t disclosed by the brand.</p>}
              </section>

              <section className="term">
                <h3>What is valid</h3>
                <ul className="term-list">
                  {offer.valid.items.map((x) => <li key={x}>{x}</li>)}
                  {offer.valid.locations.map((x) => <li key={x}>{x}</li>)}
                </ul>
                <p className="term-line"><span className="term-label">Dates</span>{shortDate(offer.validFrom)} to {fullDate(offer.expiresAt)}</p>
                <p className="term-line"><span className="term-label">Who can use it</span>{offer.valid.who.join('. ')}</p>
              </section>

              <section className="term term-not">
                <h3>What is not valid</h3>
                <ul className="term-list">
                  {notValid.map((x) => <li key={x}>{x}</li>)}
                </ul>
                <p className="term-line"><span className="term-label">Combining offers</span>{offer.notValid.stacking}</p>
              </section>

              <section className="term term-how">
                <h3>How to use it</h3>
                <div className="how-grid">
                  {online && (
                    <p className="term-line"><span className="term-label"><Globe aria-hidden /> Online</span>{offer.howToUse.online}</p>
                  )}
                  {inStore && (
                    <p className="term-line"><span className="term-label"><Store aria-hidden /> In store</span>{offer.howToUse.inStore}</p>
                  )}
                  <p className="term-line"><span className="term-label">When you get it</span>{offer.howToUse.whenYouGetIt}</p>
                </div>
                <p className="terms-link">
                  <ExternalLink aria-hidden />
                  {offer.termsUrl ? <a href={offer.termsUrl} target="_blank" rel="noreferrer">{brand.name}’s full terms</a> : 'The brand’s full terms aren’t available for demo rewards.'}
                </p>
              </section>
            </div>
          </div>

          <footer className="reward-action">
            <p className="action-note">You pay {brand.name} directly. Perkly may earn a commission; it never changes rankings.</p>
            <div className="action-buttons">
              {online && (
                <button type="button" className="btn btn-primary btn-lg" onClick={() => setMode('online')}>
                  <Globe aria-hidden />
                  {inStore ? 'Use Reward online' : 'Use Reward'}
                </button>
              )}
              {inStore && (
                <button type="button" className={`btn btn-lg ${online ? 'btn-ink' : 'btn-primary'}`} onClick={() => setMode('in_store')}>
                  <Store aria-hidden />
                  {online ? 'Use Reward in store' : 'Use Reward'}
                </button>
              )}
            </div>
          </footer>
        </>
      ) : (
        <div className="reward-body reward-use">
          <button type="button" className="btn btn-quiet btn-sm use-back" onClick={back}>
            <ArrowLeft aria-hidden /> Back to the conditions
          </button>
          <h2 id={headingId} className="visually-hidden">{offer.headline}</h2>
          {done ? (
            <UseDone use={done} offer={offer} brand={brand} onClose={props.onClose ?? back} />
          ) : mode === 'online' ? (
            <OnlineHandoff offer={offer} brand={brand} busy={busy} onConfirm={() => confirm('online')} />
          ) : (
            <InStoreCode offer={offer} brand={brand} busy={busy} onConfirm={() => confirm('in_store')} />
          )}
          {error && (
            <div className="notice notice-danger" role="alert">
              <AlertTriangle aria-hidden />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function OnlineHandoff({ offer, brand, busy, onConfirm }: { offer: Offer; brand: Brand; busy: boolean; onConfirm: () => void }) {
  const host = offer.redemption.url ? new URL(offer.redemption.url).host : brand.website;
  return (
    <div className="use-panel">
      <p className="display use-title">Continue to {brand.name}</p>
      <p className="use-lede">
        {offer.redemption.codeAutoAppliedOnline
          ? `Perkly opens ${host} with your member code already applied. You check out and pay there as usual.`
          : `Perkly opens ${host}. Enter your member code at checkout.`}
      </p>
      <dl className="use-facts">
        <div><dt>Destination</dt><dd className="tabular">{host}</dd></div>
        <div><dt>Member code</dt><dd><code className="coupon-sm">{offer.redemption.code}</code>{offer.redemption.codeAutoAppliedOnline && <span className="muted"> applied for you</span>}</dd></div>
        <div><dt>Reminder</dt><dd>{offer.minSpend != null ? `Spend at least ${money(offer.minSpend)}. ` : ''}{offer.notValid.exclusions[0] ? `Not valid on ${offer.notValid.exclusions[0].toLowerCase()}.` : ''}</dd></div>
      </dl>
      <div className="notice">
        <DemoTag>Simulated</DemoTag>
        <span>
          Demo partner sites don’t exist, so nothing opens. In the live product you’d land on {brand.name}’s checkout, and {brand.name} would
          tell Perkly when your order goes through.
        </span>
      </div>
      <button type="button" className="btn btn-primary btn-lg use-confirm" onClick={onConfirm} disabled={busy}>
        {busy && <span className="spinner" aria-hidden />}
        Simulate an order on {host}
      </button>
    </div>
  );
}

function InStoreCode({ offer, brand, busy, onConfirm }: { offer: Offer; brand: Brand; busy: boolean; onConfirm: () => void }) {
  const [svg, setSvg] = useState('');
  const [copied, setCopied] = useState(false);
  const code = offer.redemption.code;
  useEffect(() => {
    QRCode.toString(code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2B211B', light: '#FFFCF6' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [code]);
  return (
    <div className="use-panel use-instore">
      <p className="display use-title">Show this at {brand.name}</p>
      <p className="use-lede">{offer.howToUse.inStore} You pay {brand.name} at the register as usual.</p>
      <div className="qr-block">
        {svg ? <div className="qr" role="img" aria-label={`QR code for member code ${code}`} dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="qr skeleton" />}
        <div className="qr-code">
          <span className="term-label">Member code</span>
          <code className="coupon tabular">{code}</code>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              navigator.clipboard?.writeText(code).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                },
                () => undefined,
              )
            }
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </div>
      </div>
      {offer.minSpend != null && <p className="use-reminder">Remember: spend at least {money(offer.minSpend)}.</p>}
      <div className="notice">
        <DemoTag>Simulated</DemoTag>
        <span>Demo code. It won’t work at a real store. In the live product, {brand.name}’s register would confirm the scan to Perkly.</span>
      </div>
      <button type="button" className="btn btn-primary btn-lg use-confirm" onClick={onConfirm} disabled={busy}>
        {busy && <span className="spinner" aria-hidden />}
        Simulate the cashier scanning it
      </button>
    </div>
  );
}

function UseDone({ use, offer, brand, onClose }: { use: RewardUse; offer: Offer; brand: Brand; onClose: () => void }) {
  return (
    <div className="use-panel result is-ok" role="status" aria-live="polite">
      <div className="result-mark" aria-hidden><Check /></div>
      <p className="display result-title">Reward used</p>
      <p className="result-msg">
        {brand.name} reported your {use.channel === 'online' ? 'order' : 'purchase'} to Perkly. This was simulated: no real purchase was made.
      </p>
      <dl className="breakdown tabular">
        <div><dt>Reward</dt><dd>{offer.benefit.summary}</dd></div>
        <div><dt>Used</dt><dd>{use.channel === 'online' ? 'Online' : 'In store'}</dd></div>
        <div className="total"><dt>Estimated saving</dt><dd>{use.estimatedSaving != null ? money(use.estimatedSaving) : 'Not known'}</dd></div>
      </dl>
      <p className="muted">The estimate comes from the offer’s stated value. Your receipt from {brand.name} shows the exact amount.</p>
      <div className="result-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
