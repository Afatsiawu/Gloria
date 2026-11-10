import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePageTitle } from '../hooks/useApi.js';
import { Field } from '../components/UI.jsx';

export default function ForgotPasswordPage() {
  usePageTitle('Forgot password');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '';
  const suffix = next ? `?next=${encodeURIComponent(next)}` : '';
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState('sms');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);
    setSubmitting(true);
    try {
      setResult(await api('/auth/forgot-password', { method: 'POST', body: { identifier, channel } }));
    } catch (err) {
      setError(err.message || 'Could not send the code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-narrow">
      <h1 className="page-heading">Reset password</h1>
      <p className="muted">We will send a 6-digit code that expires in 10 minutes.</p>
      {error && <p className="error-text">{error}</p>}
      {result && (
        <div className="alert alert-success">
          <p>{result.message}</p>
          {result.dev_code && (
            <p>
              Development code: <span className="inline-code">{result.dev_code}</span>
            </p>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              navigate(`/reset-password?identifier=${encodeURIComponent(identifier)}${next ? `&next=${encodeURIComponent(next)}` : ''}`)
            }
          >
            Enter the code
          </button>
        </div>
      )}
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
        <Field label="Send the code by" htmlFor="channel">
          <select id="channel" value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Send code'}
        </button>
      </form>
      <p className="small muted form-links">
        <Link to={`/login${suffix}`}>Back to sign in</Link>
      </p>
    </div>
  );
}
