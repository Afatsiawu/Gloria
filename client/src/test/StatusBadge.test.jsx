import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge, Badge } from '../components/UI';

describe('StatusBadge', () => {
  it('renders the friendly label for a completed order', () => {
    const { container } = render(<StatusBadge status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(container.querySelector('.badge-success')).not.toBeNull();
  });

  it('renders the friendly label for a cancelled order', () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(document.querySelector('.badge-danger')).not.toBeNull();
  });

  it('uses a warning tone for prescriptions awaiting review', () => {
    render(<StatusBadge status="awaiting_prescription" />);
    expect(screen.getByText('Awaiting prescription')).toBeInTheDocument();
    expect(document.querySelector('.badge-warning')).not.toBeNull();
  });
});

describe('Badge', () => {
  it('defaults to the neutral tone', () => {
    render(<Badge tone="neutral">Hello</Badge>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(document.querySelector('.badge-neutral')).not.toBeNull();
  });
});
