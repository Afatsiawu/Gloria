import { useState } from 'react';
import { download } from '../../api/client.js';
import { usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { Alert, Field, PageTitle } from '../../components/UI.jsx';

const REPORTS = [
  { value: 'sales', label: 'Sales report', description: 'Paid and cash orders with revenue, delivery fees and payment method.', fields: ['from', 'to', 'status'] },
  { value: 'stock', label: 'Stock on hand', description: 'Current stock by medicine and pharmacy with reorder levels.', fields: [] },
  { value: 'expiry', label: 'Expiry report', description: 'Batches expiring within the chosen window and stock already expired.', fields: ['days'] },
  { value: 'orders', label: 'Order register', description: 'Order-level detail including channel, status, customer and fulfilment.', fields: ['from', 'to', 'status', 'channel'] },
];

export default function ReportsPage() {
  usePageTitle('Reports');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [type, setType] = useState('sales');
  const [format, setFormat] = useState('csv');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const report = REPORTS.find((row) => row.value === type);

  const run = async () => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const query = new URLSearchParams({ format });
      if (isAdmin) query.set('pharmacyId', pharmacyId);
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      if (status) query.set('status', status);
      if (channel) query.set('channel', channel);
      if (type === 'expiry') query.set('days', days);
      const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}.${format}`;
      await download(`/reports/${type}?${query.toString()}`, filename);
      setNotice(`${report.label} downloaded as ${format.toUpperCase()}.`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Reports" subtitle="Download a report for your pharmacy." />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}

      <form className="form-narrow" onSubmit={(event) => { event.preventDefault(); run(); }}>
        <Field label="Report" htmlFor="report-type" hint={report.description}>
          <select id="report-type" value={type} onChange={(event) => setType(event.target.value)}>
            {REPORTS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
          </select>
        </Field>

        <Field label="Format" htmlFor="report-format">
          <select id="report-format" value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </Field>

        {report.fields.includes('days') && (
          <Field label="Expiry window (days)" htmlFor="report-days">
            <input id="report-days" type="number" min="1" max="730" value={days} onChange={(event) => setDays(event.target.value)} />
          </Field>
        )}
        {report.fields.includes('from') && (
          <Field label="From" htmlFor="report-from">
            <input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
        )}
        {report.fields.includes('to') && (
          <Field label="To" htmlFor="report-to">
            <input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        )}
        {report.fields.includes('status') && (
          <Field label="Status" htmlFor="report-status">
            <select id="report-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {['placed', 'awaiting_prescription', 'verified', 'ready', 'out_for_delivery', 'completed', 'cancelled'].map((value) => (
                <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
        )}
        {report.fields.includes('channel') && (
          <Field label="Channel" htmlFor="report-channel">
            <select id="report-channel" value={channel} onChange={(event) => setChannel(event.target.value)}>
              <option value="">All channels</option>
              <option value="online">Online</option>
              <option value="walk_in">Walk-in</option>
            </select>
          </Field>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : 'Download report'}
        </button>
      </form>
    </>
  );
}
