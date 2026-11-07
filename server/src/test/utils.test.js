import { describe, expect, it } from 'vitest';
import { normalisePhone, isValidGhanaPhone, maskPhone } from '../utils/phone.js';
import { passwordProblems } from '../utils/password.js';
import { roundMoney, ApiError } from '../utils/http.js';
import { pagination, paged } from '../utils/pagination.js';
import { csvCell, toCsv } from '../utils/csv.js';

describe('phone helpers', () => {
  it('normalises local, international and 00-prefixed Ghana numbers', () => {
    expect(normalisePhone('024 123 4567')).toBe('+233241234567');
    expect(normalisePhone('+233 24 123 4567')).toBe('+233241234567');
    expect(normalisePhone('00233241234567')).toBe('+233241234567');
    expect(normalisePhone('233241234567')).toBe('+233241234567');
    expect(normalisePhone('(055) 987-6543')).toBe('+233559876543');
  });

  it('accepts 02x and 05x mobile prefixes only', () => {
    expect(isValidGhanaPhone('0241234567')).toBe(true);
    expect(isValidGhanaPhone('0559876543')).toBe(true);
    expect(isValidGhanaPhone('+233201234567')).toBe(true);
    expect(isValidGhanaPhone('0412345678')).toBe(false);
    expect(isValidGhanaPhone('02412345')).toBe(false);
    expect(isValidGhanaPhone('not-a-number')).toBe(false);
    expect(isValidGhanaPhone('')).toBe(false);
  });

  it('masks all but the first six and last two digits', () => {
    expect(maskPhone('+233241234567')).toBe('+23324***67');
    expect(maskPhone(null)).toBe('');
  });
});

describe('password policy', () => {
  it('accepts a compliant password', () => {
    expect(passwordProblems('TestPass123!')).toEqual([]);
  });

  it('reports every unmet rule', () => {
    const problems = passwordProblems('abc');
    expect(problems).toEqual(
      expect.arrayContaining(['at least 8 characters', 'an uppercase letter', 'a number'])
    );
    expect(passwordProblems('lowercase1')).toContain('an uppercase letter');
    expect(passwordProblems('UPPERCASE1')).toContain('a lowercase letter');
    expect(passwordProblems('NoDigitsHere')).toContain('a number');
  });
});

describe('money rounding', () => {
  it('rounds to two decimal places', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney('12.3456')).toBe(12.35);
    expect(roundMoney(0)).toBe(0);
  });
});

describe('pagination', () => {
  it('applies defaults and clamps page size', () => {
    expect(pagination({})).toEqual({ page: 1, pageSize: 12, offset: 0 });
    expect(pagination({ page: '3', pageSize: '500' })).toEqual({ page: 3, pageSize: 100, offset: 200 });
    expect(pagination({ page: '-2', pageSize: '0' })).toEqual({ page: 1, pageSize: 12, offset: 0 });
  });

  it('builds pagination metadata with at least one page', () => {
    expect(paged([], 0, 1, 10).pagination).toEqual({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
    expect(paged([1, 2], 21, 2, 10).pagination.totalPages).toBe(3);
  });
});

describe('csv helpers', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe('');
  });

  it('writes a BOM and CRLF rows', () => {
    const csv = toCsv(
      [
        { label: 'A', key: 'a' },
        { label: 'B', key: 'b' },
      ],
      [{ a: 1, b: 'x,y' }]
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('A,B\r\n1,"x,y"');
  });
});

describe('ApiError', () => {
  it('carries status, code and details', () => {
    const error = new ApiError(409, 'CONFLICT', 'No stock', [{ available: 0 }]);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.details).toEqual([{ available: 0 }]);
  });
});
