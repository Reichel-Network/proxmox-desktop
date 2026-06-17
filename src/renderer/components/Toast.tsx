import React, { createContext, useCallback, useContext, useState } from 'react';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

interface ToastCtx {
  push: (t: Omit<Toast, 'id'>) => void;
  success: (msg: string, title?: string) => void;
  error: (msg: string, title?: string) => void;
  info: (msg: string, title?: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used within ToastProvider');
  return c;
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++counter;
      setToasts((cur) => [...cur, { ...t, id }]);
      setTimeout(() => remove(id), t.type === 'error' ? 7000 : 4000);
    },
    [remove]
  );

  const api: ToastCtx = {
    push,
    success: (message, title) => push({ type: 'success', message, title }),
    error: (message, title) => push({ type: 'error', message, title }),
    info: (message, title) => push({ type: 'info', message, title }),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} onClick={() => remove(t.id)}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
            <div className="toast-msg">
              {t.title && <div className="toast-title">{t.title}</div>}
              <div>{t.message}</div>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
