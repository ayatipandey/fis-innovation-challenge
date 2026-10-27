import { computeCheckout } from '@shared/checkout';
import type { Brand, Offer, PaymentMethod, PaymentMethodKind, Program, RedemptionRecord } from '@shared/types';
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Copy,
  CreditCard,
  ExternalLink,
  Heart,
  Info,
  Landmark,
  Smartphone,
  Store,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { daysUntil, fullDate, money, shortDate } from '../lib/format';
import { DemoTag } from './bits';

export type Scenario = 'normal' | 'payment_declined' | 'reward_unavailable' | 'reversal_failed';
type Method = PaymentMethodKind | 'rewards_only';

export interface RedeemRequest {
  offerId: string;
  purchaseTotal: number;
  unitsApplied: number;
  method: Method | null;
  scenario: Scenario;
}

export interface EligibilityResult {
  status: 'eligible' | 'ineligible' | 'unknown';
  summary: string;
  checks: { rule: string; result: 'pass' | 'fail' | 'unknown'; reason: string }[];
}

export interface RewardDetailProps {
  offer: Offer;
  brand: Brand;
  /** The program used for split payment, when the offer supports it. */
  splitProgram?: Program;
  /** null when the user hasn't connected the program. */
  balance: number | null;
  paymentMethods: PaymentMethod[];
  reasons?: string[];
  warnings?: string[];
  activated: boolean;
  favorite?: { active: boolean; toggle: () => void };
  onActivate?: () => Promise<void>;
  onRedeem: (req: RedeemRequest) => Promise<RedemptionRecord>;
  onRecover?: (id: string) => Promise<RedemptionRecord>;
  checkEligibility?: (q: { offerId: string; paymentMethod?: PaymentMethodKind; purchaseTotal?: number; channel?: string }) => Promise<EligibilityResult>;
  onClose?: () => void;
  onDone?: () => void;
  headingId?: string;
  showScenario?: boolean;
  /** Showcase mode renders inline on the landing page. */
  variant?: 'sheet' | 'inline';
  initialMethod?: Method;
  /** Points pre-applied when the screen opens (landing demo). */
  initialUnits?: number;
}

const METHOD_META: Record<PaymentMethodKind, { label: string; icon: typeof CreditCard; hint: string }> = {
  apple_pay: { label: 'Apple Pay', icon: Smartphone, hint: 'Simulated in this prototype' },
  saved_card: { label: 'Saved card', icon: CreditCard, hint: 'Tokenized demo card' },
  online_banking: { label: 'Online banking', icon: Landmark, hint: 'Demo checking account' },
  in_store: { label: 'In store', icon: Store, hint: 'Cash or physical card at the register' },
};

const APPLIES_LABEL: Record<Offer['howToUse']['applies'], string> = {
  automatic: 'Applies automatically when you pay with an eligible method',
  at_checkout: 'Applied at checkout',
  code: 'Applied with a code',
  provider: 'Completed with the provider',
};

const CHANNEL_LABEL: Record<string, string> = { in_store: 'In store', online: 'Online', app: 'In the brand’s app' };

