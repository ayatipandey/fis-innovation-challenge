import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Mark } from './components/bits';
import { AppLayout } from './pages/app/AppLayout';
import { Explore } from './pages/app/Explore';
import { Home } from './pages/app/Home';
import { Pilot } from './pages/app/Pilot';
import { Profile } from './pages/app/Profile';
import { SignIn } from './pages/auth/SignIn';
import { SignUp } from './pages/auth/SignUp';
import { Landing } from './pages/landing/Landing';
import { Insights } from './pages/insights/Insights';
import { LegalPage } from './pages/legal/Legal';
import { Checkout } from './pages/mock/Checkout';
import { Connect } from './pages/mock/Connect';
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
              <Route path="pilot" element={<Pilot />} />
              <Route path="copilot" element={<Navigate to="/app/pilot" replace />} />
              <Route path="profile" element={<Navigate to="/app/profile/account" replace />} />
              <Route path="profile/:section" element={<Profile />} />
            </Route>
            <Route path="/connect/:programId" element={<RequireUser onboarding><Connect /></RequireUser>} />
            <Route path="/checkout/:holdId" element={<RequireUser><Checkout /></RequireUser>} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/legal/:page" element={<LegalPage />} />
            <Route path="/contact" element={<LegalPage page="contact" />} />
            <Route path="*" element={<LegalPage page="not-found" />} />
          </Routes>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
