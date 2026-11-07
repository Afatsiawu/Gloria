import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, ErrorState, PageHeader, Skeleton } from '../components/UI.jsx';
import { formatDate, formatMoney } from '../utils/format.js';

export default function MedicineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(`/medicines/${id}`);
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [formError, setFormError] = useState(null);

  usePageTitle(data?.medicine?.brand_name || 'Medicine');

  if (loading) return <Skeleton lines={8} />;
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data) return null;

  const medicine = data.medicine;
  const availability = data.availability || [];
  const inStock = availability.filter((row) => row.stock > 0);
  const chosen = selected ?? inStock[0]?.pharmacy_id ?? availability[0]?.pharmacy_id ?? null;

  const addToCart = async (event) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    if (!chosen) {
      setFormError('Choose a pharmacy that stocks this medicine.');
      return;
    }
    setSubmitting(true);
    try {
      await api('/cart/items', {
        method: 'POST',
        body: { medicineId: Number(id), quantity: Number(quantity), pharmacyId: Number(chosen) },
      });
      setNotice('Added to your cart.');
    } catch (err) {
      setFormError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-2 small">
        <Link to="/search">← Back to search</Link>
      </div>
      <PageHeader
        eyebrow={medicine.category_name || 'Catalogue'}
        title={`${medicine.brand_name}${medicine.strength ? ` ${medicine.strength}` : ''}`}
        subtitle={`${medicine.generic_name}${medicine.dosage_form ? ` · ${medicine.dosage_form}` : ''}`}
        actions={medicine.requires_prescription ? <Badge tone="warning">Prescription required</Badge> : <Badge tone="success">Over the counter</Badge>}
      />

      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <div className="card-header"><h2>About this medicine</h2></div>
            <div className="card-body">
              <p className="muted">
                {medicine.description || 'No description has been added for this medicine yet.'}
              </p>
              {medicine.requires_prescription && (
                <div className="alert alert-warning">
                  A pharmacist must verify a valid prescription before this medicine is released. Upload a clear
                  photo of your prescription after placing the order.
                </div>
              )}
              <div className="small muted">
                Always follow the label and your prescriber&apos;s instructions. Speak to a pharmacist if you are
                unsure whether this medicine is right for you.
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Availability and prices</h2>
              <span className="small muted">{availability.length} pharmacies listed</span>
            </div>
            <div className="card-body">
              {availability.length === 0 && <p className="muted mb-0">No pharmacy currently lists this medicine.</p>}
              <div className="stack-sm">
                {availability.map((row) => (
                  <label
                    className="availability-row"
                    key={row.pharmacy_id}
                    aria-label={`Choose ${row.pharmacy_name}`}
                  >
                    <div>
                      <strong>{row.pharmacy_name}</strong>
                      <div className="small muted">
                        {row.community} · {row.address}
                        {row.landmark ? ` · ${row.landmark}` : ''}
                      </div>
                      {row.nearest_expiry && (
                        <div className="tiny muted">Nearest expiry: {formatDate(row.nearest_expiry)}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="price">{formatMoney(row.price)}</div>
                      <div className="tiny">
                        {row.stock > 0 ? (
                          <span className="tone-success">{row.stock} in stock</span>
                        ) : (
                          <span className="tone-danger">Out of stock</span>
                        )}
                      </div>
                      <input
                        type="radio"
                        name="pharmacy"
                        checked={Number(chosen) === row.pharmacy_id}
                        onChange={() => setSelected(row.pharmacy_id)}
                        disabled={row.stock <= 0}
                        aria-label={`Select ${row.pharmacy_name}`}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside>
          <div className="card sticky-summary">
            <div className="card-header"><h2>Order this medicine</h2></div>
            <div className="card-body">
              {notice && <Alert tone="success">{notice}</Alert>}
              {formError && <Alert tone="error">{formError.message || 'Could not add this item.'}</Alert>}
              {!user && (
                <>
                  <p className="muted">
                    Sign in as a customer to add medicines to your cart and choose pickup or delivery.
                  </p>
                  <Link to="/login" state={{ from: `/medicines/${id}` }} className="btn btn-primary btn-block">
                    Sign in to order
                  </Link>
                  <p className="small muted text-center mt-2 mb-0">
                    New here? <Link to="/register">Create an account</Link>
                  </p>
                </>
              )}
              {user && user.role !== 'customer' && (
                <Alert tone="info">
                  You are signed in as a {user.role}. Ordering is available from a customer account.
                </Alert>
              )}
              {user && user.role === 'customer' && (
                <form onSubmit={addToCart} className="stack">
                  <div className="field">
                    <label htmlFor="quantity">Quantity</label>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      max="50"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className="qty-input"
                    />
                    <p className="hint">Maximum 50 units per order line.</p>
                  </div>
                  <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !chosen}>
                    {submitting ? 'Adding…' : 'Add to cart'}
                  </button>
                  {notice && (
                    <button type="button" className="btn btn-secondary btn-block" onClick={() => navigate('/cart')}>
                      Go to cart
                    </button>
                  )}
                </form>
              )}
              <div className="definition-list mt-2">
                <div>
                  <dt>Lowest price</dt>
                  <dd>{formatMoney(medicine.min_price)}</dd>
                </div>
                <div>
                  <dt>Pharmacies with stock</dt>
                  <dd>{inStock.length}</dd>
                </div>
                <div>
                  <dt>Prescription</dt>
                  <dd>{medicine.requires_prescription ? 'Required' : 'Not required'}</dd>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
