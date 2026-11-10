import { RequireAuth, RequireRole } from './guards.jsx';

/** Backwards-compatible wrapper around the shared guards. */
export default function ProtectedRoute({ roles }) {
  return roles ? <RequireRole roles={roles} /> : <RequireAuth />;
}
