import type {
  Activity,
  Brand,
  Category,
  Offer,
  PaymentMethod,
  Program,
  ProgramLink,
  RecommendationResult,
} from '@shared/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, localTime } from '../lib/api';
import { useSession } from './session';
import { useToast } from './toast';

export interface Wallet {
  programs: ProgramLink[];
  cashback: { available: number; pending: number; isDemo: boolean };
  activity: Activity[];
  paymentMethods: PaymentMethod[];
  favorites: string[];
  activated: string[];
  recentlyViewed: string[];
  spendingSource: 'synthetic_demo' | 'none';
}

interface Catalog {
  offers: Offer[];
  brands: Brand[];
  programs: Program[];
  categories: Category[];
}

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

interface DataState {
  catalog: Load<Catalog>;
  wallet: Load<Wallet>;
  recs: Load<RecommendationResult & { location: string | null }>;
  offer: (id: string) => Offer | undefined;
  brand: (id: string) => Brand | undefined;
  program: (id: string | null) => Program | undefined;
  isFavorite: (offerId: string) => boolean;
  toggleFavorite: (offerId: string) => void;
  openReward: (offerId: string) => void;
  closeReward: () => void;
  openId: string | null;
  refreshWallet: () => Promise<void>;
  refreshRecs: () => Promise<void>;
  setWallet: (fn: (w: Wallet) => Wallet) => void;
}

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { preferences } = useSession();
  const toast = useToast();
  const [catalog, setCatalog] = useState<Load<Catalog>>({ status: 'loading' });
  const [wallet, setWalletState] = useState<Load<Wallet>>({ status: 'loading' });
  const [recs, setRecs] = useState<DataState['recs']>({ status: 'loading' });
  const [openId, setOpenId] = useState<string | null>(null);
  const favoritesRef = useRef<string[]>([]);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog({ status: 'ready', data: await api<Catalog>('/me/catalog') });
    } catch (e) {
      setCatalog({ status: 'error', message: (e as Error).message });
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    try {
      const w = await api<Wallet>('/me/wallet');
      favoritesRef.current = w.favorites;
      setWalletState({ status: 'ready', data: w });
    } catch (e) {
      setWalletState((prev) => (prev.status === 'ready' ? prev : { status: 'error', message: (e as Error).message }));
    }
  }, []);

  const refreshRecs = useCallback(async () => {
    const t = localTime();
    try {
      setRecs({ status: 'ready', data: await api(`/me/recommendations?weekday=${t.weekday}&hour=${t.hour}`) });
    } catch (e) {
      setRecs({ status: 'error', message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    void refreshWallet();
  }, [loadCatalog, refreshWallet]);

  // Preferences feed the ranking, so re-rank when they change.
  const prefKey = preferences
    ? JSON.stringify([preferences.categories, preferences.favoriteBrands, preferences.privacy])
    : '';
  useEffect(() => {
    if (prefKey) void refreshRecs();
  }, [prefKey, refreshRecs]);

  const setWallet = useCallback((fn: (w: Wallet) => Wallet) => {
    setWalletState((prev) => (prev.status === 'ready' ? { status: 'ready', data: fn(prev.data) } : prev));
  }, []);

  const toggleFavorite = useCallback(
    (offerId: string) => {
      const was = favoritesRef.current.includes(offerId);
      const next = was ? favoritesRef.current.filter((x) => x !== offerId) : [...favoritesRef.current, offerId];
      favoritesRef.current = next;
      setWallet((w) => ({ ...w, favorites: next }));
      api<{ favorites: string[] }>(`/me/favorites/${encodeURIComponent(offerId)}`, { method: was ? 'DELETE' : 'PUT' })
        .then((r) => {
          favoritesRef.current = r.favorites;
          setWallet((w) => ({ ...w, favorites: r.favorites }));
        })
        .catch(() => {
          favoritesRef.current = was ? [...next, offerId] : next.filter((x) => x !== offerId);
          setWallet((w) => ({ ...w, favorites: favoritesRef.current }));
          toast('Favorite wasn’t saved. Check your connection and try again.', 'info');
        });
    },
    [setWallet, toast],
  );

  const openReward = useCallback(
    (offerId: string) => {
      setOpenId(offerId);
      api(`/me/viewed/${encodeURIComponent(offerId)}`, { method: 'POST' })
        .then(() => setWallet((w) => ({ ...w, recentlyViewed: [offerId, ...w.recentlyViewed.filter((x) => x !== offerId)].slice(0, 6) })))
        .catch(() => undefined);
    },
    [setWallet],
  );

  const value = useMemo<DataState>(() => {
    const c = catalog.status === 'ready' ? catalog.data : null;
    const favs = wallet.status === 'ready' ? wallet.data.favorites : [];
    return {
      catalog,
      wallet,
      recs,
      offer: (id) => c?.offers.find((o) => o.id === id),
      brand: (id) => c?.brands.find((b) => b.id === id),
      program: (id) => c?.programs.find((p) => p.id === id),
      isFavorite: (id) => favs.includes(id),
      toggleFavorite,
      openReward,
      closeReward: () => setOpenId(null),
      openId,
      refreshWallet,
      refreshRecs,
      setWallet,
    };
  }, [catalog, wallet, recs, toggleFavorite, openReward, openId, refreshWallet, refreshRecs, setWallet]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData outside provider');
  return ctx;
}
