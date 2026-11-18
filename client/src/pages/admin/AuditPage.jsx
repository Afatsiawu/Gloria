import { useState } from 'react';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageTitle,
  Pagination,
} from '../../components/UI.jsx';
import { formatDateTime, titleCase } from '../../utils/format.js';

function Payload({ value }) {
  if (!value) return <span className="muted">—</span>;
  let text = value;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    text = JSON.stringify(parsed, null, 2);
  } catch {
    text = String(value);
  }
  return <pre className="json">{text}</pre>;
}

export default function AuditPage() {
  usePageTitle('Audit log');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ page, pageSize: '25' });
  if (action) query.set('action', action);
  if (entity) query.set('entity', entity);
  const { data, loading, error, reload } = useFetch(`/admin/audit?${query.toString()}`);

  const items = data?.items || [];

  return (
    <>
      <PageTitle title="Audit log" subtitle="Append-only record of actions taken in the system." />

      <div className="toolbar">
        <Field label="Action" htmlFor="audit-action" className="inline-field">
          <input id="audit-action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder="For example order_placed" />
        </Field>
        <Field label="Entity" htmlFor="audit-entity" className="inline-field">
          <input id="audit-entity" value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1); }} placeholder="For example order" />
        </Field>
      </div>

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <p className="loading">Loading…</p>}

      {!loading && !error && items.length === 0 && (
        <EmptyState title="No audit entries match">Try a shorter action or entity filter.</EmptyState>
      )}

      {!loading && items.length > 0 && (
        <>
          <DataTable
            columns={[
              { key: 'created_at', label: 'Time', render: (entry) => formatDateTime(entry.created_at) },
              { key: 'action', label: 'Action', render: (entry) => titleCase(entry.action) },
              { key: 'entity', label: 'Entity', render: (entry) => `${entry.entity}${entry.entity_id ? ` #${entry.entity_id}` : ''}` },
              {
                key: 'user_name',
                label: 'User',
                render: (entry) => <>{entry.user_name || 'System'} <span className="tiny muted">{entry.user_role}</span></>,
              },
              {
                key: 'details',
                label: 'Details',
                render: (entry) => (
                  <details className="details-block">
                    <summary>Before and after</summary>
                    <div className="stack-sm">
                      <div>
                        <strong className="small">Before</strong>
                        <Payload value={entry.before_json} />
                      </div>
                      <div>
                        <strong className="small">After</strong>
                        <Payload value={entry.after_json} />
                      </div>
                      {entry.ip && <span className="tiny muted">{entry.ip}</span>}
                    </div>
                  </details>
                ),
              },
            ]}
            rows={items}
          />
          <Pagination pagination={data.pagination} onPage={setPage} />
        </>
      )}
    </>
  );
}
