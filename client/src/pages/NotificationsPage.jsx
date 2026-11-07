import { useState } from 'react';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '../components/UI.jsx';
import { formatDateTime, titleCase } from '../utils/format.js';

export default function NotificationsPage() {
  usePageTitle('Notifications');
  const { data, loading, error, reload } = useFetch('/auth/me/notifications');
  const [channel, setChannel] = useState('all');

  const items = (data?.items || []).filter((item) => channel === 'all' || item.channel === channel);

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Notifications"
        subtitle="Order updates, prescription decisions, payment confirmations and refill reminders."
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>}
      />

      <Tabs
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'in_app', label: 'In-app' },
          { value: 'sms', label: 'SMS' },
          { value: 'email', label: 'Email' },
        ]}
        active={channel}
        onChange={setChannel}
        label="Filter notifications by channel"
      />

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Skeleton lines={6} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState title="No notifications here">
          Notifications appear when you place an order, upload a prescription, receive a payment update or a
          refill reminder becomes due.
        </EmptyState>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="card">
          <div className="card-body">
            {items.map((notification) => (
              <div className="notification-item" key={notification.id}>
                <div>
                  <div className="row">
                    <strong>{titleCase(notification.event)}</strong>
                    <Badge tone={notification.channel === 'in_app' ? 'info' : notification.channel === 'sms' ? 'teal' : 'neutral'}>
                      {notification.channel === 'in_app' ? 'In-app' : notification.channel.toUpperCase()}
                    </Badge>
                    {notification.status && <Badge tone={notification.status === 'sent' ? 'success' : 'warning'}>{notification.status}</Badge>}
                  </div>
                  <p className="mb-0 mt-1">{notification.message}</p>
                  <span className="notification-meta">{formatDateTime(notification.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
