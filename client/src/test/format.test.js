import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMoney, ORDER_STATUS_LABELS, paymentLabel, statusLabel, statusTone, titleCase } from '../utils/format';

describe('format utilities', () => {
  describe('formatMoney', () => {
    it('formats a value as GHS with two decimals', () => {
      expect(formatMoney(12.5)).toBe('GHS 12.50');
      expect(formatMoney(5)).toBe('GHS 5.00');
    });

    it('falls back to zero for missing values', () => {
      expect(formatMoney(null)).toBe('GHS 0.00');
      expect(formatMoney(undefined)).toBe('GHS 0.00');
    });
  });

  describe('formatDate / formatDateTime', () => {
    it('returns a friendly date for a stored timestamp', () => {
      const result = formatDate('2026-11-07 10:30:00');
      expect(result).not.toBe('—');
      expect(typeof result).toBe('string');
    });

    it('returns a friendly date time for a stored timestamp', () => {
      const result = formatDateTime('2026-11-07 10:30:00');
      expect(result).not.toBe('—');
    });
  });

  describe('titleCase', () => {
    it('capitalises simple words', () => {
      expect(titleCase('completed')).toBe('Completed');
      expect(titleCase('pending')).toBe('Pending');
    });
  });

  describe('statusLabel', () => {
    it('maps known order statuses to friendly labels', () => {
      expect(statusLabel('awaiting_prescription')).toBe('Awaiting prescription');
      expect(statusLabel('out_for_delivery')).toBe('Out for delivery');
      expect(statusLabel('completed')).toBe('Completed');
    });

    it('falls back to title casing for unknown statuses', () => {
      expect(statusLabel('weird_status')).toBe('Weird Status');
    });
  });

  describe('statusTone', () => {
    it('assigns tones per status group', () => {
      expect(statusTone('completed')).toBe('success');
      expect(statusTone('cancelled')).toBe('danger');
      expect(statusTone('awaiting_prescription')).toBe('warning');
      expect(statusTone('out_for_delivery')).toBe('info');
      expect(statusTone('placed')).toBe('neutral');
    });
  });

  describe('paymentLabel', () => {
    it('maps payment statuses to friendly labels', () => {
      expect(paymentLabel('pending')).toBe('Payment pending');
      expect(paymentLabel('success')).toBe('Paid');
      expect(paymentLabel('cash_on_pickup')).toBe('Cash on pickup/delivery');
      expect(paymentLabel('failed')).toBe('Payment failed');
    });
  });

  describe('ORDER_STATUS_LABELS', () => {
    it('contains every order status used by the system', () => {
      expect(Object.keys(ORDER_STATUS_LABELS)).toEqual(
        expect.arrayContaining(['placed', 'awaiting_prescription', 'verified', 'ready', 'out_for_delivery', 'completed', 'cancelled']),
      );
    });
  });
});
