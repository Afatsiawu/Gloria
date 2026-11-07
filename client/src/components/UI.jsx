import { useEffect, useId, useRef } from 'react';
import { statusLabel, statusTone, titleCase } from '../utils/format.js';

const ICON_PATHS = {
  Search: ['M10.5 2.5a7.5 7.5 0 1 0 5.25 13.04l4.25 4.25'],
  Clipboard: ['M9 3h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M9 8h6', 'M9 13h6'],
  Delivery: ['M1 8h14v8H1z', 'M15 12h4l2 2v3H15z', 'M4 20v2', 'M17 20v2'],
  Card: ['M2 6h20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z'],
  Bell: ['M18 8a6 6 0 0 0-12 0c0 7-2.5 9-2.5 9h17S18 15 18 8', 'M13.2 21a2.1 2.1 0 0 1-4.2 0'],
  Chart: ['M4 20v-7', 'M10 20V4', 'M16 20v-4', 'M22 20H2'],
  ChartUp: ['M3 3v16h16', 'm9 15 3-3 3 3 5-6'],
  Hospital: ['M12 4v16', 'M4 12h16'],
  Users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  Person: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  Pill: ['M12 2.5c3.2 0 5.5 2.3 5.5 5.5v7c0 3.2-2.3 5.5-5.5 5.5s-5.5-2.3-5.5-5.5v-7c0-3.2 2.3-5.5 5.5-5.5z', 'M12 9v6'],
  Warning: ['M12 3 22 20H2L12 3z', 'M12 10v5', 'M12 17v.01'],
  Calendar: ['M3 4h18', 'M5 2v4', 'M19 2v4', 'M4 10h16', 'M5 20h14', 'M7 16v4', 'M17 16v4'],
  Box: ['M21 8 12 3 3 8v8l9 5 9-5V8z', 'M3 8l9 5 9-5', 'M12 13v8'],
  Money: ['M20 7H5a2 2 0 0 1 0-4h14v4z', 'M2 5v14a2 2 0 0 0 2 2h16v-5H4a2 2 0 0 1 0-4z'],
  Receipt: ['M5 2h14v20l-2-1.5L9 19l-2 1.5z', 'M9 7h6', 'M9 12h6'],
  Check: ['M20 6 9 17l-5-5'],
  OK: ['M20 6 9 17l-5-5'],
  Package: ['M16.5 9.4 7.55 4.24', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 1 2 0l7-4A2 2 0 0 0 21 16z', 'M3.3 7 12 12l8.7-5'],
  Pin: ['M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z', 'M12 12v6'],
  Phone: ['M5 4h4l2 5-2.5 1.5a12 12 0 0 0 6 6L13 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
};

export function Icon({ name, size = 18, className = '' }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.Check;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton-stack ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton skeleton-line ${i === 0 ? 'skeleton-title' : ''}`} />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="grid grid-3" aria-label="Loading" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="card" key={i}>
          <div className="card-body">
            <Skeleton lines={4} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, retry }) {
  return (
    <div className="alert alert-error" role="alert">
      <div>
        <strong>We could not load this.</strong>
        <p>{error?.message || 'Check your connection and try again.'}</p>
        {error?.details?.length > 0 && (
          <ul className="error-details">
            {error.details.map((detail, i) => (
              <li key={i}>{detail.message || detail.path}</li>
            ))}
          </ul>
        )}
      </div>
      {retry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <Icon name="Package" size={24} />
      </div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Alert({ tone = 'info', children, role }) {
  return (
    <div className={`alert alert-${tone}`} role={role || (tone === 'error' ? 'alert' : 'status')}>
      {children}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, required, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={htmlFor}>
          {label} {required && <span className="required" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="hint">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
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
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            x
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages } = pagination;
  const pages = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let i = start; i <= Math.min(totalPages, start + 4); i += 1) pages.push(i);
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`page-btn ${p === page ? 'active' : ''}`}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

export function StatCard({ label, value, hint, tone = 'default', to, icon }) {
  const content = (
    <>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className="stat-icon" aria-hidden="true">
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  );
  if (to) {
    return (
      <a className={`stat-card stat-${tone}`} href={to}>
        {content}
      </a>
    );
  }
  return <div className={`stat-card stat-${tone}`}>{content}</div>;
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
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function DefinitionList({ items }) {
  return (
    <dl className="definition-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RawJson({ label, value }) {
  if (!value) return null;
  return (
    <details className="raw-json">
      <summary>{label}</summary>
      <pre>{value}</pre>
    </details>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="spinner" role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ToneText({ tone, children }) {
  return <span className={`tone-${tone}`}>{children}</span>;
}

export function statusText(value) {
  return titleCase(value);
}
