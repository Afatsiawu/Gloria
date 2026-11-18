import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { EmptyState, ErrorState, Loading } from '../components/UI.jsx';
import { formatDateTime, titleCase } from '../utils/format.js';

export default function NotificationsPage() {
  usePageTitle('Notifications');
  const { data, loading, error, reload } = useFetch('/auth/me/notifications');

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;

  const items = data?.items || [];

  return (
    <>
      <h1 className="page-heading">Notifications</h1>

      {items.length === 0 && (
        <EmptyState title="No notifications">
          Order updates and refill reminders will appear here.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ul className="notification-list">
          {items.map((notification) => (
            <li key={notification.id} className="notification-item">
              <div className="notification-head">
                <strong>{titleCase(notification.event)}</strong>
                <span className="small muted">
                  {notification.channel === 'in_app' ? 'In-app' : notification.channel.toUpperCase()}
                </span>
              </div>
              <p>{notification.message}</p>
              <span className="small muted">{formatDateTime(notification.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
