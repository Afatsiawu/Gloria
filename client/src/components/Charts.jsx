import { formatMoney } from '../utils/format.js';

const WIDTH = 300;
const HEIGHT = 120;
const PAD = 10;

function scalePoints(values) {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? (WIDTH - PAD * 2) / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = PAD + index * step;
      const y = HEIGHT - PAD - (value / max) * (HEIGHT - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function SalesLineChart({ labels = [], values = [], label = 'Revenue' }) {
  const points = scalePoints(values);
  return (
    <figure className="chart-figure">
      <svg
        className="chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${label}: ${labels.map((entry, index) => `${entry} ${formatMoney(values[index] || 0)}`).join(', ')}`}
      >
        <line className="chart-grid" x1={PAD} y1={PAD} x2={WIDTH - PAD} y2={PAD} />
        <line className="chart-grid" x1={PAD} y1={HEIGHT / 2} x2={WIDTH - PAD} y2={HEIGHT / 2} />
        <line className="chart-axis" x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} />
        {points && <polyline className="chart-line" points={points} fill="none" strokeWidth="2" />}
      </svg>
      <figcaption className="chart-caption">
        {labels.length > 0 ? `${labels[0]} to ${labels[labels.length - 1]}` : 'No data for this period'}
      </figcaption>
    </figure>
  );
}

export function SimpleBarChart({
  labels = [],
  values = [],
  label = 'Units',
  format = (value) => value,
  tone = 'green',
}) {
  const max = Math.max(...values, 1);
  if (!labels.length) return <p className="empty">No data for this period.</p>;
  return (
    <figure className="chart-figure">
      <div className="bars" role="img" aria-label={label}>
        {labels.map((entry, index) => (
          <div className="bar-row" key={`${entry}-${index}`}>
            <span title={entry}>{entry}</span>
            <span className="bar-track">
              <span
                className={`bar-fill ${tone === 'amber' ? 'amber' : ''}`.trim()}
                style={{ width: `${Math.round(((values[index] || 0) / max) * 100)}%` }}
              />
            </span>
            <span>{format(values[index] || 0)}</span>
          </div>
        ))}
      </div>
      <figcaption className="chart-caption">{label}</figcaption>
    </figure>
  );
}

export function BreakdownDoughnut({
  labels = [],
  values = [],
  label = 'Breakdown',
  format = (value) => value,
  tone = 'green',
}) {
  const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (!labels.length) return <p className="empty">No data for this period.</p>;
  return (
    <figure className="chart-figure">
      <div className="bars" role="img" aria-label={label}>
        {labels.map((entry, index) => {
          const value = Number(values[index]) || 0;
          const share = total ? Math.round((value / total) * 100) : 0;
          return (
            <div className="bar-row" key={`${entry}-${index}`}>
              <span title={entry}>{entry}</span>
              <span className="bar-track">
                <span className={`bar-fill ${tone === 'amber' ? 'amber' : ''}`.trim()} style={{ width: `${share}%` }} />
              </span>
              <span>{format(value)}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="chart-caption">{label}</figcaption>
    </figure>
  );
}
