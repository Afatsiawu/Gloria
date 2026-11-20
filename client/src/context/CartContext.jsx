import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const GUEST_KEY = 'pharmalink_guest_cart_v1';
const MAX_QUANTITY = 50;

const CartContext = createContext(null);

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function readGuestCart() {
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.pharmacy?.id || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeGuestCart(cart) {
  if (cart?.items?.length) {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(cart));
  } else {
    window.localStorage.removeItem(GUEST_KEY);
  }
  window.dispatchEvent(new Event('cart:changed'));
}

function guestToCart(guest) {
  if (!guest?.pharmacy || !guest.items?.length) return null;
  const items = guest.items.map((item) => ({
    id: item.medicineId,
    medicine_id: item.medicineId,
    brand_name: item.brandName,
    strength: item.strength,
    price: item.price,
    quantity: item.quantity,
    available: item.available,
    line_total: round(item.price * item.quantity),
    requires_prescription: item.requiresPrescription ? 1 : 0,
  }));
  return {
    guest: true,
    pharmacy: guest.pharmacy,
    items,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: round(items.reduce((sum, item) => sum + item.line_total, 0)),
  };
}

function findAvailability(data, pharmacyId, medicine) {
  const rows = (data?.availability || []).filter((row) => Number(row.stock) > 0);
  const chosen = pharmacyId
    ? rows.find((row) => Number(row.pharmacy_id) === Number(pharmacyId))
    : [...rows].sort((a, b) => Number(a.price) - Number(b.price))[0];
  if (!chosen) return null;
  return {
    medicineId: medicine.id,
    brandName: medicine.brand_name,
    strength: medicine.strength,
    price: Number(chosen.price),
    available: Number(chosen.stock),
    requiresPrescription: Boolean(medicine.requires_prescription),
    pharmacy: {
      id: chosen.pharmacy_id,
      name: chosen.pharmacy_name,
      community: chosen.community,
    },
  };
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const isCustomer = user?.role === 'customer';
  const [serverCart, setServerCart] = useState(null);
  const [guestCart, setGuestCart] = useState(() => readGuestCart());
  const [serverLoading, setServerLoading] = useState(false);
  const [conflict, setConflict] = useState(null);
  const mergedFor = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadServerCart = useCallback(async () => {
    if (!isCustomer) {
      setServerCart(null);
      return;
    }
    setServerLoading(true);
    try {
      const data = await api('/cart');
      if (mounted.current) setServerCart(data?.cart || null);
    } catch {
      if (mounted.current) setServerCart(null);
    } finally {
      if (mounted.current) setServerLoading(false);
    }
  }, [isCustomer]);

  useEffect(() => {
    loadServerCart();
  }, [loadServerCart, user?.id]);

  useEffect(() => {
    const onChange = () => {
      if (isCustomer) loadServerCart();
      else setGuestCart(readGuestCart());
    };
    window.addEventListener('cart:changed', onChange);
    return () => window.removeEventListener('cart:changed', onChange);
  }, [isCustomer, loadServerCart]);

  useEffect(() => {
    if (!isCustomer) {
      mergedFor.current = null;
      return;
    }
    if (mergedFor.current === user.id) return;
    mergedFor.current = user.id;

    const guest = readGuestCart();
    if (!guest?.items?.length) return;

    let cancelled = false;
    (async () => {
      let merged = 0;
      for (const item of guest.items) {
        try {
          await api('/cart/items', {
            method: 'POST',
            body: { medicineId: item.medicineId, quantity: item.quantity, pharmacyId: guest.pharmacy.id },
          });
          merged += 1;
        } catch {
          break;
        }
      }
      if (cancelled) return;
      if (merged >= guest.items.length) {
        writeGuestCart(null);
        setGuestCart(null);
      } else if (merged > 0) {
        const rest = { ...guest, items: guest.items.slice(merged) };
        writeGuestCart(rest);
        setGuestCart(rest);
      }
      loadServerCart();
    })();

    return () => {
      cancelled = true;
    };
  }, [isCustomer, user?.id, loadServerCart]);

  const refresh = useCallback(async () => {
    if (isCustomer) await loadServerCart();
    else setGuestCart(readGuestCart());
  }, [isCustomer, loadServerCart]);

  const resolveMedicine = useCallback(async ({ medicineId, pharmacyId, medicine }) => {
    if (medicine?.brand_name && pharmacyId) {
      return {
        medicineId: medicine.id,
        brandName: medicine.brand_name,
        strength: medicine.strength,
        price: Number(medicine.price ?? medicine.min_price ?? 0),
        available: Number(medicine.available ?? medicine.stock ?? 0),
        requiresPrescription: Boolean(medicine.requires_prescription),
      };
    }
    const data = await api(`/medicines/${medicineId}`);
    const resolved = findAvailability(data, pharmacyId, data.medicine);
    if (!resolved) throw new Error('This medicine is out of stock at the moment.');
    return resolved;
  }, []);

  const addGuestItem = useCallback(
    (resolved, quantity) => {
      const current = readGuestCart();
      if (current && Number(current.pharmacy.id) !== Number(resolved.pharmacy.id)) {
        setConflict({
          mode: 'guest',
          pending: { resolved, quantity },
          currentPharmacy: current.pharmacy,
          nextPharmacy: resolved.pharmacy,
        });
        return { conflict: true };
      }
      const cart = current || { pharmacy: resolved.pharmacy, items: [] };
      const existing = cart.items.find((item) => Number(item.medicineId) === Number(resolved.medicineId));
      const nextQuantity = Math.min(MAX_QUANTITY, resolved.available, (existing?.quantity || 0) + quantity);
      if (nextQuantity <= (existing?.quantity || 0)) {
        throw new Error(`Only ${resolved.available} unit(s) are available at this pharmacy.`);
      }
      const items = existing
        ? cart.items.map((item) =>
            Number(item.medicineId) === Number(resolved.medicineId)
              ? { ...item, quantity: nextQuantity, price: resolved.price, available: resolved.available }
              : item
          )
        : [...cart.items, { ...resolved, quantity: nextQuantity }];
      const next = { ...cart, items };
      writeGuestCart(next);
      setGuestCart(next);
      return { added: true, quantity: nextQuantity - (existing?.quantity || 0) };
    },
    []
  );

  const addItem = useCallback(
    async ({ medicineId, pharmacyId, quantity = 1, medicine = null }) => {
      if (isCustomer) {
        const current = serverCart;
        let resolvedPharmacyId = pharmacyId;

        // The catalogue page does not always know which pharmacy to use, so
        // resolve one from the medicine's availability (preferring the pharmacy
        // already in the cart) before calling the cart API.
        if (!resolvedPharmacyId) {
          const data = await api(`/medicines/${medicineId}`);
          const rows = (data?.availability || []).filter((row) => Number(row.stock) > 0);
          const chosen =
            (current?.pharmacy && rows.find((row) => Number(row.pharmacy_id) === Number(current.pharmacy.id))) ||
            [...rows].sort((a, b) => Number(a.price) - Number(b.price))[0];
          if (!chosen) throw new Error('This medicine is out of stock at the moment.');
          resolvedPharmacyId = chosen.pharmacy_id;
        }

        if (current?.pharmacy && Number(current.pharmacy.id) !== Number(resolvedPharmacyId)) {
          setConflict({
            mode: 'customer',
            pending: { medicineId, pharmacyId: resolvedPharmacyId, quantity },
            currentPharmacy: current.pharmacy,
            nextPharmacy: null,
          });
          return { conflict: true };
        }
        await api('/cart/items', { method: 'POST', body: { medicineId, quantity, pharmacyId: resolvedPharmacyId } });
        await loadServerCart();
        return { added: true };
      }

      const resolved = await resolveMedicine({ medicineId, pharmacyId, medicine });
      return addGuestItem(resolved, quantity);
    },
    [addGuestItem, isCustomer, loadServerCart, resolveMedicine, serverCart]
  );

  const resolveConflict = useCallback(
    async (action) => {
      const current = conflict;
      if (!current) return;
      setConflict(null);
      if (action === 'keep') return;

      if (current.mode === 'guest') {
        const resolved = current.pending.resolved;
        const next = {
          pharmacy: resolved.pharmacy,
          items: [{ ...resolved, quantity: Math.min(MAX_QUANTITY, resolved.available, current.pending.quantity) }],
        };
        writeGuestCart(next);
        setGuestCart(next);
        return;
      }

      await api('/cart', { method: 'DELETE' });
      await api('/cart/items', {
        method: 'POST',
        body: {
          medicineId: current.pending.medicineId,
          pharmacyId: current.pending.pharmacyId,
          quantity: current.pending.quantity,
        },
      });
      await loadServerCart();
    },
    [conflict, loadServerCart]
  );

  const setQuantity = useCallback(
    async (item, quantity) => {
      const capped = Math.max(1, Math.min(MAX_QUANTITY, Number(quantity)));
      if (isCustomer) {
        await api(`/cart/items/${item.id}`, { method: 'PATCH', body: { quantity: capped } });
        await loadServerCart();
        return;
      }
      const current = readGuestCart();
      if (!current) return;
      const limit = Math.min(MAX_QUANTITY, Number(item.available) > 0 ? Number(item.available) : MAX_QUANTITY);
      const nextQty = Math.min(capped, limit);
      const next = {
        ...current,
        items: current.items.map((row) =>
          Number(row.medicineId) === Number(item.medicine_id) ? { ...row, quantity: nextQty } : row
        ),
      };
      writeGuestCart(next);
      setGuestCart(next);
    },
    [isCustomer, loadServerCart]
  );

  const removeItem = useCallback(
    async (item) => {
      if (isCustomer) {
        await api(`/cart/items/${item.id}`, { method: 'DELETE' });
        await loadServerCart();
        return;
      }
      const current = readGuestCart();
      if (!current) return;
      const items = current.items.filter((row) => Number(row.medicineId) !== Number(item.medicine_id));
      const next = items.length ? { ...current, items } : null;
      writeGuestCart(next);
      setGuestCart(next);
    },
    [isCustomer, loadServerCart]
  );

  const clearCart = useCallback(async () => {
    if (isCustomer) {
      await api('/cart', { method: 'DELETE' });
      await loadServerCart();
      return;
    }
    writeGuestCart(null);
    setGuestCart(null);
  }, [isCustomer, loadServerCart]);

  const cart = isCustomer ? serverCart : guestToCart(guestCart);
  const loading = isCustomer && serverLoading && !serverCart;

  const value = useMemo(
    () => ({
      cart,
      loading,
      count: cart?.item_count || 0,
      conflict,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      resolveConflict,
      refresh,
    }),
    [cart, loading, conflict, addItem, setQuantity, removeItem, clearCart, resolveConflict, refresh]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider.');
  return context;
}
