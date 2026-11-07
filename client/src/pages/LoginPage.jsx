import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, roleHome } from '../context/AuthContext.jsx';
import { usePageTitle } from '../hooks/useApi.js';
import { Alert, Field } from '../components/UI.jsx';

const DEMO = [
  { label: 'Customer', identifier: '+233243000001', password: 'Customer123!' },
  { label: 'Pharmacist', identifier: '+233241000001', password: 'Pharm123!' },
  { label: 'Administrator', identifier: '+233240000001', password: 'Admin123!' },
  { label: 'Rider', identifier: '+233242000001', password: 'Rider123!' },
];

export default function LoginPage() {
  usePageTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(identifier, password);
      const from = location.state?.from;
      navigate(from || roleHome(user.role), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-narrow">
      <div className="card login-card">
        <div className="card-header">
          <h1>Welcome back</h1>
          <p className="muted mb-0">Sign in to manage orders, prescriptions and refills.</p>
        </div>
        <div className="card-body">
          {error && <Alert tone="error">{error.message}</Alert>}
          <form onSubmit={submit} className="stack">
            <Field label="Phone number or email" htmlFor="identifier" required>
              <input
                id="identifier"
                name="identifier"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="024 300 0001 or you@example.com"
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
            <div className="row between">
              <Link to="/forgot-password" className="small">Forgot your password?</Link>
              <Link to="/register" className="small">Create an account</Link>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="demo-hint mt-3">
            <strong>Demo accounts</strong>
            <p className="tiny muted">Click a role to fill its credentials. Password is shown for the demo only.</p>
            <div className="role-tabs">
              {DEMO.map((account) => (
                <button
                  key={account.label}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setIdentifier(account.identifier);
                    setPassword(account.password);
                  }}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
