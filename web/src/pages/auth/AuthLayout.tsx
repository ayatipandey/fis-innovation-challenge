import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/bits';

export function AuthLayout({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="auth">
      <a className="skip-link" href="#main">Skip to form</a>
      <header className="auth-head">
        <Logo />
        <Link to="/" className="btn btn-quiet btn-sm">Back to home</Link>
      </header>
      <div className="auth-body">
        <main id="main" className="auth-main">{children}</main>
        <aside className="auth-aside">{aside}</aside>
      </div>
      <footer className="auth-foot">
        <Link to="/legal/terms">Terms</Link>
        <Link to="/legal/privacy">Privacy</Link>
        <Link to="/legal/accessibility">Accessibility</Link>
        <span>Student prototype. Demo data only.</span>
      </footer>
    </div>
  );
}
