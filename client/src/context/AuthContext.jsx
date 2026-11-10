import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ensureCsrf } from '../api/client.js';
import { getHomeRoute } from '../config/roleRoutes.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

const CHANNEL_NAME = 'pharmalink-auth';
const STORAGE_KEY = 'pharmalink_auth_event';

export function AuthProvider({ children }) {
  const { show } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef(null);

  const applyUser = useCallback((next) => {
    userRef.current = next;
    setUser(next);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await ensureCsrf();
      try {
        const data = await api('/auth/me');
        if (active) applyUser(data.user);
      } catch {
        if (active) applyUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyUser]);

  const clearLocalSession = useCallback(
    ({ notify = false } = {}) => {
      const hadUser = Boolean(userRef.current);
      applyUser(null);
      window.dispatchEvent(new CustomEvent('auth:logout'));
      if (notify && hadUser) show('You have been logged out.');
    },
    [applyUser, show]
  );

  const broadcast = useCallback((type) => {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type });
      channel.close();
    } catch {
      // BroadcastChannel is unavailable in older browsers; storage still works.
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ type, at: Date.now() }));
    } catch {
      // Private browsing modes may block storage.
    }
  }, []);

  useEffect(() => {
    let channel = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === 'logout') clearLocalSession({ notify: true });
      };
    } catch {
      channel = null;
    }
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const data = JSON.parse(event.newValue);
        if (data.type === 'logout') clearLocalSession({ notify: true });
      } catch {
        // Ignore malformed values written by other scripts.
      }
    };
    const onExpired = () => {
      if (!userRef.current) return;
      applyUser(null);
      window.dispatchEvent(new CustomEvent('auth:logout'));
      show('Please sign in again.');
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('auth:expired', onExpired);
    return () => {
      channel?.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth:expired', onExpired);
    };
  }, [applyUser, clearLocalSession, show]);

  const login = useCallback(
    async (identifier, password) => {
      const data = await api('/auth/login', { method: 'POST', body: { identifier, password } });
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  const register = useCallback(
    async (payload) => {
      const data = await api('/auth/register', { method: 'POST', body: payload });
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      clearLocalSession({ notify: true });
      broadcast('logout');
    }
  }, [broadcast, clearLocalSession]);

  const refresh = useCallback(async () => {
    try {
      const data = await api('/auth/me');
      applyUser(data.user);
      return data.user;
    } catch {
      applyUser(null);
      return null;
    }
  }, [applyUser]);

  const value = useMemo(
    () => ({ user, setUser: applyUser, loading, login, register, logout, refresh }),
    [user, applyUser, loading, login, register, logout, refresh]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

// Kept as a named export so existing pages keep working while routing moves to
// the shared config.
export const roleHome = getHomeRoute;
