import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { ErrorState, Loading, StockChip, Toast } from '../components/UI.jsx';
import { formatMoney } from '../utils/format.js';

export default function MedicineDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { data, loading, error, reload } = useFetch(`/medicines/${id}`);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(false);
  const [toast, setToast] = useState(null);

  usePageTitle(data?.medicine?.brand_name || 'Medicine');

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data) return null;

  const medicine = data.medicine;
  const availability = data.availability || [];
  const inStock = availability.filter((row) => Number(row.stock) > 0);
  const cheapest = [...inStock].sort((a, b) => Number(a.price) - Number(b.price))[0];
  const meta = [medicine.strength, medicine.dosage_form].filter(Boolean).join(' · ');

  const addToCart = async () => {
    setNotice(false);
    setSubmitting(true);
    try {
      const result = await addItem({ medicineId: Number(id), pharmacyId: cheapest.pharmacy_id });
      if (!result?.conflict) {
        setNotice(true);
        setToast({ tone: 'success', message: 'Added to your cart.' });
      }
    } catch (err) {
      setToast({ tone: 'error', message: err.message || 'Could not add this item.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <p className="back-link">
        <Link to="/medicines">Back to medicines</Link>
      </p>

      <section className="detail-overview card">
        <div className="detail-main">
          <div className="detail-title-row">
            <h1 className="page-heading detail-heading">{medicine.brand_name}</h1>
            {Boolean(medicine.requires_prescription) && <span className="rx-tag">Prescription needed</span>}
          </div>
          {meta && <p className="detail-line">{meta}</p>}
          <p className="detail-price">{formatMoney(medicine.min_price)}</p>
          {Boolean(medicine.requires_prescription) && (
            <p className="rx-note">A pharmacist checks the prescription before your order is released.</p>
          )}
        </div>
        <div className="detail-buy">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={addToCart}
            disabled={submitting || !cheapest}
          >
            {submitting ? 'Please wait…' : cheapest ? 'Add to cart' : 'Out of stock'}
          </button>
          {notice && (
            <p className="detail-after">
              <Link to="/cart">Go to cart</Link>
            </p>
          )}
        </div>
      </section>

      <h2 className="detail-label">Pharmacies</h2>
      {availability.length === 0 && <p className="muted">No pharmacy lists this medicine.</p>}
      {availability.length > 0 && (
        <div className="table-wrap">
          <table className="plain-table">
            <thead>
              <tr>
                <th>Pharmacy</th>
                <th>Community</th>
                <th className="num">Price</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {availability.map((row) => (
                <tr key={row.pharmacy_id}>
                  <td data-label="Pharmacy">{row.pharmacy_name}</td>
                  <td data-label="Community">{row.community}</td>
                  <td data-label="Price" className="num">
                    {formatMoney(row.price)}
                  </td>
                  <td data-label="Availability">
                    <StockChip stock={row.stock} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toast tone={toast?.tone} onClose={() => setToast(null)}>
        {toast?.message}
      </Toast>
    </>
  );
}
