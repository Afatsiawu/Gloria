import { useState } from 'react';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { Badge, EmptyState, ErrorState, Field, PageHeader, Pagination, RawJson, Skeleton } from '../../components/UI.jsx';
import { formatDateTime, titleCase } from '../../utils/format.js';

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
      <PageHeader
        eyebrow="Accountability"
        title="Audit log"
        subtitle="Every significant action is recorded with the actor, entity, before/after values and IP address. Records are append-only."
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>}
      />

      <div className="card mb-2">
        <div className="card-body">
          <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
            <Field label="Action contains" htmlFor="audit-action">
              <input id="audit-action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder="e.g. order_placed, price_changed" />
            </Field>
            <Field label="Entity" htmlFor="audit-entity">
              <input id="audit-entity" value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1); }} placeholder="e.g. order, batch, user" />
            </Field>
          </form>
        </div>
      </div>

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Skeleton lines={8} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState title="No audit entries match">Try a shorter action or entity filter.</EmptyState>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="stack">
            {items.map((entry) => (
              <article className="card" key={entry.id}>
                <div className="card-body">
                  <div className="row between">
                    <div>
                      <div className="row">
                        <Badge tone="info">{titleCase(entry.action)}</Badge>
                        <Badge tone="neutral">{entry.entity}{entry.entity_id ? ` #${entry.entity_id}` : ''}</Badge>
                        {entry.user_role && <Badge tone="teal">{entry.user_role}</Badge>}
                      </div>
                      <p className="small mb-0 mt-1">
                        <strong>{entry.user_name || 'System'}</strong> · {formatDateTime(entry.created_at)}
                        {entry.ip ? ` · ${entry.ip}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-2 mt-2">
                    <RawJson label="Before" value={entry.before_json} />
                    <RawJson label="After" value={entry.after_json} />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            pagination={{
              page: data.pagination.page,
              totalPages: data.pagination.totalPages,
            }}
            onPage={setPage}
          />
        </>
      )}
    </>
  );
}
