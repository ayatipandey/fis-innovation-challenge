import { EMAIL_RE } from '@shared/validation';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useSession } from '../../state/session';
import { AuthLayout } from './AuthLayout';
import { TextField } from './SignUp';

export function SignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/app') ? params.get('next')! : '/app';
  const { user, setSession } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<'signin' | 'demo' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Sign in · Perkly';
  }, []);
  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, navigate, next]);

  const emailErr = !email.trim() ? 'Enter your email address.' : !EMAIL_RE.test(email.trim()) ? 'Enter an email address like name@example.com.' : undefined;
  const pwErr = !password ? 'Enter your password.' : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (emailErr || pwErr) {
      document.getElementById(emailErr ? 'si-email' : 'si-password')?.focus();
      return;
    }
    setBusy('signin');
    try {
      setSession(await api('/auth/login', { method: 'POST', body: { email: email.trim(), password } }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function demo() {
    setBusy('demo');
    setError(null);
    try {
      setSession(await api('/auth/demo', { method: 'POST' }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AuthLayout
      aside={
        <div className="auth-aside-inner">
          <p className="display auth-aside-h">Just looking?</p>
          <p>The demo opens a fictional account with sample balances, offers and history, so you can try every screen.</p>
          <button type="button" className="btn btn-ink" onClick={demo} disabled={busy !== null}>
            {busy === 'demo' && <span className="spinner" aria-hidden />}
            Try the Demo
          </button>
        </div>
      }
    >
      <h1 className="display auth-h">Welcome back</h1>
      <p className="auth-lede">
        New to Perkly? <Link to="/signup">Create an account</Link>
      </p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField id="si-email" label="Email address" type="email" autoComplete="email" value={email} onChange={setEmail} error={touched ? emailErr : undefined} />
        <TextField
          id="si-password"
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={touched ? pwErr : undefined}
          toggle={{ shown: show, onToggle: () => setShow((s) => !s) }}
        />
        {error && (
          <div className="notice notice-danger" role="alert">
            <AlertCircle aria-hidden />
            <span>{error}</span>
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy !== null}>
          {busy === 'signin' && <span className="spinner" aria-hidden />}
          Sign in
        </button>
        <p className="muted auth-small">Password reset isn’t available in this prototype.</p>
      </form>
    </AuthLayout>
  );
}
