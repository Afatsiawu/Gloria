import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js';
import { Icon } from './UI.jsx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function linkIsActive(link, pathname, hash) {
  if (link.hash) return pathname === link.to && hash === link.hash;
  if (link.to === '/') return pathname === '/' && !hash;
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}

function MenuLink({ link, active, onClose }) {
  return (
    <Link
      to={`${link.to}${link.hash || ''}`}
      className={active ? 'active' : undefined}
      aria-current={active ? 'page' : undefined}
      onClick={onClose}
    >
      {link.label}
    </Link>
  );
}

/**
 * Full-screen navigation used below the 1024px breakpoint by both the
 * customer and staff layouts. It is portalled to document.body so no
 * ancestor can clip it.
 */
export default function NavMenu({
  open,
  onClose,
  label = 'Menu',
  title = 'PharmaLink',
  sections = [],
  onLogout,
  triggerRef,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const { pathname, hash } = useLocation();

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    closeRef.current?.focus();

    window.history.pushState({ ...(window.history.state || {}), navMenu: true }, '');

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0
      );
      if (!items.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !panelRef.current.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !panelRef.current.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    const onPopState = () => onClose();

    const desktop = window.matchMedia('(min-width: 1024px)');
    const onBreakpoint = (event) => {
      if (event.matches) onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('popstate', onPopState);
    desktop.addEventListener('change', onBreakpoint);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
      desktop.removeEventListener('change', onBreakpoint);
      if (window.history.state?.navMenu) window.history.back();
      const trigger = triggerRef?.current;
      if (trigger && trigger.getClientRects().length > 0) trigger.focus();
    };
  }, [open, onClose, triggerRef]);

  const routeKey = `${pathname}${hash}`;
  const lastRoute = useRef(routeKey);

  useEffect(() => {
    if (lastRoute.current !== routeKey) {
      lastRoute.current = routeKey;
      if (open) onClose();
    }
  }, [routeKey, open, onClose]);

  const handleLogout = useCallback(() => {
    onClose();
    onLogout?.();
  }, [onClose, onLogout]);

  if (!open) return null;

  return createPortal(
    <div className="nav-menu" role="dialog" aria-modal="true" aria-label={label} ref={panelRef} tabIndex={-1}>
      <div className="nav-menu-header">
        <span className="nav-menu-title">{title}</span>
        <button type="button" className="nav-menu-close" aria-label="Close menu" onClick={onClose} ref={closeRef}>
          <Icon name="Close" size={24} />
        </button>
      </div>
      <nav className="nav-menu-body" aria-label={label}>
        {sections.map((section, index) => (
          <div className="nav-menu-section" key={section.title || index}>
            {section.title && <p className="nav-menu-heading">{section.title}</p>}
            {section.links.map((link) => (
              <MenuLink
                key={`${link.to}${link.hash || ''}`}
                link={link}
                active={linkIsActive(link, pathname, hash)}
                onClose={onClose}
              />
            ))}
          </div>
        ))}
      </nav>
      {onLogout && (
        <div className="nav-menu-footer">
          <button type="button" className="nav-menu-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
