import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { statusLabel, statusTone, formatMoney } from '../utils/format.js';

const ICON_PATHS = {
  Home: ['M3 10.5 12 3l9 7.5', 'M5.5 9.5V21h13V9.5'],
  Search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M16.2 16.2 20.5 20.5'],
  Cart: [
    'M3 4h2l2.4 10.4a1 1 0 0 0 1 .8h8.3a1 1 0 0 0 1-.8L19 7H6',
    'M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
    'M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  ],
  User: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  Menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  Close: ['M6 6l12 12', 'M18 6 6 18'],
  Cross: ['M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'],
  Check: ['M5 12.5 10 17.5 19 7'],
  Phone: ['M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z'],
  Package: ['M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z', 'M4 8.5 12 13l8-4.5', 'M12 13v7'],
  Warning: ['M12 4 3.5 20h17z', 'M12 10v4', 'M12 17.2h.01'],
  ArrowRight: ['M4 12h15', 'M13 6l6 6-6 6'],
  MapPin: ['M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  Truck: ['M3 6h11v10H3z', 'M14 9h4l3 3v4h-7z', 'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  Clock: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 8v4.5l3 1.8'],
};

export function Icon({ name, size = 20, className = '' }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.Search;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return <button type={type} className={`btn btn-${variant} ${className}`.trim()} {...props} />;
}

export function Input({ className = '', ...props }) {
  return <input className={className} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={className} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, htmlFor, hint, error, required, children, className = '' }) {
  return (
    <div className={`field ${error ? 'field-error' : ''} ${className}`.trim()}>
      {label && (
        <label htmlFor={htmlFor}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {hint && <p className="hint">{hint}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function Alert({ tone = 'info', children }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={`badge badge-${tone} ${className}`.trim()}>{children}</span>;
}

export function StatusBadge({ status }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

export function StatusChip({ tone = 'neutral', children }) {
  return <span className={`status-chip status-chip-${tone}`}>{children}</span>;
}

export function StockChip({ stock }) {
  const quantity = Number(stock) || 0;
  if (quantity <= 0) return <StatusChip tone="danger">Out of stock</StatusChip>;
  if (quantity <= 10) return <StatusChip tone="warning">Low stock</StatusChip>;
  return <StatusChip tone="success">In stock</StatusChip>;
}

export function Toast({ tone = 'success', children, onClose, className = '' }) {
  if (!children) return null;
  return (
    <div className={`toast toast-${tone} ${className}`.trim()} role="status">
      <span>{children}</span>
      {onClose && (
        <button type="button" className="toast-close" aria-label="Dismiss message" onClick={onClose}>
          <Icon name="Close" size={18} />
        </button>
      )}
    </div>
  );
}

export function SectionBand({ tone = 'plain', className = '', id, children }) {
  return (
    <section id={id} className={`section-band section-band-${tone} ${className}`.trim()}>
      {children}
    </section>
  );
}

export function Stepper({ steps = [], label = 'Order progress' }) {
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((step) => (
        <li key={step.key || step.label} className={`stepper-step ${step.state || 'todo'}`}>
          <span className="stepper-dot" aria-hidden="true" />
          <div className="stepper-body">
            <strong>{step.label}</strong>
            {step.time && <span className="stepper-time">{step.time}</span>}
            {step.note && <p className="stepper-note">{step.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DataTable({ columns, rows, rowKey = 'id', empty = 'Nothing here yet.' }) {
  if (!rows?.length) return <p className="empty">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.align === 'right' ? 'num' : ''}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? index;
            return (
              <tr key={key}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    data-label={column.label}
                    className={column.align === 'right' ? 'num' : ''}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProductCard({ medicine, onAdd, busy = false, added = false }) {
  const name = medicine.brand_name;
  const meta = [medicine.strength, medicine.dosage_form].filter(Boolean).join(' · ');
  const inStock = Number(medicine.stock) > 0;
  return (
    <article className="product-card">
      <div className="product-thumb" aria-hidden="true">
        {medicine.image_path ? (
          <img src={medicine.image_path} alt="" loading="lazy" />
        ) : (
          <span>{name.charAt(0)}</span>
        )}
      </div>
      <div className="product-body">
        {Boolean(medicine.requires_prescription) && <span className="rx-tag">Prescription needed</span>}
        <h3 className="product-name">
          <Link to={`/medicines/${medicine.id}`}>{name}</Link>
        </h3>
        {meta && <p className="product-meta">{meta}</p>}
        {medicine.pharmacy_name && <p className="product-pharmacy muted small">From {medicine.pharmacy_name}</p>}
        <div className="product-price-row">
          <p className="product-price">{formatMoney(medicine.min_price)}</p>
          <StockChip stock={medicine.stock} />
        </div>
        <Button className="btn-sm" onClick={() => onAdd(medicine)} disabled={!inStock || busy}>
          {busy ? 'Please wait…' : added ? 'Added' : 'Add to cart'}
        </Button>
      </div>
    </article>
  );
}

export function EmptyState({ title, children, action, icon = 'Search' }) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }) {
  return (
    <div className="empty" role="alert">
      <span className="empty-mark empty-mark-warning" aria-hidden="true">
        <Icon name="Warning" size={26} />
      </span>
      <h2>Something went wrong</h2>
      <p>{error?.message || 'Could not load this. Check your connection and try again.'}</p>
      {retry && (
        <button type="button" className="btn btn-secondary" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Loading({ text = 'Loading…' }) {
  return (
    <div className="loading-skeleton" role="status">
      <span className="sr-only">{text}</span>
      <span className="skeleton skeleton-line" />
      <span className="skeleton skeleton-line short" />
      <span className="skeleton skeleton-block" />
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="loading" role="status">
      {label}
    </span>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-sm"
        disabled={pagination.page <= 1}
        onClick={() => onPage(pagination.page - 1)}
      >
        Previous
      </button>
      <span>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <button
        type="button"
        className="btn btn-sm"
        disabled={pagination.page >= pagination.totalPages}
        onClick={() => onPage(pagination.page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

export function Tabs({ tabs, active, onChange, label = 'Sections' }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          className={`tab ${active === tab.value ? 'active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    setTimeout(() => ref.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function statusText(value) {
  return statusLabel(value);
}
