import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Mark } from './components/bits';
import { AppLayout } from './pages/app/AppLayout';
import { Copilot } from './pages/app/Copilot';
import { Explore } from './pages/app/Explore';
import { Home } from './pages/app/Home';
import { Profile } from './pages/app/Profile';
import { SignIn } from './pages/auth/SignIn';
import { SignUp } from './pages/auth/SignUp';
import { Landing } from './pages/landing/Landing';
import { LegalPage } from './pages/legal/Legal';
import { Onboarding } from './pages/onboarding/Onboarding';
import { SessionProvider, useSession } from './state/session';
import { ToastProvider } from './state/toast';

function Splash() {
  return (
    <div className="splash" aria-busy="true" aria-label="Loading Perkly">
      <Mark size={40} />
    </div>
  );
}

function RequireUser({ children, onboarding }: { children: ReactNode; onboarding?: boolean }) {
  const { status, user, preferences } = useSession();
  const loc = useLocation();
  if (status === 'loading') return <Splash />;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname)}`} replace />;
  const done = preferences?.onboarding.completed;
  if (!onboarding && !done) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function ScrollAndTitle() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <ScrollAndTitle />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/onboarding" element={<RequireUser onboarding><Onboarding /></RequireUser>} />
            <Route path="/app" element={<RequireUser><AppLayout /></RequireUser>}>
              <Route index element={<Home />} />
              <Route path="explore" element={<Explore />} />
              <Route path="copilot" element={<Copilot />} />
              <Route path="profile" element={<Navigate to="/app/profile/account" replace />} />
              <Route path="profile/:section" element={<Profile />} />
            </Route>
            <Route path="/legal/:page" element={<LegalPage />} />
            <Route path="/contact" element={<LegalPage page="contact" />} />
            <Route path="*" element={<LegalPage page="not-found" />} />
          </Routes>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
