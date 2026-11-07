import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, download } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { Alert, EmptyState, PageHeader, Skeleton } from '../../components/UI.jsx';
import { formatMoney } from '../../utils/format.js';

export default function WalkInPage() {
  usePageTitle('Walk-in sale');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const results = useFetch(`/medicines?available=true&pageSize=20${search ? `&q=${encodeURIComponent(search)}` : ''}`);
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const addMedicine = async (medicine) => {
    setError(null);
    const existing = lines.find((line) => line.medicineId === medicine.id);
    if (existing) {
      setLines((current) => current.map((line) => (line.medicineId === medicine.id ? { ...line, quantity: line.quantity + 1 } : line)));
      return;
    }
    try {
      const detail = await api(`/medicines/${medicine.id}`);
      const availability = detail.availability.find((row) => row.pharmacy_id === Number(pharmacyId));
      if (!availability) {
        setError(new Error('This pharmacy does not sell that medicine.'));
        return;
      }
      if (availability.stock <= 0) {
        setError(new Error('This medicine is out of stock at the selected pharmacy.'));
        return;
      }
      setLines((current) => [
        ...current,
        {
          medicineId: medicine.id,
          name: `${medicine.brand_name}${medicine.strength ? ` ${medicine.strength}` : ''}`,
          price: Number(availability.price),
          available: availability.stock,
          quantity: 1,
        },
      ]);
    } catch (err) {
      setError(err);
    }
  };

  const changeQty = (medicineId, quantity) =>
    setLines((current) => current.map((line) => (line.medicineId === medicineId ? { ...line, quantity: Math.max(1, Math.min(line.available, quantity)) } : line)));

  const submit = async () => {
    if (!lines.length) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await api('/orders/walk-in', {
        method: 'POST',
        body: {
          pharmacyId: isAdmin ? pharmacyId : undefined,
          items: lines.map((line) => ({ medicineId: line.medicineId, quantity: line.quantity })),
          notes: notes || undefined,
        },
      });
      setResult(data.order);
      setLines([]);
      setNotes('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Counter"
        title="Record a walk-in sale"
        subtitle="Dispense and record a counter sale. Stock is allocated FEFO and the receipt is available immediately."
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}

      {noticeOrError(result, error)}

      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <div className="card-header"><h2>Find a medicine</h2></div>
            <div className="card-body">
              <form className="row" onSubmit={(event) => { event.preventDefault(); setSearch(term); }}>
                <div className="field full">
                  <label htmlFor="walkin-search">Search the catalogue</label>
                  <input id="walkin-search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Brand or generic name" />
                </div>
                <button type="submit" className="btn btn-secondary">Search</button>
              </form>
              {results.loading && <Skeleton lines={3} />}
              {!results.loading && (
                <div className="alert-list mt-2">
                  {(results.data?.items || []).map((medicine) => (
                    <div className="alert-item" key={medicine.id}>
                      <div className="row between full">
                        <div>
                          <strong>{medicine.brand_name}{medicine.strength ? ` ${medicine.strength}` : ''}</strong>
                          <div className="tiny muted">{medicine.generic_name} · {medicine.stock} available network-wide</div>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addMedicine(medicine)}>Add</button>
                      </div>
                    </div>
                  ))}
                  {!results.data?.items?.length && <p className="small muted">No medicines found.</p>}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside>
          <div className="card sticky-summary">
            <div className="card-header"><h2>Sale lines</h2></div>
            <div className="card-body">
              {lines.length === 0 ? (
                <EmptyState title="No items yet">Search on the left and add medicines to this counter sale.</EmptyState>
              ) : (
                <div className="stack-sm">
                  {lines.map((line) => (
                    <div className="cart-item" key={line.medicineId}>
                      <div className="cart-item-info">
                        <strong>{line.name}</strong>
                        <div className="tiny muted">{formatMoney(line.price)} each · {line.available} available</div>
                      </div>
                      <div className="qty">
                        <button type="button" onClick={() => changeQty(line.medicineId, line.quantity - 1)} aria-label="Decrease">−</button>
                        <input value={line.quantity} readOnly aria-label={`${line.name} quantity`} />
                        <button type="button" onClick={() => changeQty(line.medicineId, line.quantity + 1)} aria-label="Increase">+</button>
                      </div>
                      <div className="text-right">
                        <div>{formatMoney(line.price * line.quantity)}</div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((current) => current.filter((row) => row.medicineId !== line.medicineId))}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="field mt-2">
                <label htmlFor="walkin-notes">Notes (optional)</label>
                <textarea id="walkin-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={300} />
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
              <button type="button" className="btn btn-primary btn-block mt-2" onClick={submit} disabled={busy || !lines.length}>
                {busy ? 'Recording…' : 'Complete sale & record cash'}
              </button>
              <p className="hint mt-2 mb-0">Walk-in sales are recorded as paid by cash at the counter.</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function noticeOrError(result, error) {
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (!result) return null;
  return (
    <Alert tone="success">
      <p>
        Sale <strong>{result.reference}</strong> recorded for {formatMoney(result.total)}.
      </p>
      <div className="row">
        <Link to={`/orders/${result.id}`} className="btn btn-secondary btn-sm">View order</Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => download(`/orders/${result.id}/receipt`, `${result.reference}-receipt.pdf`)}>
          Download receipt
        </button>
      </div>
    </Alert>
  );
}
