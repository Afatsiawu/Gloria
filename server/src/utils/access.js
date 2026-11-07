import { badRequest, forbidden } from './http.js';

/**
 * Resolves the pharmacy an operation applies to.
 * - pharmacist: always their own pharmacy (a mismatched request is forbidden)
 * - admin: must pass a pharmacyId for pharmacy-scoped operations
 * - rider/customer: forbidden
 */
export function resolvePharmacy(user, requested, { required = true } = {}) {
  if (user.role === 'admin') {
    if (!requested) {
      if (required) throw badRequest('Select a pharmacy.');
      return null;
    }
    return Number(requested);
  }
  if (user.role === 'pharmacist') {
    if (!user.pharmacy_id) throw forbidden('Your account is not linked to a pharmacy.');
    if (requested && Number(requested) !== user.pharmacy_id) {
      throw forbidden('You can only work with your own pharmacy.');
    }
    return user.pharmacy_id;
  }
  throw forbidden();
}
