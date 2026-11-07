import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePageTitle } from '../hooks/useApi.js';
import { Alert, Field } from '../components/UI.jsx';

export default function ForgotPasswordPage() {
  usePageTitle('Forgot password');
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState('sms');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      setResult(await api('/auth/forgot-password', { method: 'POST', body: { identifier, channel } }));
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
          <h1>Reset your password</h1>
          <p className="muted mb-0">We will send a one-time 6-digit code that expires in 10 minutes.</p>
        </div>
        <div className="card-body">
          {error && <Alert tone="error">{error.message}</Alert>}
          {result && (
            <Alert tone="success">
              <p>{result.message}</p>
              {result.dev_code && (
                <p className="mb-0">
                  <strong>Development code:</strong> <span className="inline-code">{result.dev_code}</span>
                </p>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-1"
                onClick={() => navigate(`/reset-password?identifier=${encodeURIComponent(identifier)}`)}
              >
                Enter the code
              </button>
            </Alert>
          )}
          <form onSubmit={submit} className="stack">
            <Field label="Phone number or email" htmlFor="identifier" required>
              <input id="identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" />
            </Field>
            <Field label="Send the code by" htmlFor="channel">
              <select id="channel" value={channel} onChange={(event) => setChannel(event.target.value)}>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </Field>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset code'}
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
