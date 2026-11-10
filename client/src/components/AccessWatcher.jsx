import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getHomeRoute } from '../config/roleRoutes.js';

/**
 * Turns a server 403 into the same "wrong area" redirect the client guards
 * use. This catches cross-pharmacy URLs that look valid to the client.
 * Only page loads (GET) redirect; failed saves keep their inline error.
 */
export default function AccessWatcher({ children }) {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const state = useRef({ user, pathname: location.pathname });

  state.current = { user, pathname: location.pathname };

  useEffect(() => {
    const onForbidden = async (event) => {
      if (!state.current.user) return;
      if (event.detail?.method && event.detail.method !== 'GET') return;
      const fresh = await refresh();
      const role = fresh?.role;
      if (!role) return;
      show('That page is not available for your account.', 'error');
      navigate(getHomeRoute(role), { replace: true });
    };
    window.addEventListener('auth:forbidden', onForbidden);
    return () => window.removeEventListener('auth:forbidden', onForbidden);
  }, [navigate, refresh, show]);

  return children;
}
