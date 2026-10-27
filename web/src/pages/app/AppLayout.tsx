import { Compass, Home as HomeIcon, LogOut, Sparkles, UserRound } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DemoTag, Logo } from '../../components/bits';
import { AppProvider } from '../../state/app';
import { useSession } from '../../state/session';

const NAV = [
  { to: '/app', label: 'Home', short: 'Home', icon: HomeIcon, end: true },
  { to: '/app/explore', label: 'Explore', short: 'Explore', icon: Compass, end: false },
  { to: '/app/pilot', label: 'Perkly’s Pilot', short: 'Pilot', icon: Sparkles, end: false },
  { to: '/app/profile', label: 'Profile', short: 'Profile', icon: UserRound, end: false },
];

export function AppLayout() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  return (
    <AppProvider>
      <div className="app-shell">
        <a className="skip-link" href="#app-main">Skip to content</a>
        <aside className="sidebar glass" aria-label="Perkly">
          <Logo to="/app" label="Perkly Home" />
          <nav aria-label="App" className="side-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="side-link">
                <n.icon aria-hidden />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="side-foot">
            <p className="side-demo">
              <DemoTag>{user?.isDemo ? 'Demo account' : 'Sample programs'}</DemoTag>
              {user?.isDemo ? 'A fictional member. Balances and purchases are synthetic.' : 'Linked programs are samples. In real life they connect through each bank’s or brand’s API.'}
            </p>
            <p className="side-build">Web preview · built for the Perkly phone app</p>
            <button
              type="button"
              className="btn btn-quiet btn-sm side-signout"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
            >
              <LogOut aria-hidden /> Sign out
            </button>
          </div>
        </aside>

        <header className="topbar glass">
          <Logo to="/app" label="Perkly Home" />
          <DemoTag>{user?.isDemo ? 'Demo account' : 'Sample programs'}</DemoTag>
        </header>

        <main id="app-main" className="app-main" tabIndex={-1}>
          <Outlet />
        </main>

        <nav className="bottom-nav glass" aria-label="App">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="bottom-link">
              <n.icon aria-hidden />
              <span>{n.short}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </AppProvider>
  );
}
