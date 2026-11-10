import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../hooks/useApi.js';
import { Field } from '../components/UI.jsx';
import { CHANGE_PASSWORD_PATH, getHomeRoute, sanitizeNext } from '../config/roleRoutes.js';

function withNext(path, next) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export default function LoginPage() {
  usePageTitle('Sign in');
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const next = params.get('next') || location.state?.from || '';

  if (!loading && user) {
    const target = user.mustChangePassword
      ? CHANGE_PASSWORD_PATH
      : sanitizeNext(next, user.role) || getHomeRoute(user.role);
    return <Navigate to={target} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const signedIn = await login(identifier, password);
      if (signedIn.mustChangePassword) {
        navigate(CHANGE_PASSWORD_PATH, { replace: true });
        return;
      }
      const target = sanitizeNext(next, signedIn.role) || getHomeRoute(signedIn.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-narrow">
      <h1 className="page-heading">Sign in</h1>
      {error && <p className="error-text">{error}</p>}
      <form onSubmit={submit}>
        <Field label="Phone number or email" htmlFor="identifier" required>
          <input
            id="identifier"
            name="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Sign in'}
        </button>
      </form>
      <p className="small muted form-links">
        <Link to={withNext('/forgot-password', next)}>Forgot password</Link>
        <Link to={withNext('/register', next)}>Create account</Link>
      </p>
    </div>
  );
}
