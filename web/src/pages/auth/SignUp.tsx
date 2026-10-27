import { EMAIL_RE, PASSWORD_RULES, passwordProblems } from '@shared/validation';
import { AlertCircle, Check, Circle, Eye, EyeOff } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Switch } from '../../components/bits';
import { Dialog } from '../../components/Dialog';
import { ApiError, api } from '../../lib/api';
import { useSession } from '../../state/session';
import { AuthLayout } from './AuthLayout';

type Field = 'email' | 'password' | 'confirm';

export function SignUp() {
  const navigate = useNavigate();
  const { user, setSession } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState<Record<Field, boolean>>({ email: false, password: false, confirm: false });
  const [serverErr, setServerErr] = useState<{ field?: string; message: string } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  useEffect(() => {
    document.title = 'Create your account · Perkly';
  }, []);
  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  const errors: Partial<Record<Field, string>> = {};
  if (!email.trim()) errors.email = 'Enter your email address.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter an email address like name@example.com.';
  const pwProblems = passwordProblems(password, email.trim());
  if (!password) errors.password = 'Create a password.';
  else if (pwProblems.length) errors.password = pwProblems[0];
  if (!confirm) errors.confirm = 'Enter the password again.';
  else if (confirm !== password) errors.confirm = 'The passwords don’t match.';
  if (serverErr?.field === 'email' && !errors.email) errors.email = serverErr.message;

  const shown = (f: Field) => (touched[f] ? errors[f] : undefined);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true, confirm: true });
    setServerErr(null);
    if (Object.keys(errors).length) {
      const first = (['email', 'password', 'confirm'] as Field[]).find((f) => errors[f]);
      document.getElementById(`su-${first}`)?.focus();
      return;
    }
    setConsentOpen(true);
  }

  async function register(optional: { spendingData: boolean; location: boolean; marketing: boolean }) {
    const s = await api<Parameters<typeof setSession>[0]>('/auth/register', {
      method: 'POST',
      body: { email: email.trim(), password, termsAccepted: true, termsVersion: '2026-10-draft', optional },
    });
    setSession(s);
    navigate('/onboarding', { replace: true });
  }

  return (
    <AuthLayout
      aside={
        <div className="auth-aside-inner">
          <p className="display auth-aside-h">Next, a two-minute setup.</p>
          <ol className="auth-steps">
            <li>Pick the categories you care about</li>
            <li>Choose favorite brands, or skip</li>
            <li>Connect demo reward programs</li>
            <li>Add a demo payment method, or skip</li>
            <li>Set how often Perkly may alert you</li>
          </ol>
          <p className="muted">Everything you choose can be changed later in Profile.</p>
        </div>
      }
    >
      <h1 className="display auth-h">Create your Perkly account</h1>
      <p className="auth-lede">
        Already have one? <Link to="/signin">Sign in</Link>
      </p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField
          id="su-email"
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (serverErr?.field === 'email') setServerErr(null);
          }}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={shown('email') ?? (serverErr?.field === 'email' ? serverErr.message : undefined)}
        />
        <TextField
          id="su-password"
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={shown('password')}
          describedBy="pw-rules"
          toggle={{ shown: show, onToggle: () => setShow((s) => !s) }}
        />
        <ul id="pw-rules" className="pw-rules" aria-label="Password requirements">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.id} className={ok ? 'is-ok' : ''}>
                {ok ? <Check aria-hidden /> : <Circle aria-hidden />}
                {r.label}
                <span className="visually-hidden">{ok ? ', met' : ', not met yet'}</span>
              </li>
            );
          })}
        </ul>
        <TextField
          id="su-confirm"
          label="Confirm password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          error={shown('confirm')}
        />
        {serverErr && serverErr.field !== 'email' && (
          <div className="notice notice-danger" role="alert"><AlertCircle aria-hidden />{serverErr.message}</div>
        )}
        <button type="submit" className="btn btn-primary btn-lg btn-block">Create account</button>
      </form>

      <ConsentDialog
        open={consentOpen}
        onBack={() => setConsentOpen(false)}
        onAgree={async (optional) => {
          try {
            await register(optional);
          } catch (e) {
            const err = e as ApiError;
            setConsentOpen(false);
            setServerErr({ field: err.field, message: err.message });
            if (err.field) {
              setTouched((t) => ({ ...t, [err.field as Field]: true }));
              document.getElementById(`su-${err.field}`)?.focus();
            }
          }
        }}
      />
    </AuthLayout>
  );
}

