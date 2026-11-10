import { useState } from 'react';
import { api, download } from '../api/client.js';
import { usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Field } from '../components/UI.jsx';
import { formatDate } from '../utils/format.js';

export default function ProfilePage() {
  usePageTitle('Account');
  const { user, setUser } = useAuth();
  const { show } = useToast();
  const [profile, setProfile] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    community: user?.community || 'Doryumu',
    deliveryAddress: user?.delivery_address || '',
    digitalAddressCode: user?.digital_address_code || '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [linkState, setLinkState] = useState({ code: '', devCode: '', eligible: null, message: '' });
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const update = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  const updatePassword = (key) => (event) =>
    setPasswords((current) => ({ ...current, [key]: event.target.value }));

  const run = async (key, fn, message) => {
    setBusy(key);
    setNotice('');
    setError('');
    try {
      await fn();
      setNotice(message);
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = (event) => {
    event.preventDefault();
    run(
      'profile',
      async () => {
        const result = await api('/auth/me', {
          method: 'PATCH',
          body: {
            ...profile,
            email: profile.email || undefined,
            deliveryAddress: profile.deliveryAddress || undefined,
            digitalAddressCode: profile.digitalAddressCode || undefined,
          },
        });
        setUser(result.user);
      },
      'Profile saved.'
    );
  };

  const savePassword = (event) => {
    event.preventDefault();
    run(
      'password',
      async () => {
        await api('/auth/me/password', { method: 'PATCH', body: passwords });
        setPasswords({ currentPassword: '', newPassword: '' });
      },
      'Password updated.'
    );
  };

  const requestDeletion = () => {
    if (!window.confirm('Request deletion of your account data?')) return;
    run(
      'delete',
      async () => {
        await api('/auth/me/delete-request', { method: 'POST' });
      },
      'Deletion request recorded.'
    );
  };

  const requestOrderLink = () =>
    run(
      'link-request',
      async () => {
        const result = await api('/auth/me/link-orders/request', { method: 'POST' });
        setLinkState((current) => ({
          ...current,
          eligible: result.eligible,
          devCode: result.dev_code || '',
          message: result.message,
        }));
      },
      ''
    );

  const verifyOrderLink = (event) => {
    event.preventDefault();
    run(
      'link-verify',
      async () => {
        const result = await api('/auth/me/link-orders/verify', {
          method: 'POST',
          body: { code: linkState.code },
        });
        setLinkState((current) => ({ ...current, code: '', devCode: '', eligible: false, message: result.message }));
        show(result.message);
      },
      ''
    );
  };

  return (
    <div className="account-panel">
      <h1 className="page-heading">Account</h1>
      <p className="muted">
        {user?.phone} · Member since {formatDate(user?.created_at)}
      </p>

      {notice && <p className="success-text">{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      <form className="form-narrow profile-form" onSubmit={saveProfile}>
        <Field label="Full name" htmlFor="fullName" required>
          <input id="fullName" value={profile.fullName} onChange={update('fullName')} required />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" value={profile.email} onChange={update('email')} />
        </Field>
        <Field label="Community" htmlFor="community">
          <select id="community" value={profile.community} onChange={update('community')}>
            <option value="Doryumu">Doryumu</option>
            <option value="Kordibe">Kordibe</option>
          </select>
        </Field>
        <Field label="Delivery address or landmark" htmlFor="deliveryAddress">
          <textarea
            id="deliveryAddress"
            rows={2}
            value={profile.deliveryAddress}
            onChange={update('deliveryAddress')}
          />
        </Field>
        <Field label="Ghana Post GPS address" htmlFor="digitalAddressCode" hint="For example GA-123-4567.">
          <input
            id="digitalAddressCode"
            value={profile.digitalAddressCode}
            onChange={update('digitalAddressCode')}
          />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={busy === 'profile'}>
          {busy === 'profile' ? 'Please wait…' : 'Save'}
        </button>
      </form>

      <details className="details-block">
        <summary>Change password</summary>
        <form className="form-narrow profile-form" onSubmit={savePassword}>
          <Field label="Current password" htmlFor="currentPassword" required>
            <input
              id="currentPassword"
              type="password"
              value={passwords.currentPassword}
              onChange={updatePassword('currentPassword')}
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" htmlFor="newPassword" required hint="At least 8 characters with a letter and a number.">
            <input
              id="newPassword"
              type="password"
              value={passwords.newPassword}
              onChange={updatePassword('newPassword')}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <button type="submit" className="btn btn-secondary" disabled={busy === 'password'}>
            {busy === 'password' ? 'Please wait…' : 'Change password'}
          </button>
        </form>
      </details>

      <details className="details-block">
        <summary>Past guest orders</summary>
        <p className="small muted">
          If you ordered as a guest with this phone number, we can link those orders to your account after
          you verify the code we send you. We will never link them automatically.
        </p>
        {linkState.message && <p className="small">{linkState.message}</p>}
        <div className="detail-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={requestOrderLink}
            disabled={busy === 'link-request' || busy === 'link-verify'}
          >
            {busy === 'link-request' ? 'Please wait…' : 'Send me a code'}
          </button>
        </div>
        {linkState.devCode && (
          <p className="small">
            Development code: <span className="inline-code">{linkState.devCode}</span>
          </p>
        )}
        {linkState.eligible && (
          <form className="form-narrow profile-form" onSubmit={verifyOrderLink}>
            <Field label="6-digit code" htmlFor="orderLinkCode" required>
              <input
                id="orderLinkCode"
                value={linkState.code}
                onChange={(event) =>
                  setLinkState((current) => ({
                    ...current,
                    code: event.target.value.replace(/\D/g, '').slice(0, 6),
                  }))
                }
                inputMode="numeric"
                pattern="\d{6}"
                required
              />
            </Field>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy === 'link-verify' || linkState.code.length !== 6}
            >
              {busy === 'link-verify' ? 'Please wait…' : 'Link orders'}
            </button>
          </form>
        )}
      </details>

      <details className="details-block">
        <summary>Your data</summary>
        <div className="detail-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => download('/auth/me/data', 'my-pharmalink-data.json')}
          >
            Export my data
          </button>
          <button type="button" className="btn btn-danger" onClick={requestDeletion} disabled={busy === 'delete'}>
            {busy === 'delete' ? 'Please wait…' : 'Request account deletion'}
          </button>
        </div>
      </details>
    </div>
  );
}
