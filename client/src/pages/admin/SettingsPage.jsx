import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { Alert, Badge, EmptyState, ErrorState, Field, PageHeader, Skeleton } from '../../components/UI.jsx';
import { formatDateTime, titleCase } from '../../utils/format.js';

export default function SettingsPage() {
  usePageTitle('Settings & privacy');
  const settings = useFetch('/admin/settings');
  const backups = useFetch('/admin/backups');
  const requests = useFetch('/admin/data-requests');
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (settings.data?.values) setValues(settings.data.values);
  }, [settings.data]);

  const save = async (event) => {
    event.preventDefault();
    setBusy('settings');
    setNotice(null);
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)]));
      await api('/admin/settings', { method: 'PATCH', body: payload });
      setNotice('Settings updated. Cron jobs and forecasts will use the new values.');
      settings.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const createBackup = async () => {
    setBusy('backup');
    setNotice(null);
    setError(null);
    try {
      const result = await api('/admin/backups', { method: 'POST' });
      setNotice(`Backup created: ${result.backup.file || result.backup.message || 'complete'}`);
      backups.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const processRequest = async (request) => {
    if (!window.confirm(`Process this ${request.type} request for ${request.full_name}? This cannot be undone.`)) return;
    setBusy(`request-${request.id}`);
    setNotice(null);
    setError(null);
    try {
      await api(`/admin/data-requests/${request.id}/process`, { method: 'POST' });
      setNotice('Data request processed.');
      requests.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  if (settings.loading) return <Skeleton lines={8} />;
  if (settings.error) return <ErrorState error={settings.error} retry={settings.reload} />;

  const definitions = settings.data?.definitions || {};

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Settings, privacy & backups"
        subtitle="Operational thresholds, scheduled backups and data-protection requests."
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header"><h2>Operational settings</h2></div>
          <div className="card-body">
            <form onSubmit={save} className="stack">
              {Object.entries(definitions).map(([key, definition]) => (
                <Field key={key} label={definition.label} htmlFor={`setting-${key}`} hint={`Allowed range: ${definition.min}–${definition.max}.`}>
                  <input
                    id={`setting-${key}`}
                    type="number"
                    min={definition.min}
                    max={definition.max}
                    value={values[key] ?? ''}
                    onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </Field>
              ))}
              <button type="submit" className="btn btn-primary" disabled={busy === 'settings'}>
                {busy === 'settings' ? 'Saving…' : 'Save settings'}
              </button>
            </form>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-header">
              <h2>Database backups</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={createBackup} disabled={busy === 'backup'}>
                {busy === 'backup' ? 'Backing up…' : 'Back up now'}
              </button>
            </div>
            <div className="card-body">
              <p className="small muted">
                SQLite is backed up with the online backup API. A nightly job also runs and files older than the
                retention period are pruned. Store copies off the server for disaster recovery.
              </p>
              {(backups.data?.items || []).length === 0 ? (
                <p className="muted mb-0">No backups yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Filename</th><th className="text-right">Size</th><th>Created</th></tr></thead>
                    <tbody>
                      {backups.data.items.map((backup) => (
                        <tr key={backup.file}>
                          <td className="small">{backup.file}</td>
                          <td className="text-right small">{Math.round(backup.size_bytes / 1024)} KB</td>
                          <td className="small muted">{formatDateTime(backup.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2>Data-protection requests</h2></div>
            <div className="card-body">
              {(requests.data?.items || []).length === 0 ? (
                <p className="muted mb-0">No export or deletion requests.</p>
              ) : (
                <div className="alert-list">
                  {requests.data.items.map((request) => (
                    <div className="alert-item" key={request.id}>
                      <div className="row between full">
                        <div>
                          <div className="row">
                            <strong>{request.full_name}</strong>
                            <Badge tone={request.type === 'delete' ? 'danger' : 'info'}>{titleCase(request.type)}</Badge>
                            <Badge tone={request.status === 'completed' ? 'success' : 'warning'}>{request.status}</Badge>
                          </div>
                          <div className="tiny muted">{request.phone} · requested {formatDateTime(request.created_at)}</div>
                        </div>
                        {request.status !== 'completed' && (
                          <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `request-${request.id}`} onClick={() => processRequest(request)}>
                            Process
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="card mt-3">
        <div className="card-header"><h2>Data-retention notes</h2></div>
        <div className="card-body">
          <ul className="small muted">
            <li>Deletion requests anonymise the customer profile but retain order, payment and audit records that pharmacies must keep.</li>
            <li>Prescription files live outside the web root and are served only through an authenticated, role-checked endpoint.</li>
            <li>Customer data exports include profile, orders, prescriptions metadata, notifications, refill reminders and prior requests.</li>
            <li>Audit entries are append-only and include before/after values for investigation.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
