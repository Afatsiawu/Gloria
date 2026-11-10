import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePageTitle } from '../hooks/useApi.js';
import { Field } from '../components/UI.jsx';

export default function ResetPasswordPage() {
  usePageTitle('Reset password');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') || '';
  const [identifier, setIdentifier] = useState(params.get('identifier') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const result = await api('/auth/reset-password', { method: 'POST', body: { identifier, code, password } });
      setMessage(result.message);
      setTimeout(() => navigate(next ? `/login?next=${encodeURIComponent(next)}` : '/login'), 1200);
    } catch (err) {
      setError(err.message || 'Could not reset the password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-narrow">
      <h1 className="page-heading">New password</h1>
      <p className="muted">Enter the code sent to you and choose a new password.</p>
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}
      <form onSubmit={submit}>
        <Field label="Phone number or email" htmlFor="identifier" required>
          <input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
            autoComplete="username"
          />
        </Field>
        <Field label="6-digit code" htmlFor="code" required>
          <input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            pattern="\d{6}"
            required
          />
        </Field>
        <Field label="New password" htmlFor="password" required hint="At least 8 characters with a letter and a number.">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Reset password'}
        </button>
      </form>
      <p className="small muted form-links">
        <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Back to sign in</Link>
      </p>
    </div>
  );
}