export function RewardDetail(props: RewardDetailProps) {
  const { offer, brand, splitProgram, balance, paymentMethods, variant = 'sheet' } = props;
  const uid = useId();
  const headingId = props.headingId ?? `${uid}-h`;
  const split = offer.redemption.split;
  const days = daysUntil(offer.expiresAt);
  const urgent = days <= 3;

  const [total, setTotal] = useState(offer.demoPurchaseTotal ?? offer.minSpend ?? 0);
  const [totalText, setTotalText] = useState((offer.demoPurchaseTotal ?? offer.minSpend ?? 0).toFixed(2));
  const [unitsApplied, setUnits] = useState(props.initialUnits ?? 0);
  const savedKinds = new Set(paymentMethods.map((m) => m.kind));
  const preferredKind = paymentMethods.find((m) => m.preferred)?.kind;
  const defaultMethod: Method | null =
    props.initialMethod ??
    (preferredKind && offer.redemption.methods.includes(preferredKind) ? preferredKind : null) ??
    offer.redemption.methods.find((m) => m !== 'in_store' && savedKinds.has(m)) ??
    null;
  const [method, setMethod] = useState<Method | null>(defaultMethod);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [busy, setBusy] = useState<'redeem' | 'activate' | 'recover' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedemptionRecord | null>(null);
  const [providerNote, setProviderNote] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elig, setElig] = useState<EligibilityResult | null>(null);

  const usableBalance = balance ?? 0;
  const breakdown = useMemo(
    () => computeCheckout(offer, { purchaseTotal: total, unitsApplied, balance: usableBalance, method }),
    [offer, total, unitsApplied, usableBalance, method],
  );

  // Keep the points within what the current total allows.
  useEffect(() => {
    if (unitsApplied > breakdown.maxUsableUnits) setUnits(breakdown.maxUsableUnits);
  }, [breakdown.maxUsableUnits, unitsApplied]);

  // When points cover everything, no second payment method is needed.
  useEffect(() => {
    if (breakdown.rewardsCoverAll && method !== 'rewards_only' && method !== 'in_store') setMethod('rewards_only');
    if (!breakdown.rewardsCoverAll && method === 'rewards_only') setMethod(defaultMethod === 'rewards_only' ? null : defaultMethod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown.rewardsCoverAll]);

  const { checkEligibility } = props;
  useEffect(() => {
    if (!checkEligibility || offer.redemption.providerOnly) return;
    const pm = method && method !== 'rewards_only' ? method : undefined;
    const channel = pm === 'in_store' ? 'in_store' : offer.valid.channels.includes('online') ? 'online' : offer.valid.channels[0];
    const t = setTimeout(() => {
      checkEligibility({ offerId: offer.id, paymentMethod: pm, purchaseTotal: total, channel })
        .then(setElig)
        .catch(() => setElig(null));
    }, 350);
    return () => clearTimeout(t);
  }, [checkEligibility, offer, method, total]);

  const needsActivation = offer.howToUse.activationRequired && !props.activated;
  const showCode = method === 'in_store' && !!offer.redemption.couponCode;
  const blocking = !breakdown.qualifies
    ? `Add ${money(breakdown.shortfall)} more to reach the ${money(offer.minSpend ?? 0)} minimum.`
    : breakdown.errors.find((e) => !e.startsWith('Choose how')) ?? null;
  const canUse = !offer.redemption.providerOnly && !needsActivation && !blocking && (breakdown.amountDue === 0 || method != null) && total > 0;

  async function use() {
    if (offer.redemption.providerOnly) {
      setProviderNote(true);
      return;
    }
    setError(null);
    setBusy('redeem');
    try {
      const rec = await props.onRedeem({ offerId: offer.id, purchaseTotal: total, unitsApplied: breakdown.unitsApplied, method, scenario });
      setResult(rec);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function activate() {
    if (!props.onActivate) return;
    setBusy('activate');
    setError(null);
    try {
      await props.onActivate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function recover() {
    if (!result || !props.onRecover) return;
    setBusy('recover');
    try {
      setResult(await props.onRecover(result.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function copyCode() {
    const code = offer.redemption.couponCode;
    if (!code) return;
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  }

  const unitLabel = splitProgram?.unit ?? 'points';
  const methodsOffered = offer.redemption.methods;

  return (
    <article className={`reward reward-${variant}`} aria-labelledby={headingId}>
      <header className="reward-top">
        <div className="reward-brand">
          <span className="monogram" aria-hidden>{brand.monogram}</span>
          <div>
            <div className="reward-brand-name">{brand.name}</div>
            <div className="reward-brand-sub">{offer.subcategory}</div>
          </div>
        </div>
        <div className="reward-top-actions">
          <DemoTag />
          {offer.sponsored && <span className="tag" title="Sponsored offers are ranked like any other offer.">Sponsored</span>}
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

      <div className="reward-body">
        <section className="reward-hero">
          <h2 id={headingId} className="display reward-headline">{offer.headline}</h2>
          <p className={`reward-expiry ${urgent ? 'is-urgent' : ''}`}>
            {urgent && <AlertTriangle aria-hidden />}
            <span>
              {days <= 0 ? 'Expires today' : `Expires ${fullDate(offer.expiresAt)}`}
              {days > 0 && <span className="muted"> ({days} {days === 1 ? 'day' : 'days'} left)</span>}
            </span>
          </p>
          {!!props.reasons?.length && (
            <div className="reward-why">
              <h3>Why this reward</h3>
              <ul>
                {props.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
          {!!props.warnings?.length && (
            <ul className="reward-warnings">
              {props.warnings.map((w) => (
                <li key={w}><AlertTriangle aria-hidden /> {w}</li>
              ))}
            </ul>
          )}
        </section>

        <div className="terms" role="group" aria-label="Reward conditions">
          <section className="term">
            <h3>What you get</h3>
            <p className="term-lead">{offer.benefit.summary}</p>
            <dl>
              <div>
                <dt>Estimated value</dt>
                <dd>{offer.valueEstimate.amount != null ? money(offer.valueEstimate.amount) : 'Not available'}</dd>
              </div>
              <div className="wide"><dt>Basis</dt><dd>{offer.valueEstimate.basis}</dd></div>
              {offer.maxBenefit != null && (
                <div><dt>Maximum benefit</dt><dd>{money(offer.maxBenefit)}</dd></div>
              )}
            </dl>
          </section>

          <section className="term">
            <h3>What you pay</h3>
            <p className="term-lead">{offer.youPay.summary}</p>
            <dl>
              <div><dt>Minimum spend</dt><dd>{offer.minSpend != null ? money(offer.minSpend) : 'None'}</dd></div>
              <div><dt>Extra spend needed</dt><dd>{offer.minSpend != null ? `Yes, at least ${money(offer.minSpend)}` : 'No'}</dd></div>
              <div className="wide">
                <dt>Known fees</dt>
                <dd>{offer.youPay.knownFees.length ? offer.youPay.knownFees.join('. ') + '.' : 'None disclosed.'}</dd>
              </div>
              {offer.youPay.feesUnknown && (
                <div className="wide is-flag"><dt>Unknown</dt><dd>Some fees or prices weren’t disclosed by the provider.</dd></div>
              )}
            </dl>
          </section>

          <section className="term">
            <h3>What is valid</h3>
            <ul className="term-list">
              {offer.valid.items.map((x) => <li key={x}>{x}</li>)}
              {offer.valid.locations.map((x) => <li key={x}>{x}</li>)}
            </ul>
            <dl>
              <div className="wide"><dt>Dates</dt><dd>{shortDate(offer.validFrom)} to {fullDate(offer.expiresAt)}</dd></div>
              <div className="wide"><dt>Where</dt><dd>{offer.valid.channels.map((c) => CHANNEL_LABEL[c]).join(', ')}</dd></div>
              {!!offer.valid.accounts.length && (
                <div className="wide"><dt>Eligible accounts</dt><dd>{offer.valid.accounts.join('. ')}</dd></div>
              )}
              <div className="wide">
                <dt>Payment methods</dt>
                <dd>{offer.valid.paymentMethods.length ? offer.valid.paymentMethods.map((m) => METHOD_META[m].label).join(', ') : 'Handled by the provider'}</dd>
              </div>
            </dl>
          </section>

          <section className="term term-not">
            <h3>What is not valid</h3>
            <ul className="term-list">
              {[...offer.notValid.exclusions, ...offer.notValid.locations, ...offer.notValid.transactions].map((x) => <li key={x}>{x}</li>)}
            </ul>
            <dl>
              <div className="wide"><dt>Combining offers</dt><dd>{offer.notValid.stacking}</dd></div>
            </dl>
          </section>

          <section className="term term-how">
            <h3>How to use it</h3>
            <dl className="how-grid">
              <div><dt>Activation</dt><dd>{offer.howToUse.activationRequired ? (props.activated ? 'Required. Activated.' : 'Required before you buy') : 'Not required'}</dd></div>
              <div><dt>How it applies</dt><dd>{APPLIES_LABEL[offer.howToUse.applies]}</dd></div>
              <div><dt>Points redemption</dt><dd>{offer.howToUse.pointsRedemption ? 'Yes' : 'No'}</dd></div>
              <div><dt>Code or manual step</dt><dd>{offer.howToUse.manualStep ?? 'None'}</dd></div>
              <div><dt>When you get it</dt><dd>{offer.howToUse.credit === 'immediate' ? 'Immediately. ' : offer.howToUse.credit === 'later' ? 'Later. ' : 'Not known. '}{offer.howToUse.creditNote}</dd></div>
            </dl>
            <p className="terms-link">
              <ExternalLink aria-hidden />
              {offer.termsUrl ? <a href={offer.termsUrl} target="_blank" rel="noreferrer">Provider’s full terms</a> : 'The provider’s full terms aren’t available for demo offers.'}
            </p>
          </section>
        </div>

        {/* ── Checkout ─────────────────────────────────────────────── */}
        <section className="checkout" aria-labelledby={`${uid}-co`}>
          <h3 id={`${uid}-co`} className="checkout-title">Use this reward</h3>

          {result ? (
            <RedemptionResult
              result={result}
              offer={offer}
              unitLabel={unitLabel}
              busy={busy === 'recover'}
              onRecover={props.onRecover ? recover : undefined}
              onDone={props.onDone ?? props.onClose}
              onAgain={() => setResult(null)}
            />
          ) : offer.redemption.providerOnly ? (
            <div className="provider-block">
              <p>
                {brand.name} completes this reward on its own site or app. Perkly shows you the conditions and value, but can’t book or
                redeem it for you{offer.redemption.splitUnsupportedReason ? `. ${offer.redemption.splitUnsupportedReason}` : '.'}
              </p>
              {splitProgram === undefined && offer.programId && balance == null && (
                <p className="muted">Connect the program in Profile to see your balance here.</p>
              )}
            </div>
          ) : (
            <>
              {needsActivation && (
                <div className="notice notice-warn">
                  <Info aria-hidden />
                  <div>
                    <strong>Activate this offer first.</strong> {offer.howToUse.manualStep}
                    {props.onActivate && (
                      <div className="notice-actions">
                        <button type="button" className="btn btn-ink btn-sm" onClick={activate} disabled={busy === 'activate'}>
                          {busy === 'activate' ? <span className="spinner" aria-hidden /> : null}
                          Activate offer
                        </button>
                        <span className="muted">Demo activation. No provider is contacted.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="co-row">
                <label className="co-label" htmlFor={`${uid}-total`}>Purchase total</label>
                <div className="money-input">
                  <span aria-hidden>$</span>
                  <input
                    id={`${uid}-total`}
                    inputMode="decimal"
                    value={totalText}
                    aria-describedby={`${uid}-total-hint`}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.]/g, '');
                      setTotalText(v);
                      const n = Number(v);
                      if (Number.isFinite(n)) setTotal(Math.min(n, 100000));
                    }}
                    onBlur={() => setTotalText(total.toFixed(2))}
                  />
                </div>
                <p id={`${uid}-total-hint`} className="co-hint">Example amount. Change it to see how the breakdown updates.</p>
              </div>

              {split ? (
                balance == null ? (
                  <div className="notice">
                    <Info aria-hidden />
                    <span>Connect {splitProgram?.name ?? 'this program'} in Profile to pay part of this with points.</span>
                  </div>
                ) : (
                  <div className="co-row">
                    <div className="co-label-row">
                      <label className="co-label" htmlFor={`${uid}-units`}>Apply {unitLabel}</label>
                      <span className="co-balance tabular">
                        {balance.toLocaleString('en-US')} available
                      </span>
                    </div>
                    {breakdown.maxUsableUnits > 0 ? (
                      <>
                        <div className="units-control">
                          <input
                            id={`${uid}-units`}
                            type="range"
                            min={0}
                            max={breakdown.maxUsableUnits}
                            step={split.step}
                            value={unitsApplied}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setUnits(v > 0 && v < split.minUnits ? split.minUnits : v);
                            }}
                            aria-valuetext={`${unitsApplied} ${unitLabel}, worth ${money(breakdown.rewardValue)}`}
                          />
                          <output className="units-out tabular" htmlFor={`${uid}-units`}>
                            <strong>{unitsApplied.toLocaleString('en-US')}</strong> {unitLabel} = {money(breakdown.rewardValue)}
                          </output>
                        </div>
                        <div className="units-shortcuts">
                          <button type="button" className="chip" onClick={() => setUnits(0)} aria-pressed={unitsApplied === 0}>None</button>
                          <button type="button" className="chip" onClick={() => setUnits(breakdown.maxUsableUnits)} aria-pressed={unitsApplied === breakdown.maxUsableUnits}>
                            Max ({breakdown.maxUsableUnits.toLocaleString('en-US')})
                          </button>
                        </div>
                        <p className="co-hint">{split.note} {split.step.toLocaleString('en-US')} {unitLabel} = {money(split.unitValue * split.step)}, a rate set by {splitProgram?.name}.</p>
                      </>
                    ) : (
                      <p className="co-hint">Your balance or this total is below the {split.minUnits.toLocaleString('en-US')}-{unitLabel} minimum.</p>
                    )}
                  </div>
                )
              ) : (
                <p className="co-hint co-nosplit">
                  <Info aria-hidden /> Paying with points isn’t available here. {offer.redemption.splitUnsupportedReason}
                </p>
              )}

              <fieldset className="co-row methods">
                <legend className="co-label">{breakdown.unitsApplied > 0 ? 'Pay the rest with' : 'Pay with'}</legend>
                {breakdown.rewardsCoverAll && (
                  <MethodOption
                    name={`${uid}-m`}
                    value="rewards_only"
                    checked={method === 'rewards_only'}
                    onSelect={() => setMethod('rewards_only')}
                    label="Rewards only"
                    hint={`Your ${unitLabel} cover the whole amount`}
                    icon={Check}
                  />
                )}
                {methodsOffered.map((m) => {
                  const meta = METHOD_META[m];
                  const available = m === 'in_store' || savedKinds.has(m);
                  return (
                    <MethodOption
                      key={m}
                      name={`${uid}-m`}
                      value={m}
                      checked={method === m}
                      disabled={!available}
                      onSelect={() => setMethod(m)}
                      label={meta.label}
                      hint={available ? (paymentMethods.find((p) => p.kind === m)?.label ?? meta.hint) : 'Add this method in Profile to use it'}
                      icon={meta.icon}
                    />
                  );
                })}
                {(['apple_pay', 'saved_card', 'online_banking', 'in_store'] as PaymentMethodKind[])
                  .filter((m) => !methodsOffered.includes(m))
                  .length > 0 && (
                  <p className="co-hint">
                    Not accepted for this offer:{' '}
                    {(['apple_pay', 'saved_card', 'online_banking', 'in_store'] as PaymentMethodKind[])
                      .filter((m) => !methodsOffered.includes(m))
                      .map((m) => METHOD_META[m].label)
                      .join(', ')}
                    .
                  </p>
                )}
              </fieldset>

              <Breakdown offer={offer} b={breakdown} method={method} unitLabel={unitLabel} />

              {!breakdown.qualifies && (
                <div className="notice notice-warn" role="status">
                  <AlertTriangle aria-hidden />
                  <span>
                    This total is {money(breakdown.shortfall)} short of the {money(offer.minSpend ?? 0)} minimum, so the discount won’t apply.
                  </span>
                </div>
              )}

              {elig && elig.status !== 'eligible' && (
                <div className={`notice ${elig.status === 'ineligible' ? 'notice-warn' : ''}`} role="status">
                  <CircleDashed aria-hidden />
                  <div>
                    <strong>{elig.summary}</strong>
                    <ul className="elig-list">
                      {elig.checks.filter((c) => c.result !== 'pass').slice(0, 3).map((c) => (
                        <li key={c.rule}>{c.reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {method === 'in_store' && (
                <div className="code-block" aria-live="polite">
                  {showCode ? (
                    <>
                      <p className="code-intro">Show this code at the register, then pay {money(breakdown.amountDue)} to {brand.name} with cash or card.</p>
                      <div className="code-row">
                        <code className="coupon tabular">{offer.redemption.couponCode}</code>
                        <button type="button" className="btn btn-sm" onClick={copyCode}>
                          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                          {copied ? 'Copied' : 'Copy code'}
                        </button>
                      </div>
                      <p className="co-hint">Demo code. It won’t work at a real store.</p>
                    </>
                  ) : (
                    <p className="code-intro">No code is needed. Pay {money(breakdown.amountDue)} to {brand.name} directly at the register.</p>
                  )}
                </div>
              )}

              {props.showScenario && (
                <div className="co-row scenario">
                  <label className="co-label" htmlFor={`${uid}-sc`}>Demo scenario</label>
                  <select id={`${uid}-sc`} className="select" value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
                    <option value="normal">Everything works</option>
                    <option value="payment_declined">Payment is declined</option>
                    <option value="reward_unavailable">Points service is down</option>
                    <option value="reversal_failed">Payment declined, points stay on hold</option>
                  </select>
                  <p className="co-hint">Try a failure to see how Perkly reports what actually happened.</p>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="notice notice-danger" role="alert">
              <AlertTriangle aria-hidden />
              <span>{error}</span>
            </div>
          )}
          {providerNote && (
            <div className="notice" role="status">
              <Info aria-hidden />
              <span>
                In the live product, this would open {brand.name} to finish the booking. Provider sign-in isn’t connected in this prototype, so
                nothing happens here.
              </span>
            </div>
          )}
        </section>
      </div>

      {!result && (
        <footer className="reward-action">
          <div className="action-summary">
            {offer.redemption.providerOnly ? (
              <span>Redeemed with {brand.name}</span>
            ) : blocking ? (
              <span className="is-blocked">{blocking}</span>
            ) : (
              <span className="tabular">
                {breakdown.amountDue === 0 && breakdown.unitsApplied > 0
                  ? `Covered by ${breakdown.unitsApplied.toLocaleString('en-US')} ${unitLabel}`
                  : method === 'in_store'
                    ? `You pay ${money(breakdown.amountDue)} in store`
                    : method
                      ? `You pay ${money(breakdown.amountDue)} with ${METHOD_META[method as PaymentMethodKind]?.label ?? 'rewards'}`
                      : `Choose how to pay ${money(breakdown.amountDue)}`}
              </span>
            )}
            <span className="action-demo">Demo redemption. No real money or points move.</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg use-btn"
            onClick={use}
            disabled={(!canUse && !offer.redemption.providerOnly) || busy === 'redeem'}
            aria-describedby={`${uid}-co`}
          >
            {busy === 'redeem' && <span className="spinner" aria-hidden />}
            Use Reward
          </button>
        </footer>
      )}
    </article>
  );
}

function MethodOption(p: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  label: string;
  hint: string;
  icon: typeof CreditCard;
}) {
  const Icon = p.icon;
  return (
    <label className={`method ${p.checked ? 'is-on' : ''} ${p.disabled ? 'is-off' : ''}`}>
      <input type="radio" name={p.name} value={p.value} checked={p.checked} disabled={p.disabled} onChange={p.onSelect} />
      <Icon aria-hidden />
      <span className="method-text">
        <span className="method-label">{p.label}</span>
        <span className="method-hint">{p.hint}</span>
      </span>
      <span className="method-dot" aria-hidden />
    </label>
  );
}

function Breakdown({ offer, b, method, unitLabel }: { offer: Offer; b: ReturnType<typeof computeCheckout>; method: Method | null; unitLabel: string }) {
  return (
    <dl className="breakdown tabular" aria-label="Payment breakdown">
      <div><dt>Purchase total</dt><dd>{money(b.purchaseTotal)}</dd></div>
      {b.discount > 0 && <div><dt>Offer discount</dt><dd>−{money(b.discount)}</dd></div>}
      {b.unitsApplied > 0 && (
        <div><dt>Rewards applied ({b.unitsApplied.toLocaleString('en-US')} {unitLabel})</dt><dd>−{money(b.rewardValue)}</dd></div>
      )}
      <div className="total"><dt>Remaining due</dt><dd>{money(b.amountDue)}</dd></div>
      <div><dt>Paid with</dt><dd>{method ? (method === 'rewards_only' ? 'Rewards only' : METHOD_META[method].label) : 'Not chosen'}</dd></div>
      <div><dt>Fees and taxes</dt><dd>{offer.youPay.knownFees.length ? offer.youPay.knownFees[0] : offer.youPay.feesUnknown ? 'Not disclosed' : 'None disclosed'}</dd></div>
      {b.laterCredit != null && <div><dt>Cashback, credited later</dt><dd>{money(b.laterCredit)} (est.)</dd></div>}
    </dl>
  );
}

function RedemptionResult(p: {
  result: RedemptionRecord;
  offer: Offer;
  unitLabel: string;
  busy: boolean;
  onRecover?: () => void;
  onDone?: () => void;
  onAgain: () => void;
}) {
  const r = p.result;
  const ok = r.status === 'completed_demo';
  const partial = r.status === 'partial_failure_demo';
  const stepLabel = (s: string) => ({ succeeded: 'Done', failed: 'Failed', skipped: 'Not needed', reversed: 'Returned' })[s] ?? s;
  return (
    <div className={`result ${ok ? 'is-ok' : partial ? 'is-partial' : 'is-failed'}`} role="status" aria-live="polite">
      <div className="result-mark" aria-hidden>{ok ? <Check /> : partial ? <AlertTriangle /> : <Undo2 />}</div>
      <p className="result-title display">
        {ok ? 'Demo redemption complete' : partial ? 'Payment failed, points on hold' : 'Not completed'}
      </p>
      <p className="result-msg">{r.message}</p>
      <dl className="breakdown tabular">
        <div><dt>Purchase total</dt><dd>{money(r.purchaseTotal)}</dd></div>
        {r.discount > 0 && <div><dt>Offer discount</dt><dd>−{money(r.discount)}</dd></div>}
        <div><dt>Rewards used</dt><dd>{r.unitsApplied ? `${r.unitsApplied.toLocaleString('en-US')} ${p.unitLabel} (${money(r.rewardValueApplied)})` : 'None'}</dd></div>
        <div className="total"><dt>{r.paymentMethod === 'in_store' ? 'To pay the merchant' : 'Money paid'}</dt><dd>{ok ? money(r.amountDue) : '$0.00'}</dd></div>
        {r.remainingBalance != null && <div><dt>Remaining balance</dt><dd>{r.remainingBalance.toLocaleString('en-US')} {p.unitLabel}</dd></div>}
        <div><dt>Points step</dt><dd>{stepLabel(r.steps.reward)}</dd></div>
        <div><dt>Payment step</dt><dd>{stepLabel(r.steps.payment)}</dd></div>
      </dl>
      <p className="result-demo"><DemoTag /> Simulated. No real money was charged and no real points were redeemed.</p>
      <div className="result-actions">
        {partial && p.onRecover && (
          <button type="button" className="btn btn-primary" onClick={p.onRecover} disabled={p.busy}>
            {p.busy && <span className="spinner" aria-hidden />}
            Release points
          </button>
        )}
        {!ok && !partial && <button type="button" className="btn" onClick={p.onAgain}>Try again</button>}
        {p.onDone && <button type="button" className={`btn ${ok ? 'btn-primary' : ''}`} onClick={p.onDone}>Done</button>}
      </div>
    </div>
  );
}
