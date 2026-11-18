import { useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { Alert, Badge, EmptyState, ErrorState, PageTitle, Tabs } from '../../components/UI.jsx';
import { formatDateTime, titleCase } from '../../utils/format.js';

export default function OutboxPage() {
  usePageTitle('Outbox');
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
      <PageTitle title="Outbox" subtitle="Messages sent by the system. Available in development and test only." />

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}

      <div className="row mb-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy === 'stock-alerts'} onClick={() => runJob('stock-alerts')}>
          {busy === 'stock-alerts' ? 'Please wait…' : 'Run stock alerts'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy === 'refill-reminders'} onClick={() => runJob('refill-reminders')}>
          {busy === 'refill-reminders' ? 'Please wait…' : 'Run refill reminders'}
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
        label="Message channel"
      />

      {loadError && <ErrorState error={loadError} retry={reload} />}
      {loading && <p className="loading">Loading…</p>}

      {!loading && !loadError && items.length === 0 && (
        <EmptyState title="Outbox is empty">Messages appear after orders, prescription decisions and reminder jobs.</EmptyState>
      )}

      {!loading && items.length > 0 && (
        <ul className="notification-list">
          {items.map((item) => (
            <li className="notification-item" key={item.id}>
              <div className="notification-head">
                <div className="row">
                  <Badge tone={item.status === 'sent' ? 'success' : 'warning'}>{item.status}</Badge>
                  <span className="small">{item.channel}</span>
                </div>
                <span className="tiny muted">{formatDateTime(item.created_at)}</span>
              </div>
              <p>{item.message}</p>
              <span className="tiny muted">{titleCase(item.event)} · User #{item.user_id}{item.order_id ? ` · Order #${item.order_id}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
