import { useState } from 'react';
import { api, download } from '../api/client.js';
import { usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Field, PageHeader } from '../components/UI.jsx';
import { formatDate } from '../utils/format.js';

export default function ProfilePage() {
  usePageTitle('Profile & privacy');
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
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const update = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  const updatePassword = (key) => (event) => setPasswords((current) => ({ ...current, [key]: event.target.value }));

  const run = async (key, fn, message) => {
    setBusy(key);
    setNotice(null);
    setError(null);
    try {
      await fn();
      setNotice(message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = (event) => {
    event.preventDefault();
    run('profile', async () => {
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
    }, 'Profile updated.');
  };

  const savePassword = (event) => {
    event.preventDefault();
    run('password', async () => {
      await api('/auth/me/password', { method: 'PATCH', body: passwords });
      setPasswords({ currentPassword: '', newPassword: '' });
    }, 'Password updated.');
  };

  const requestDeletion = () => {
    if (!window.confirm('Request deletion of your account data? An administrator will process it within 30 days.')) return;
    run('delete', async () => {
      await api('/auth/me/delete-request', { method: 'POST' });
    }, 'Deletion request logged. An administrator will process it within 30 days.');
  };

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Profile & privacy"
        subtitle="Keep your contact details current and exercise your data-protection rights."
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header"><h2>Contact details</h2></div>
          <div className="card-body">
            <form onSubmit={saveProfile} className="stack">
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
                <textarea id="deliveryAddress" rows={2} value={profile.deliveryAddress} onChange={update('deliveryAddress')} />
              </Field>
              <Field label="Ghana Post GPS digital address" htmlFor="digitalAddressCode" hint="Format: GA-123-4567.">
                <input id="digitalAddressCode" value={profile.digitalAddressCode} onChange={update('digitalAddressCode')} />
              </Field>
              <button type="submit" className="btn btn-primary" disabled={busy === 'profile'}>
                {busy === 'profile' ? 'Saving…' : 'Save profile'}
              </button>
            </form>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-header"><h2>Account</h2></div>
            <div className="card-body">
              <div className="definition-list">
                <div><dt>Phone</dt><dd>{user?.phone}</dd></div>
                <div><dt>Role</dt><dd>{user?.role}</dd></div>
                <div><dt>Member since</dt><dd>{formatDate(user?.created_at)}</dd></div>
                {user?.pharmacy_name && <div><dt>Pharmacy</dt><dd>{user.pharmacy_name}</dd></div>}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2>Change password</h2></div>
            <div className="card-body">
              <form onSubmit={savePassword} className="stack">
                <Field label="Current password" htmlFor="currentPassword" required>
                  <input id="currentPassword" type="password" value={passwords.currentPassword} onChange={updatePassword('currentPassword')} required autoComplete="current-password" />
                </Field>
                <Field label="New password" htmlFor="newPassword" required hint="At least 8 characters with a letter and a number.">
                  <input id="newPassword" type="password" value={passwords.newPassword} onChange={updatePassword('newPassword')} required minLength={8} autoComplete="new-password" />
                </Field>
                <button type="submit" className="btn btn-secondary" disabled={busy === 'password'}>
                  {busy === 'password' ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2>Your data</h2></div>
            <div className="card-body">
              <p className="small muted">
                Under Ghana&apos;s Data Protection Act 2012 (Act 843) you can request a copy of your data or ask
                for your account to be deleted. Deletion anonymises your profile but retains order records that
                pharmacies must keep for audit and regulatory purposes.
              </p>
              <div className="stack">
                <button type="button" className="btn btn-secondary" onClick={() => download('/auth/me/data', 'my-pharmalink-data.json')}>
                  Export my data (JSON)
                </button>
                <button type="button" className="btn btn-danger" onClick={requestDeletion} disabled={busy === 'delete'}>
                  {busy === 'delete' ? 'Submitting…' : 'Request account deletion'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
