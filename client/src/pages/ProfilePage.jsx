import { useState } from 'react';
import { api, download } from '../api/client.js';
import { usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Field } from '../components/UI.jsx';
import { formatDate } from '../utils/format.js';

export default function ProfilePage() {
  usePageTitle('Account');
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    community: user?.community || 'Doryumu',
    deliveryAddress: user?.delivery_address || '',
    digitalAddressCode: user?.digital_address_code || '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
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
