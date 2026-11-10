import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Toast } from '../components/UI.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((message, tone = 'success') => {
    if (!message) return;
    window.clearTimeout(timer.current);
    setToast({ message, tone, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast key={toast?.id} tone={toast?.tone} onClose={toast ? dismiss : undefined}>
        {toast?.message}
      </Toast>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || { show: () => {}, dismiss: () => {} };
}
