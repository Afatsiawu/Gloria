import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { EmptyState, ErrorState, Field, Loading } from '../components/UI.jsx';
import { formatDate } from '../utils/format.js';

export default function RefillsPage() {
  usePageTitle('Refills');
  const { data, loading, error, reload } = useFetch('/refills');
  const medicines = useFetch('/medicines?pageSize=100&available=true');
  const [form, setForm] = useState({ medicineId: '', intervalDays: 30 });
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const run = async (key, fn, message) => {
    setBusy(key);
    setNotice('');
    setActionError('');
    try {
      await fn();
      if (message) setNotice(message);
      await reload();
    } catch (err) {
      setActionError(err.message || 'Could not update the reminder.');
    } finally {
      setBusy(null);
    }
  };

  const add = (event) => {
    event.preventDefault();
    run(
      'add',
      () =>
        api('/refills', {
          method: 'POST',
          body: { medicineId: Number(form.medicineId), intervalDays: Number(form.intervalDays) },
        }),
      'Reminder added.'
    );
    setForm({ medicineId: '', intervalDays: 30 });
  };

  const updateReminder = (reminder, changes) =>
    run(`update-${reminder.id}`, () => api(`/refills/${reminder.id}`, { method: 'PATCH', body: changes }));

  const remove = (reminder) =>
    run(`delete-${reminder.id}`, () => api(`/refills/${reminder.id}`, { method: 'DELETE' }), 'Reminder removed.');

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;

  const items = data?.items || [];

  return (
    <>
      <h1 className="page-heading">Refills</h1>

      {notice && <p className="success-text">{notice}</p>}
      {actionError && <p className="error-text">{actionError}</p>}

      <form className="refill-form" onSubmit={add}>
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
                {medicine.brand_name}
                {medicine.strength ? ` ${medicine.strength}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Remind every (days)" htmlFor="intervalDays" required>
          <input
            id="intervalDays"
            type="number"
            min="1"
            max="365"
            inputMode="numeric"
            value={form.intervalDays}
            onChange={(event) => setForm((current) => ({ ...current, intervalDays: event.target.value }))}
            required
          />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={busy === 'add' || !form.medicineId}>
          {busy === 'add' ? 'Please wait…' : 'Add reminder'}
        </button>
      </form>

      {items.length === 0 && (
        <EmptyState
          title="No reminders yet"
          action={
            <Link to="/medicines" className="btn btn-secondary">
              Find a medicine
            </Link>
          }
        >
          Add a medicine above to be reminded when it is time to refill.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ul className="refill-list">
          {items.map((reminder) => {
            const overdue = new Date(reminder.next_due_at) <= new Date();
            return (
              <li key={reminder.id}>
                <div className="refill-main">
                  <strong>
                    {reminder.brand_name}
                    {reminder.strength ? ` ${reminder.strength}` : ''}
                  </strong>
                  <span className="small muted">
                    {reminder.is_active ? (overdue ? 'Due now' : 'Active') : 'Paused'} · Every{' '}
                    {reminder.interval_days} days · Next {formatDate(reminder.next_due_at)}
                  </span>
                </div>
                <div className="refill-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy === `update-${reminder.id}`}
                    onClick={() => updateReminder(reminder, { isActive: !reminder.is_active })}
                  >
                    {reminder.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <Link
                    to={`/medicines?q=${encodeURIComponent(reminder.brand_name)}`}
                    className="btn btn-secondary btn-sm"
                  >
                    Order refill
                  </Link>
                  <button
                    type="button"
                    className="cart-remove"
                    disabled={busy === `delete-${reminder.id}`}
                    onClick={() => remove(reminder)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
