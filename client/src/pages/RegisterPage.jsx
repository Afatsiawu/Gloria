import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { usePageTitle } from '../hooks/useApi.js';
import { Field } from '../components/UI.jsx';
import { CHANGE_PASSWORD_PATH, getHomeRoute, sanitizeNext } from '../config/roleRoutes.js';

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
  const { register, user, loading } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const next = params.get('next') || location.state?.from || '';

  if (!loading && user) {
    const target = user.mustChangePassword
      ? CHANGE_PASSWORD_PATH
      : sanitizeNext(next, user.role) || getHomeRoute(user.role);
    return <Navigate to={target} replace />;
  }

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const created = await register({
        ...form,
        email: form.email || undefined,
        deliveryAddress: form.deliveryAddress || undefined,
        digitalAddressCode: form.digitalAddressCode || undefined,
      });
      show('Account created.');
      const target = sanitizeNext(next, created.role) || getHomeRoute(created.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not create the account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-narrow">
      <h1 className="page-heading">Create account</h1>
      {error && <p className="error-text">{error}</p>}
      <form onSubmit={submit}>
        <Field label="Full name" htmlFor="fullName" required>
          <input
            id="fullName"
            value={form.fullName}
            onChange={update('fullName')}
            autoComplete="name"
            required
            minLength={2}
          />
        </Field>
        <Field label="Phone number" htmlFor="phone" required>
          <input
            id="phone"
            value={form.phone}
            onChange={update('phone')}
            autoComplete="tel"
            inputMode="tel"
            required
          />
        </Field>
        <Field label="Email (optional)" htmlFor="email">
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
            inputMode="email"
          />
        </Field>
        <Field label="Password" htmlFor="password" required hint="At least 8 characters with a letter and a number.">
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>
        <Field label="Community" htmlFor="community" required>
          <select id="community" value={form.community} onChange={update('community')}>
            <option value="Doryumu">Doryumu</option>
            <option value="Kordibe">Kordibe</option>
          </select>
        </Field>
        <Field label="Ghana Post GPS address (optional)" htmlFor="digitalAddressCode" hint="For example GA-123-4567.">
          <input
            id="digitalAddressCode"
            value={form.digitalAddressCode}
            onChange={update('digitalAddressCode')}
            placeholder="GA-123-4567"
          />
        </Field>
        <Field label="Delivery address or landmark (optional)" htmlFor="deliveryAddress">
          <textarea
            id="deliveryAddress"
            rows={2}
            value={form.deliveryAddress}
            onChange={update('deliveryAddress')}
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={form.consent} onChange={update('consent')} required />
          <span>I agree to my health data being used to fulfil my orders.</span>
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Create account'}
        </button>
      </form>
      <p className="small muted form-links">
        <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in</Link>
      </p>
    </div>
  );
}
