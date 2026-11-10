import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { CHANGE_PASSWORD_PATH, getHomeRoute, isRouteAllowed } from '../config/roleRoutes.js';

export function SessionLoading() {
  return (
    <div className="center-screen" aria-busy="true">
      <p>Loading…</p>
      <span className="sr-only">Checking your session</span>
    </div>
  );
}

function LoginRedirect({ location }) {
  const next = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
}

function RedirectToHome({ role }) {
  const { show } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    show('That page is not available for your account.', 'error');
    navigate(getHomeRoute(role), { replace: true });
  }, [navigate, role, show]);

  return <SessionLoading />;
}

function useMustChangePasswordRedirect(user, location) {
  if (!user?.mustChangePassword) return null;
  if (location.pathname === CHANGE_PASSWORD_PATH) return null;
  return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <SessionLoading />;
  if (!user) return <LoginRedirect location={location} />;

  const passwordRedirect = useMustChangePasswordRedirect(user, location);
  if (passwordRedirect) return passwordRedirect;
  return <Outlet />;
}

export function RequireRole({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <SessionLoading />;
  if (!user) return <LoginRedirect location={location} />;

  const passwordRedirect = useMustChangePasswordRedirect(user, location);
  if (passwordRedirect) return passwordRedirect;

  const allowed = roles.includes(user.role) && isRouteAllowed(user.role, location.pathname);
  if (!allowed) return <RedirectToHome role={user.role} />;
  return <Outlet />;
}
