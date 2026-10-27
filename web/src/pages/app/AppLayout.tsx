import type { Channel, RewardUse } from '@shared/types';
import { Compass, Home as HomeIcon, LogOut, MessageCircle, UserRound } from 'lucide-react';
import { useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DemoTag, Logo } from '../../components/bits';
import { Dialog } from '../../components/Dialog';
import { RewardDetail } from '../../components/RewardDetail';
import { api } from '../../lib/api';
import { DataProvider, useData } from '../../state/data';
import { useSession } from '../../state/session';

const NAV = [
  { to: '/app', label: 'Home', icon: HomeIcon, end: true },
  { to: '/app/explore', label: 'Explore', icon: Compass, end: false },
  { to: '/app/copilot', label: 'AI Copilot', icon: MessageCircle, end: false },
  { to: '/app/profile', label: 'Profile', icon: UserRound, end: false },
];

export function AppLayout() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

function Shell() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-main">Skip to content</a>
      <aside className="sidebar" aria-label="Perkly">
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
          {user?.isDemo ? (
            <p className="side-demo"><DemoTag>Demo account</DemoTag> A fictional account. Everything here is simulated.</p>
          ) : (
            <p className="side-demo"><DemoTag>Demo partners</DemoTag> Partner brands and rewards are sample data.</p>
          )}
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

      <header className="topbar">
        <Logo to="/app" label="Perkly Home" />
        <DemoTag>{user?.isDemo ? 'Demo account' : 'Demo partners'}</DemoTag>
      </header>

      <main id="app-main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="App">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="bottom-link">
            <n.icon aria-hidden />
            <span>{n.label === 'AI Copilot' ? 'Copilot' : n.label}</span>
          </NavLink>
        ))}
      </nav>

      <RewardSheet />
    </div>
  );
}

function RewardSheet() {
  const d = useData();
  const id = d.openId;
  const offer = id ? d.offer(id) : undefined;
  const brand = offer ? d.brand(offer.brandId) : undefined;
  const rec = d.recs.status === 'ready' && id ? d.recs.data.items.find((r) => r.offerId === id) : undefined;

  const onUse = useCallback(
    async (channel: Channel) => {
      const r = await api<{ use: RewardUse }>(`/me/rewards/${encodeURIComponent(id!)}/use`, { method: 'POST', body: { channel } });
      void d.refreshWallet();
      return r.use;
    },
    [d, id],
  );

  return (
    <Dialog open={!!offer && !!brand} onClose={d.closeReward} labelledBy="reward-sheet-h" className="reward-modal">
      {offer && brand && (
        <RewardDetail
          key={offer.id}
          headingId="reward-sheet-h"
          offer={offer}
          brand={brand}
          reasons={rec?.reasons}
          warnings={rec?.warnings}
          favorite={{ active: d.isFavorite(offer.id), toggle: () => d.toggleFavorite(offer.id) }}
          onUse={onUse}
          onClose={d.closeReward}
        />
      )}
    </Dialog>
  );
}
