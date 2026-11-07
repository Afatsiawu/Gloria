import bcrypt from 'bcryptjs';
import { config } from '../config.js';

export const hashPassword = (plain) => bcrypt.hash(plain, config.bcryptRounds);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
export const hashSecret = (value) => bcrypt.hash(value, 10);
export const verifySecret = (value, hash) => bcrypt.compare(value, hash);

/** Returns an array of unmet password rules (empty means valid). */
export function passwordProblems(password = '') {
  const problems = [];
  if (password.length < 8) problems.push('at least 8 characters');
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
  if (!/\d/.test(password)) problems.push('a number');
  return problems;
}
