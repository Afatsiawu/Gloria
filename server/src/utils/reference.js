import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function orderReference(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  let suffix = '';
  for (let i = 0; i < 4; i += 1) suffix += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `PH-${stamp}-${suffix}`;
}

export function randomFileName(extension = '') {
  return `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${extension}`;
}

export function sixDigitCode() {
  return String(crypto.randomInt(100000, 1000000));
}
