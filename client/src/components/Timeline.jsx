import { formatDateTime } from '../utils/format.js';

function buildSteps(order) {
  if (order.status === 'cancelled') {
    return [
      { key: 'placed', label: 'Order placed' },
      { key: 'cancelled', label: 'Order cancelled' },
    ];
  }
  const steps = [{ key: 'placed', label: 'Order placed' }];
  if (order.prescriptions?.length || order.status === 'awaiting_prescription') {
    steps.push({ key: 'awaiting_prescription', label: 'Prescription review' });
  }
  steps.push({ key: 'verified', label: 'Verified by pharmacy' });
  steps.push({ key: 'ready', label: order.fulfilment === 'delivery' ? 'Packed' : 'Ready for pickup' });
  if (order.fulfilment === 'delivery') {
    steps.push({ key: 'out_for_delivery', label: 'Out for delivery' });
  }
  steps.push({ key: 'completed', label: 'Completed' });
  return steps;
}

const RANK = {
  placed: 0,
  awaiting_prescription: 1,
  verified: 2,
  ready: 3,
  out_for_delivery: 4,
  completed: 5,
};

export default function Timeline({ order }) {
  const steps = buildSteps(order);
  const events = order.events || [];
  const eventFor = (key) =>
    events.find((event) => event.status === key) ||
    (key === 'placed' ? { created_at: order.created_at } : null);
  const currentRank = RANK[order.status] ?? -1;

  return (
    <ol className="timeline">
      {steps.map((step) => {
        const event = eventFor(step.key);
        const rank = RANK[step.key] ?? -1;
        const done = Boolean(event) || (currentRank >= rank && rank >= 0);
        const isCurrent = currentRank === rank && !['completed', 'cancelled'].includes(order.status);
        return (
          <li key={step.key} className={`timeline-step ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
            <span className="timeline-dot" aria-hidden="true" />
            <div className="timeline-body">
              <strong>{step.label}</strong>
              {event?.created_at && <span className="timeline-time">{formatDateTime(event.created_at)}</span>}
              {event?.note && <p className="timeline-note">{event.note}</p>}
              {isCurrent && <span className="current-label">Current stage</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
