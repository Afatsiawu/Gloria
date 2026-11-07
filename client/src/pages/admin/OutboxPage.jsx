import { useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { Alert, Badge, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '../../components/UI.jsx';
import { formatDateTime, titleCase } from '../../utils/format.js';

export default function OutboxPage() {
  usePageTitle('Mock outbox');
  const [channel, setChannel] = useState('all');
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const path = `/dev/outbox${channel === 'all' ? '' : `?channel=${channel}`}`;
  const { data, loading, error: loadError, reload } = useFetch(path);

  const runJob = async (job) => {
    setBusy(job);
    setNotice(null);
    setError(null);
    try {
      const result = await api(`/dev/jobs/${job}`, { method: 'POST' });
      setNotice(`${titleCase(job)} completed: ${result.sent} notification(s) sent.`);
      reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const items = data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow="Developer tools"
        title="Mock message outbox"
        subtitle="Every SMS, email and in-app notification is retained here. Real providers can be plugged in through the adapter pattern without changing business code."
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>}
      />

      <Alert tone="info">
        This page is available in development and test only. It returns 404 when NODE_ENV=production.
      </Alert>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}

      <div className="row mb-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy === 'stock-alerts'} onClick={() => runJob('stock-alerts')}>
          {busy === 'stock-alerts' ? 'Running…' : 'Run stock alerts job'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy === 'refill-reminders'} onClick={() => runJob('refill-reminders')}>
          {busy === 'refill-reminders' ? 'Running…' : 'Run refill reminders job'}
        </button>
      </div>

      <Tabs
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'in_app', label: 'In-app' },
          { value: 'sms', label: 'SMS' },
          { value: 'email', label: 'Email' },
        ]}
        active={channel}
        onChange={setChannel}
      />

      {loadError && <ErrorState error={loadError} retry={reload} />}
      {loading && <Skeleton lines={6} />}

      {!loading && !loadError && items.length === 0 && (
        <EmptyState title="Outbox is empty">Notifications appear after orders, prescription decisions and reminder jobs.</EmptyState>
      )}

      {!loading && items.length > 0 && (
        <div className="card">
          <div className="card-body">
            {items.map((item) => (
              <div className="notification-item" key={item.id}>
                <div>
                  <div className="row">
                    <Badge tone={item.channel === 'in_app' ? 'info' : item.channel === 'sms' ? 'teal' : 'neutral'}>{item.channel}</Badge>
                    <Badge tone={item.status === 'sent' ? 'success' : 'warning'}>{item.status}</Badge>
                    <span className="tiny muted">User #{item.user_id}{item.order_id ? ` · Order #${item.order_id}` : ''}</span>
                  </div>
                  <p className="mb-0 mt-1">{item.message}</p>
                  <span className="notification-meta">{titleCase(item.event)} · {formatDateTime(item.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
