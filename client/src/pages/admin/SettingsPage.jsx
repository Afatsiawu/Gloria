import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  Field,
  PageTitle,
} from '../../components/UI.jsx';
import { formatDateTime, titleCase } from '../../utils/format.js';

export default function SettingsPage() {
  usePageTitle('Settings');
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
      setNotice('Settings updated.');
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

  if (settings.loading) return <p className="loading">Loading…</p>;
  if (settings.error) return <ErrorState error={settings.error} retry={settings.reload} />;

  const definitions = settings.data?.definitions || {};
  const backupItems = backups.data?.items || [];
  const requestItems = requests.data?.items || [];

  return (
    <>
      <PageTitle title="Settings" subtitle="Operational thresholds, backups and data-protection requests." />

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}

      <section>
        <h2 className="section-heading">Operational settings</h2>
        <form onSubmit={save} className="form-narrow">
          {Object.entries(definitions).map(([key, definition]) => (
            <Field key={key} label={definition.label} htmlFor={`setting-${key}`} hint={`Allowed range: ${definition.min}–${definition.max}.`}>
              <input
                id={`setting-${key}`}
                type="number"
                inputMode="numeric"
                min={definition.min}
                max={definition.max}
                value={values[key] ?? ''}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
              />
            </Field>
          ))}
          <button type="submit" className="btn btn-primary" disabled={busy === 'settings'}>
            {busy === 'settings' ? 'Please wait…' : 'Save settings'}
          </button>
        </form>
      </section>

      <section>
        <div className="row between">
          <h2 className="section-heading">Database backups</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={createBackup} disabled={busy === 'backup'}>
            {busy === 'backup' ? 'Backing up…' : 'Back up now'}
          </button>
        </div>
        <p className="hint">A nightly backup also runs automatically. Older files are pruned after the retention period.</p>
        {backupItems.length === 0 ? (
          <p className="muted">No backups yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Filename</th><th className="num">Size</th><th>Created</th></tr></thead>
              <tbody>
                {backupItems.map((backup) => (
                  <tr key={backup.file}>
                    <td data-label="Filename">{backup.file}</td>
                    <td data-label="Size" className="num">{Math.round(backup.size_bytes / 1024)} KB</td>
                    <td data-label="Created">{formatDateTime(backup.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="section-heading">Data-protection requests</h2>
        {requestItems.length === 0 ? (
          <EmptyState title="No requests">No export or deletion requests have been made.</EmptyState>
        ) : (
          <div className="selection-list">
            {requestItems.map((request) => (
              <div className="selection-row" key={request.id}>
                <div className="info">
                  <div className="row">
                    <strong>{request.full_name}</strong>
                    <Badge tone={request.type === 'delete' ? 'danger' : 'info'}>{titleCase(request.type)}</Badge>
                    <Badge tone={request.status === 'completed' ? 'success' : 'warning'}>{request.status}</Badge>
                  </div>
                  <span>{request.phone} · {formatDateTime(request.created_at)}</span>
                </div>
                {request.status !== 'completed' && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `request-${request.id}`} onClick={() => processRequest(request)}>
                    Process
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <details className="details-block">
        <summary>Data retention notes</summary>
        <ul className="small muted">
          <li>Deletion requests anonymise the customer profile but keep order, payment and audit records.</li>
          <li>Prescription files are stored outside the web root and served through authenticated endpoints.</li>
          <li>Exports include profile, orders, prescription metadata, notifications, refill reminders and requests.</li>
          <li>Audit entries are append-only and include before and after values.</li>
        </ul>
      </details>
    </>
  );
}
