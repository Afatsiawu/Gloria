import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Timeline from '../components/Timeline';

const baseOrder = (overrides = {}) => ({
  status: 'completed',
  fulfilment: 'delivery',
  prescriptions: [],
  created_at: '2026-11-07 09:00:00',
  events: [{ status: 'completed', created_at: '2026-11-07 12:00:00' }],
  ...overrides,
});

describe('Timeline', () => {
  it('renders every stage of a completed delivery order', () => {
    render(<Timeline order={baseOrder()} />);
    expect(screen.getByText('Order placed')).toBeInTheDocument();
    expect(screen.getByText('Verified by pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Packed')).toBeInTheDocument();
    expect(screen.getByText('Out for delivery')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('marks the cancelled stage for cancelled orders', () => {
    render(<Timeline order={baseOrder({ status: 'cancelled', events: [{ status: 'cancelled', created_at: '2026-11-07 11:00:00' }] })} />);
    expect(screen.getByText('Order cancelled')).toBeInTheDocument();
  });

  it('includes the prescription review stage for orders awaiting review', () => {
    render(<Timeline order={baseOrder({ status: 'awaiting_prescription', events: [{ status: 'awaiting_prescription', created_at: '2026-11-07 10:00:00' }] })} />);
    expect(screen.getByText('Prescription review')).toBeInTheDocument();
    expect(screen.getByText('Current stage')).toBeInTheDocument();
  });
});
