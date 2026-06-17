import { createContext, useContext, useEffect, useState } from 'react';
import type { UpdateStatus } from '@shared/types';

interface UpdateCtxValue {
  status: UpdateStatus | null;
  ready: boolean;
  version?: string;
  dismiss: () => void;
}

const UpdateContext = createContext<UpdateCtxValue>({
  status: null,
  ready: false,
  dismiss: () => {},
});

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!window.pmx?.updates?.onEvent) return;
    const unsub = window.pmx.updates.onEvent((s) => setStatus(s));
    return unsub;
  }, []);

  const ready = status?.event === 'downloaded' && status.version !== dismissed;

  return (
    <UpdateContext.Provider value={{ status, ready, version: status?.version, dismiss: () => setDismissed(status?.version || '') }}>
      {children}
    </UpdateContext.Provider>
  );
}

export const useUpdate = () => useContext(UpdateContext);
