/**
 * Ghana mobile numbers: 0XXXXXXXXX (10 digits), +233XXXXXXXXX or 00233XXXXXXXXX.
 * Mobile prefixes in use are 02x and 05x. Stored canonical form is +233XXXXXXXXX.
 */
export function normalisePhone(input) {
  if (!input) return null;
  let value = String(input).replace(/[\s()\-.]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (value.startsWith('0')) value = `+233${value.slice(1)}`;
  if (value.startsWith('233')) value = `+${value}`;
  return value;
}

export function isValidGhanaPhone(input) {
  const phone = normalisePhone(input);
  return Boolean(phone && /^\+233(2|5)\d{8}$/.test(phone));
}

export function maskPhone(phone) {
  if (!phone) return '';
  return `${phone.slice(0, 6)}***${phone.slice(-2)}`;
}