export function TextField(p: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  autoComplete?: string;
  describedBy?: string;
  toggle?: { shown: boolean; onToggle: () => void };
}) {
  const errId = `${p.id}-err`;
  const described = [p.error ? errId : null, p.describedBy].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={p.id}>{p.label}</label>
      <div className="control">
        <input
          id={p.id}
          type={p.type}
          value={p.value}
          autoComplete={p.autoComplete}
          aria-invalid={p.error ? true : undefined}
          aria-describedby={described}
          onChange={(e) => p.onChange(e.target.value)}
          onBlur={p.onBlur}
          spellCheck={false}
          autoCapitalize="none"
          style={p.toggle ? { paddingRight: 56 } : undefined}
        />
        {p.toggle && (
          <button type="button" className="icon-btn" onClick={p.toggle.onToggle} aria-label={p.toggle.shown ? 'Hide password' : 'Show password'} aria-pressed={p.toggle.shown}>
            {p.toggle.shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        )}
      </div>
      {p.error && (
        <p className="error" id={errId}>
          <AlertCircle aria-hidden />
          {p.error}
        </p>
      )}
    </div>
  );
}

function ConsentDialog(p: {
  open: boolean;
  onBack: () => void;
  onAgree: (optional: { spendingData: boolean; location: boolean; marketing: boolean }) => Promise<void>;
}) {
  const id = useId();
  const [agreed, setAgreed] = useState(false);
  const [spendingData, setSpendingData] = useState(false);
  const [location, setLocation] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  useEffect(() => {
    if (!p.open) {
      setState('idle');
    }
  }, [p.open]);

  async function agree() {
    setState('busy');
    try {
      await p.onAgree({ spendingData, location, marketing });
      setState('done');
    } catch {
      setState('idle');
    }
  }

  return (
    <Dialog open={p.open} onClose={() => state !== 'busy' && p.onBack()} labelledBy={`${id}-h`}>
      <div className="consent">
        <h2 id={`${id}-h`} className="display consent-h">Before you continue</h2>
        <p className="consent-text">
          Perkly uses your selected preferences and, when you authorize it, supported reward and spending data to personalize recommendations.
          Location access is optional. You control your notification and data permissions.
        </p>
        <label className="checkbox consent-check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I agree to the{' '}
            <a href="/legal/terms" target="_blank" rel="noreferrer">Terms of Service</a>
            {' '}and acknowledge the{' '}
            <a href="/legal/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
            <span className="consent-req"> Required</span>
          </span>
        </label>

        <fieldset className="consent-optional">
          <legend>Optional. Off unless you turn them on.</legend>
          <div className="switch-row">
            <div><div className="label">Use spending data for recommendations</div><div className="hint">Spending categories from accounts you connect. Demo data in this prototype.</div></div>
            <Switch checked={spendingData} onChange={setSpendingData} label="Use spending data for recommendations" />
          </div>
          <div className="switch-row">
            <div><div className="label">Location for nearby rewards</div><div className="hint">Only used while you allow it.</div></div>
            <Switch checked={location} onChange={setLocation} label="Location for nearby rewards" />
          </div>
          <div className="switch-row">
            <div><div className="label">Product news by email</div><div className="hint">Occasional updates. Unsubscribe any time.</div></div>
            <Switch checked={marketing} onChange={setMarketing} label="Product news by email" />
          </div>
        </fieldset>

        <div className="consent-actions">
          <button type="button" className="btn btn-primary btn-lg" disabled={!agreed || state !== 'idle'} onClick={agree}>
            {state === 'busy' && <span className="spinner" aria-hidden />}
            {state === 'done' ? 'Account created' : 'Agree and Continue'}
          </button>
          <button type="button" className="btn btn-lg" onClick={p.onBack} disabled={state === 'busy'}>Go Back</button>
        </div>
        {!agreed && <p className="consent-note">Your account isn’t created until you agree.</p>}
      </div>
    </Dialog>
  );
}
