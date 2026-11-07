import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { Alert, Badge, EmptyState, ErrorState, Field, PageHeader, Skeleton } from '../components/UI.jsx';
import { formatDateTime } from '../utils/format.js';

export default function RefillsPage() {
  usePageTitle('Refill reminders');
  const { data, loading, error, reload } = useFetch('/refills');
  const medicines = useFetch('/medicines?pageSize=100&available=true');
  const [form, setForm] = useState({ medicineId: '', intervalDays: 30 });
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  const run = async (key, fn, message) => {
    setBusy(key);
    setNotice(null);
    setActionError(null);
    try {
      await fn();
      if (message) setNotice(message);
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  };

  const add = (event) => {
    event.preventDefault();
    run('add', () => api('/refills', {
      method: 'POST',
      body: { medicineId: Number(form.medicineId), intervalDays: Number(form.intervalDays) },
    }), 'Refill reminder created.');
    setForm({ medicineId: '', intervalDays: 30 });
  };

  const updateReminder = (reminder, changes) =>
    run(`update-${reminder.id}`, () => api(`/refills/${reminder.id}`, { method: 'PATCH', body: changes }));

  const remove = (reminder) =>
    run(`delete-${reminder.id}`, () => api(`/refills/${reminder.id}`, { method: 'DELETE' }), 'Reminder removed.');

  if (loading) return <Skeleton lines={6} />;
  if (error) return <ErrorState error={error} retry={reload} />;

  const items = data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Refill reminders"
        subtitle="For medicines you take regularly, set a reminder interval. We send an in-app and SMS reminder when it is due."
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="error">{actionError.message}</Alert>}

      <div className="detail-grid">
        <div>
          {items.length === 0 ? (
            <EmptyState
              title="No refill reminders yet"
              action={<Link to="/search" className="btn btn-secondary">Find a medicine</Link>}
            >
              Add a medicine and an interval (for example every 30 days) to receive a reminder.
            </EmptyState>
          ) : (
            <div className="stack">
              {items.map((reminder) => {
                const overdue = new Date(reminder.next_due_at) <= new Date();
                return (
                  <article className="card" key={reminder.id}>
                    <div className="card-body">
                      <div className="row between">
                        <div>
                          <div className="row">
                            <strong>{reminder.brand_name}{reminder.strength ? ` ${reminder.strength}` : ''}</strong>
                            <Badge tone={reminder.is_active ? (overdue ? 'warning' : 'success') : 'neutral'}>
                              {reminder.is_active ? (overdue ? 'Due now' : 'Active') : 'Paused'}
                            </Badge>
                          </div>
                          <p className="small muted mb-0 mt-1">
                            {reminder.generic_name} · Every {reminder.interval_days} days · Next due {formatDateTime(reminder.next_due_at)}
                          </p>
                        </div>
                        <div className="row">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy === `update-${reminder.id}`}
                            onClick={() => updateReminder(reminder, { isActive: !reminder.is_active })}
                          >
                            {reminder.is_active ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy === `delete-${reminder.id}`}
                            onClick={() => remove(reminder)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="row mt-2">
                        <label className="small muted" htmlFor={`interval-${reminder.id}`}>Interval (days)</label>
                        <input
                          id={`interval-${reminder.id}`}
                          type="number"
                          min="1"
                          max="365"
                          defaultValue={reminder.interval_days}
                          className="qty-input"
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            if (value && value !== reminder.interval_days) updateReminder(reminder, { intervalDays: value });
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy === `update-${reminder.id}`}
                          onClick={() => updateReminder(reminder, { nextDueAt: new Date().toISOString() })}
                        >
                          Remind me now
                        </button>
                        <Link
                          to={`/search?q=${encodeURIComponent(reminder.brand_name)}`}
                          className="btn btn-secondary btn-sm"
                        >
                          Order refill
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside>
          <div className="card sticky-summary">
            <div className="card-header"><h2>Add a reminder</h2></div>
            <div className="card-body">
              <form onSubmit={add} className="stack">
                <Field label="Medicine" htmlFor="medicineId" required>
                  <select
                    id="medicineId"
                    value={form.medicineId}
                    onChange={(event) => setForm((current) => ({ ...current, medicineId: event.target.value }))}
                    required
                  >
                    <option value="">Choose a medicine</option>
                    {(medicines.data?.items || []).map((medicine) => (
                      <option key={medicine.id} value={medicine.id}>
                        {medicine.brand_name}{medicine.strength ? ` ${medicine.strength}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Remind me every (days)" htmlFor="intervalDays" required>
                  <input
                    id="intervalDays"
                    type="number"
                    min="1"
                    max="365"
                    value={form.intervalDays}
                    onChange={(event) => setForm((current) => ({ ...current, intervalDays: event.target.value }))}
                    required
                  />
                </Field>
                <button type="submit" className="btn btn-primary btn-block" disabled={busy === 'add' || !form.medicineId}>
                  {busy === 'add' ? 'Adding…' : 'Create reminder'}
                </button>
              </form>
              <p className="hint mt-2 mb-0">
                Reminders are a convenience only. Always follow your prescriber&apos;s instructions and speak to a
                pharmacist before changing how you take a medicine.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
