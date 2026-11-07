import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePageTitle } from '../hooks/useApi.js';
import { Alert, Field } from '../components/UI.jsx';

export default function ResetPasswordPage() {
  usePageTitle('Reset password');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(params.get('identifier') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await api('/auth/reset-password', { method: 'POST', body: { identifier, code, password } });
      setMessage(result.message);
      setTimeout(() => navigate('/login'), 1200);
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
          <h1>Choose a new password</h1>
          <p className="muted mb-0">Enter the one-time code sent to you and a new password.</p>
        </div>
        <div className="card-body">
          {error && <Alert tone="error">{error.message}</Alert>}
          {message && <Alert tone="success">{message}</Alert>}
          <form onSubmit={submit} className="stack">
            <Field label="Phone number or email" htmlFor="identifier" required>
              <input id="identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" />
            </Field>
            <Field label="6-digit code" htmlFor="code" required>
              <input id="code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="\d{6}" required />
            </Field>
            <Field label="New password" htmlFor="password" required hint="At least 8 characters with a letter and a number.">
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" />
            </Field>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
          <p className="small text-center mt-2 mb-0">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
