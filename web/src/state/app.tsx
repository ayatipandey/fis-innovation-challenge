import { optionById } from '@shared/demo-data';
import type { Hold } from '@shared/types';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { RedeemDialog } from '../components/RedeemDialog';
import type { Summary } from '../lib/types';
import { useApi } from '../lib/useApi';

interface AppState {
  summary: Summary | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  /** Opens the redeem pop-up for a reward, or resumes an active hold. */
  redeem: (optionId: string, hold?: Hold) => void;
  available: (programId: string) => number;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, reload } = useApi<Summary>('/me/summary');
  const [open, setOpen] = useState<{ optionId: string; hold: Hold | null } | null>(null);

  const redeem = useCallback((optionId: string, hold?: Hold) => setOpen({ optionId, hold: hold ?? null }), []);
  const available = useCallback(
    (programId: string) => data?.programs.find((p) => p.program.id === programId)?.link.available ?? 0,
    [data],
  );

  const value = useMemo(() => ({ summary: data, error, loading, reload, redeem, available }), [data, error, loading, reload, redeem, available]);
  const programId = open ? optionById(open.optionId)?.programId : undefined;

  return (
    <Ctx.Provider value={value}>
      {children}
      <RedeemDialog
        optionId={open?.optionId ?? null}
        hold={open?.hold}
        available={open?.hold ? undefined : programId ? available(programId) : undefined}
        onClose={() => setOpen(null)}
        onChanged={() => void reload()}
      />
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}
