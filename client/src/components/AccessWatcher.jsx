import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getHomeRoute } from '../config/roleRoutes.js';

/**
 * Turns a server 403 on a staff-area page into the same "wrong area" redirect
 * the client guards use. This catches cross-pharmacy URLs that look valid to
 * the client. Customer data pages keep their own inline error, so a missing
 * order or prescription never ejects the customer.
 */
const STAFF_AREA = /^\/(?:dashboard|staff|admin|rider)(?:\/|$)/;

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
      if (!STAFF_AREA.test(state.current.pathname)) return;
      if (event.detail?.method && event.detail.method !== 'GET') return;
      if (event.detail?.path && !STAFF_AREA.test(event.detail.path)) return;
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
