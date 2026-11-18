import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, download } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { Alert, Loading } from '../../components/UI.jsx';
import { formatMoney } from '../../utils/format.js';

export default function WalkInPage() {
  usePageTitle('Walk-in sale');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const results = useFetch(
    `/medicines?available=true&pageSize=20${search ? `&q=${encodeURIComponent(search)}` : ''}`,
    [search]
  );
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const addMedicine = async (medicine) => {
    setError('');
    const existing = lines.find((line) => line.medicineId === medicine.id);
    if (existing) {
      setLines((current) =>
        current.map((line) =>
          line.medicineId === medicine.id ? { ...line, quantity: line.quantity + 1 } : line
        )
      );
      return;
    }
    try {
      const detail = await api(`/medicines/${medicine.id}`);
      const availability = detail.availability.find((row) => row.pharmacy_id === Number(pharmacyId));
      if (!availability) {
        setError('This pharmacy does not sell that medicine.');
        return;
      }
      if (availability.stock <= 0) {
        setError('This medicine is out of stock here.');
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
      setError(err.message || 'Could not add this medicine.');
    }
  };

  const changeQty = (medicineId, quantity) =>
    setLines((current) =>
      current.map((line) =>
        line.medicineId === medicineId
          ? { ...line, quantity: Math.max(1, Math.min(line.available, quantity)) }
          : line
      )
    );

  const submit = async () => {
    if (!lines.length) return;
    setBusy(true);
    setError('');
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
      setError(err.message || 'Could not record the sale.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="page-heading">Walk-in sale</h1>

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}

      {error && <p className="error-text">{error}</p>}
      {result && (
        <Alert tone="success">
          <p>
            Sale {result.reference} recorded for {formatMoney(result.total)}.
          </p>
          <div className="detail-actions">
            <Link to={`/orders/${result.id}`} className="btn btn-secondary btn-sm">
              View order
            </Link>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => download(`/orders/${result.id}/receipt`, `${result.reference}-receipt.pdf`)}
            >
              Receipt
            </button>
          </div>
        </Alert>
      )}

      <form
        className="home-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(term);
        }}
      >
        <div className="search-field">
          <label className="sr-only" htmlFor="walkin-search">
            Search medicines
          </label>
          <input
            id="walkin-search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search medicines"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {results.loading && <Loading />}
      {!results.loading && (
        <ul className="selection-list">
          {(results.data?.items || []).map((medicine) => (
            <li key={medicine.id}>
              <span>
                {medicine.brand_name}
                {medicine.strength ? ` ${medicine.strength}` : ''}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addMedicine(medicine)}>
                Add
              </button>
            </li>
          ))}
          {!results.data?.items?.length && <li className="muted">No medicines found.</li>}
        </ul>
      )}

      <h2 className="section-heading">Sale lines</h2>
      {lines.length === 0 ? (
        <p className="empty">No items yet.</p>
      ) : (
        <div className="cart-list">
          {lines.map((line) => (
            <div className="cart-item" key={line.medicineId}>
              <div className="cart-item-info">
                <p className="cart-item-name">{line.name}</p>
                <p className="small">{formatMoney(line.price)} each</p>
              </div>
              <div className="qty">
                <button
                  type="button"
                  onClick={() => changeQty(line.medicineId, line.quantity - 1)}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span>{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => changeQty(line.medicineId, line.quantity + 1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <p className="cart-line-total">{formatMoney(line.price * line.quantity)}</p>
              <button
                type="button"
                className="cart-remove"
                onClick={() =>
                  setLines((current) => current.filter((row) => row.medicineId !== line.medicineId))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="field" htmlFor="walkin-notes">
        <span>Note (optional)</span>
        <textarea
          id="walkin-notes"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={300}
        />
      </label>

      <div className="summary-row total">
        <span>Total</span>
        <span>{formatMoney(total)}</span>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={submit}
        disabled={busy || !lines.length}
      >
        {busy ? 'Please wait…' : 'Complete sale'}
      </button>
    </>
  );
}
