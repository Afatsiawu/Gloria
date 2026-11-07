import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../hooks/useApi.js';
import { Alert, Field } from '../components/UI.jsx';

const EMPTY = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  community: 'Doryumu',
  deliveryAddress: '',
  digitalAddressCode: '',
  consent: false,
};

export default function RegisterPage() {
  usePageTitle('Create account');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        ...form,
        email: form.email || undefined,
        deliveryAddress: form.deliveryAddress || undefined,
        digitalAddressCode: form.digitalAddressCode || undefined,
      });
      navigate('/search', { replace: true });
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
          <h1>Create your account</h1>
          <p className="muted mb-0">
            Order from 10 licensed pharmacies in Doryumu and Kordibe. Free to join.
          </p>
        </div>
        <div className="card-body">
          {error && <Alert tone="error">{error.message}</Alert>}
          <form onSubmit={submit} className="stack">
            <div className="form-grid">
              <Field label="Full name" htmlFor="fullName" required>
                <input id="fullName" value={form.fullName} onChange={update('fullName')} autoComplete="name" required minLength={2} />
              </Field>
              <Field label="Phone number" htmlFor="phone" required hint="Ghana mobile, for example 024 123 4567.">
                <input id="phone" value={form.phone} onChange={update('phone')} autoComplete="tel" required />
              </Field>
              <Field label="Email (optional)" htmlFor="email">
                <input id="email" type="email" value={form.email} onChange={update('email')} autoComplete="email" />
              </Field>
              <Field label="Password" htmlFor="password" required hint="At least 8 characters with a letter and a number.">
                <input id="password" type="password" value={form.password} onChange={update('password')} autoComplete="new-password" required minLength={8} />
              </Field>
              <Field label="Community" htmlFor="community" required>
                <select id="community" value={form.community} onChange={update('community')}>
                  <option value="Doryumu">Doryumu</option>
                  <option value="Kordibe">Kordibe</option>
                </select>
              </Field>
              <Field label="Digital address (optional)" htmlFor="digitalAddressCode" hint="Ghana Post GPS, for example GA-123-4567.">
                <input id="digitalAddressCode" value={form.digitalAddressCode} onChange={update('digitalAddressCode')} placeholder="GA-123-4567" />
              </Field>
            </div>
            <Field label="Delivery address or landmark (optional)" htmlFor="deliveryAddress">
              <textarea id="deliveryAddress" rows={2} value={form.deliveryAddress} onChange={update('deliveryAddress')} />
            </Field>
            <label className="checkbox">
              <input type="checkbox" checked={form.consent} onChange={update('consent')} required />
              <span>
                I consent to PharmaLink processing my personal and health data to fulfil orders, under Ghana&apos;s
                Data Protection Act 2012 (Act 843). I can export or request deletion of my data at any time.
              </span>
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="small text-center mt-2 mb-0">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
