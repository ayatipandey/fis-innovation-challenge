import type { PaymentMethodKind, RedemptionRecord } from '@shared/types';
import { Compass, Home as HomeIcon, LogOut, MessageCircle, UserRound } from 'lucide-react';
import { useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DemoTag, Logo } from '../../components/bits';
import { Dialog } from '../../components/Dialog';
import { RewardDetail, type EligibilityResult, type RedeemRequest } from '../../components/RewardDetail';
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
            <p className="side-demo"><DemoTag>Demo offers</DemoTag> Offers and balances are sample data.</p>
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
        <DemoTag>{user?.isDemo ? 'Demo account' : 'Demo offers'}</DemoTag>
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
  const wallet = d.wallet.status === 'ready' ? d.wallet.data : null;
  const rec = d.recs.status === 'ready' && id ? d.recs.data.items.find((r) => r.offerId === id) : undefined;
  const split = offer?.redemption.split;
  const link = split && wallet ? wallet.programs.find((p) => p.programId === split.programId && p.status === 'connected') : undefined;

  const onRedeem = useCallback(
    async (req: RedeemRequest) => {
      const r = await api<RedemptionRecord>('/me/redemptions', { method: 'POST', body: req });
      void d.refreshWallet();
      return r;
    },
    [d],
  );
  const onRecover = useCallback(
    async (rid: string) => {
      const r = await api<RedemptionRecord>(`/me/redemptions/${rid}/recover`, { method: 'POST' });
      void d.refreshWallet();
      return r;
    },
    [d],
  );
  const checkEligibility = useCallback(
    (q: { offerId: string; paymentMethod?: PaymentMethodKind; purchaseTotal?: number; channel?: string }) =>
      api<EligibilityResult>('/me/eligibility', { method: 'POST', body: q }),
    [],
  );

  return (
    <Dialog open={!!offer && !!brand} onClose={d.closeReward} labelledBy="reward-sheet-h" className="drawer">
      {offer && brand && wallet && (
        <RewardDetail
          key={offer.id}
          headingId="reward-sheet-h"
          offer={offer}
          brand={brand}
          splitProgram={split ? d.program(split.programId) : undefined}
          balance={link ? link.balance : null}
          paymentMethods={wallet.paymentMethods}
          reasons={rec?.reasons}
          warnings={rec?.warnings}
          activated={wallet.activated.includes(offer.id)}
          favorite={{ active: d.isFavorite(offer.id), toggle: () => d.toggleFavorite(offer.id) }}
          onActivate={async () => {
            await api(`/me/activations/${offer.id}`, { method: 'POST' });
            d.setWallet((w) => ({ ...w, activated: [...w.activated, offer.id] }));
          }}
          onRedeem={onRedeem}
          onRecover={onRecover}
          checkEligibility={checkEligibility}
          onClose={d.closeReward}
          showScenario
        />
      )}
    </Dialog>
  );
}
