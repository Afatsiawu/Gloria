import { Icon } from './UI.jsx';

const DEMO_MEDICINES = [
  { name: 'Panadol', meta: '500 mg · Tablet', price: 'GHS 5.00' },
  { name: 'Brufen', meta: '400 mg · Tablet', price: 'GHS 7.00' },
];

function MedicinesScreen() {
  return (
    <>
      <div className="phone-top">
        <span className="phone-brand">
          <span className="phone-brand-mark" />
          PharmaLink
        </span>
        <Icon name="Cart" size={14} />
      </div>
      <div className="phone-search">
        <Icon name="Search" size={12} />
        <span>Search medicines</span>
      </div>
      <p className="phone-eyebrow">Doryumu</p>
      {DEMO_MEDICINES.map((medicine) => (
        <div className="phone-product" key={medicine.name}>
          <span className="phone-thumb">{medicine.name.charAt(0)}</span>
          <div className="phone-product-body">
            <strong>{medicine.name}</strong>
            <span className="phone-product-meta">{medicine.meta}</span>
            <span className="phone-product-price">{medicine.price}</span>
          </div>
          <span className="phone-chip">In stock</span>
        </div>
      ))}
    </>
  );
}

function TrackingScreen() {
  return (
    <>
      <div className="phone-top">
        <span className="phone-brand">
          <span className="phone-brand-mark" />
          PharmaLink
        </span>
        <Icon name="Package" size={14} />
      </div>
      <p className="phone-eyebrow">Order progress</p>
      <ol className="phone-steps">
        <li className="done">
          <span className="phone-step-dot" />
          Verified
        </li>
        <li className="current">
          <span className="phone-step-dot" />
          Ready
        </li>
        <li>
          <span className="phone-step-dot" />
          Completed
        </li>
      </ol>
      <div className="phone-note">
        <Icon name="Check" size={12} />
        <span>Order updates appear here</span>
      </div>
    </>
  );
}

export function PhoneMock({ variant = 'medicines', className = '' }) {
  return (
    <div className={`phone-mock ${className}`.trim()} aria-hidden="true">
      <span className="phone-notch" />
      <div className="phone-screen">{variant === 'tracking' ? <TrackingScreen /> : <MedicinesScreen />}</div>
    </div>
  );
}

export function MiniCard({ children, className = '' }) {
  return <div className={`mini-card ${className}`.trim()}>{children}</div>;
}

export function VisualFrame({
  tone = 'peach',
  shape = 'circle',
  image = null,
  alt = '',
  width = 800,
  height = 800,
  className = '',
  children,
}) {
  return (
    <div
      className={`visual-frame visual-frame-${tone} visual-frame-${shape} ${
        image ? 'visual-frame-image' : ''
      } ${className}`.trim()}
    >
      {image ? (
        <img src={image} alt={alt} width={width} height={height} loading="lazy" />
      ) : (
        children
      )}
    </div>
  );
}
