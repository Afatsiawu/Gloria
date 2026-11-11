import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getHomeRoute } from '../config/roleRoutes.js';
import { usePageTitle } from '../hooks/useApi.js';
import { Field } from '../components/UI.jsx';

export default function ChangePasswordPage() {
  usePageTitle('Change password');
  const { user, refresh, logout } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const forced = Boolean(user?.mustChangePassword);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/', { replace: true });
    }
  };

  const submit = async (event) => {    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/me/password', {
        method: 'PATCH',
        body: { currentPassword, newPassword },
      });
      await refresh();
      show('Password updated.');
      navigate(getHomeRoute(user.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Could not change your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-narrow">
      <h1 className="page-heading">{forced ? 'Choose a new password' : 'Change password'}</h1>
      {forced && (
        <p className="muted">
          Your account was created with a temporary password. Choose your own password before using the rest of
          the system.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      <form onSubmit={submit}>
        <Field label="Current password" htmlFor="currentPassword" required>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </Field>
        <Field
          label="New password"
          htmlFor="newPassword"
          required
          hint="At least 8 characters with a letter and a number."
        >
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Save password'}
        </button>
      </form>
      {forced && (
        <p className="small muted form-links">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </p>
      )}
    </div>
  );
}
