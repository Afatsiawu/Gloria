import * as cartRepo from '../repositories/cart.js';
import * as catalogueRepo from '../repositories/catalogue.js';
import { availableStock } from '../repositories/inventory.js';
import { badRequest, conflict, notFound } from '../utils/http.js';

export function getCart(customerId) {
  return cartRepo.getCart(customerId);
}

export function addItem(customerId, { medicineId, quantity, pharmacyId }) {
  const cart = cartRepo.getOrCreateCart(customerId);
  const medicine = catalogueRepo.getMedicine(medicineId);
  if (!medicine || !medicine.is_active) throw notFound('Medicine not found.');
  const targetPharmacy = cart.pharmacy_id || pharmacyId;
  if (!targetPharmacy) throw badRequest('Choose a pharmacy for this medicine.');
  if (cart.pharmacy_id && pharmacyId && Number(pharmacyId) !== Number(cart.pharmacy_id)) {
    throw conflict('Your cart can only contain medicines from one pharmacy. Clear the cart first or add this item from the pharmacy already selected.', {
      cart_pharmacy_id: cart.pharmacy_id,
      requested_pharmacy_id: pharmacyId,
    });
  }
  if (!cart.pharmacy_id) {
    const pharmacy = catalogueRepo.getPharmacy(targetPharmacy);
    if (!pharmacy || !pharmacy.is_active) throw notFound('Pharmacy not found.');
    cartRepo.setPharmacy(cart.id, targetPharmacy);
  }
  const pm = catalogueRepo.getPharmacyMedicine(targetPharmacy, medicineId);
  if (!pm || !pm.is_active) throw conflict('This pharmacy does not currently sell that medicine.');
  const stock = availableStock(targetPharmacy, medicineId);
  const existing = cartRepo
    .getCart(customerId)
    .items.find((item) => item.medicine_id === Number(medicineId));
  const nextQty = (existing?.quantity || 0) + quantity;
  if (nextQty > stock) {
    throw conflict(`Only ${stock} unit(s) are available at this pharmacy.`, { available: stock });
  }
  cartRepo.upsertItem(cart.id, medicineId, nextQty);
  return cartRepo.getCart(customerId);
}

export function updateItem(customerId, itemId, quantity) {
  const cart = cartRepo.getOrCreateCart(customerId);
  const item = cartRepo.findItem(cart.id, itemId);
  if (!item) throw notFound('Cart item not found.');
  const stock = availableStock(cart.pharmacy_id, item.medicine_id);
  if (quantity > stock) {
    throw conflict(`Only ${stock} unit(s) are available at this pharmacy.`, { available: stock });
  }
  cartRepo.updateItemQuantity(item.id, quantity);
  return cartRepo.getCart(customerId);
}

export function removeItem(customerId, itemId) {
  const cart = cartRepo.getOrCreateCart(customerId);
  const item = cartRepo.findItem(cart.id, itemId);
  if (!item) throw notFound('Cart item not found.');
  cartRepo.removeItem(item.id);
  if (cartRepo.itemCount(cart.id) === 0) cartRepo.setPharmacy(cart.id, null);
  return cartRepo.getCart(customerId);
}

export function clear(customerId) {
  const cart = cartRepo.getOrCreateCart(customerId);
  cartRepo.clearCart(cart.id);
  return cartRepo.getCart(customerId);
}
