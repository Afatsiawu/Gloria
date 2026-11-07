import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { Badge, Icon, SkeletonCards } from '../components/UI.jsx';
import { formatMoney } from '../utils/format.js';

const FEATURES = [
  {
    icon: 'Search',
    title: 'Compare live stock and prices',
    text: 'See which of the 10 participating pharmacies has your medicine today, at what price, and how far away it is.',
  },
  {
    icon: 'Clipboard',
    title: 'Prescriptions verified by pharmacists',
    text: 'Upload a photo of a prescription-only medicine order. A licensed pharmacist reviews it before anything is released.',
  },
  {
    icon: 'Delivery',
    title: 'Pickup or community delivery',
    text: 'Collect at the counter or choose a delivery zone in Doryumu or Kordibe with a transparent fee.',
  },
  {
    icon: 'Card',
    title: 'MTN, Telecel, AT or cash',
    text: 'Pay with mobile money or pay cash on pickup/delivery. Every order has a printable receipt.',
  },
  {
    icon: 'Bell',
    title: 'Refill reminders that respect you',
    text: 'Set an interval for chronic medicines and receive a reminder when it is time to restock. Opt out any time.',
  },
  {
    icon: 'Chart',
    title: 'Data-driven pharmacy operations',
    text: 'Pharmacists get low-stock alerts, expiry monitoring, demand forecasts and management reports.',
  },
];

const STEPS = [
  { title: 'Search', text: 'Enter a medicine name, generic name or health need and filter by community.' },
  { title: 'Choose a pharmacy', text: 'Compare live availability, price and distance, then add items to your cart.' },
  { title: 'Upload a prescription', text: 'For prescription-only medicines, attach a clear photo for pharmacist review.' },
  { title: 'Pay and collect', text: 'Pay by mobile money or cash, then pick up or wait for community delivery.' },
];

export default function LandingPage() {
  usePageTitle('');
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const pharmacies = useFetch('/pharmacies');
  const featured = useFetch('/medicines?available=true&pageSize=4');

  const submit = (event) => {
    event.preventDefault();
    navigate(`/search${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ''}`);
  };

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div>
            <p className="eyebrow">Shai-Osudoku District · Ghana</p>
            <h1>Your medicine, in stock nearby.</h1>
            <p>
              PharmaLink connects customers in Doryumu and Kordibe with 10 licensed community pharmacies.
              Check live stock, compare prices, have prescriptions verified and choose pickup or delivery.
            </p>
            <form className="hero-search" onSubmit={submit} role="search">
              <div className="search-input-wrap">
                <span className="search-icon" aria-hidden="true">
                  <Icon name="Search" size={16} />
                </span>
                <label className="sr-only" htmlFor="hero-search-input">Search medicines</label>
                <input
                  id="hero-search-input"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Try “paracetamol”, “amlodipine” or “ORS”"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="btn btn-primary">Search pharmacies</button>
            </form>
            <div className="hero-actions">
              <Link to="/search" className="btn btn-primary">Browse the catalogue</Link>
              <Link to="/register" className="btn btn-ghost">Create a free account</Link>
            </div>
            <div className="hero-trust">
              <span>
                <Icon name="Check" size={14} /> Licensed pharmacies only
              </span>
              <span>
                <Icon name="Check" size={14} /> Pharmacist-reviewed prescriptions
              </span>
              <span>
                <Icon name="Check" size={14} /> Ghana Data Protection Act 843
              </span>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <h2>Available near you</h2>
              <Badge tone="success">Live stock</Badge>
            </div>
            <div className="card-body">
              {featured.loading && <SkeletonCards count={2} />}
              {!featured.loading && featured.data?.items?.length > 0 && (
                <div className="stack-sm">
                  {featured.data.items.map((medicine) => (
                    <div className="availability-row" key={medicine.id}>
                      <div>
                        <strong>{medicine.brand_name}</strong>
                        <div className="small muted">
                          {medicine.strength} · {medicine.category_name || 'General'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="price">{formatMoney(medicine.min_price)}</div>
                        <div className="tiny muted">{medicine.pharmacy_count} pharmacies</div>
                      </div>
                    </div>
                  ))}
                  <Link to="/search" className="btn btn-secondary btn-block">See all medicines</Link>
                </div>
              )}
              {!featured.loading && !featured.data?.items?.length && (
                <p className="muted">The catalogue is being prepared. Please try again shortly.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="features-heading">
        <p className="eyebrow">Why PharmaLink</p>
        <h2 id="features-heading">One system for customers, pharmacists and riders</h2>
        <div className="grid grid-3 mt-3">
          {FEATURES.map((feature) => (
            <article className="card" key={feature.title}>
              <div className="card-body">
                <div className="feature-icon" aria-hidden="true">
                  <Icon name={feature.icon} size={22} />
                </div>
                <h3>{feature.title}</h3>
                <p className="muted mb-0">{feature.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" id="how" aria-labelledby="how-heading">
        <p className="eyebrow">How it works</p>
        <h2 id="how-heading">From search to safe medicine in four steps</h2>
        <div className="steps mt-3">
          {STEPS.map((step) => (
            <div className="step-item" key={step.title}>
              <h3>{step.title}</h3>
              <p className="muted mb-0">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="pharmacies-heading">
        <div className="row between">
          <div>
            <p className="eyebrow">The network</p>
            <h2 id="pharmacies-heading">10 pharmacies across two communities</h2>
          </div>
          <Link to="/search" className="btn btn-secondary">Find stock</Link>
        </div>
        <div className="grid grid-3 mt-3">
          {pharmacies.loading && <SkeletonCards count={3} />}
          {pharmacies.data?.items?.map((pharmacy) => (
            <article className="card" key={pharmacy.id}>
              <div className="card-body">
                <div className="row between">
                  <h3 className="mb-0">{pharmacy.name}</h3>
                  <Badge tone="teal">{pharmacy.community}</Badge>
                </div>
                <p className="small muted mt-1">{pharmacy.address}</p>
                <p className="small mb-0">
                  <Icon name="Pin" size={12} /> {pharmacy.landmark || pharmacy.community}
                </p>
                <p className="small mb-0">
                  <Icon name="Phone" size={12} /> {pharmacy.phone}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card mt-3">
        <div className="card-body text-center">
          <h2>Ready to skip the pharmacy queue?</h2>
          <p className="muted">Create an account to order, track prescriptions and set refill reminders.</p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary">Create a customer account</Link>
            <Link to="/login" className="btn btn-secondary">Sign in</Link>
          </div>
          <p className="tiny muted mt-2 mb-0">
            PharmaLink supports, and does not replace, the professional judgement and advice of a pharmacist.
          </p>
        </div>
      </section>
    </>
  );
}
