import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const palette = ['#0f766e', '#14b8a6', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#84cc16', '#64748b'];

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#334155', font: { size: 11 } } },
    tooltip: { backgroundColor: '#0f172a' },
  },
  scales: {
    x: { ticks: { color: '#475569', font: { size: 10 } }, grid: { color: '#e2e8f0' } },
    y: { ticks: { color: '#475569', font: { size: 10 } }, grid: { color: '#e2e8f0' }, beginAtZero: true },
  },
};

export function SalesLineChart({ labels, values, label = 'Revenue (GHS)' }) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label,
            data: values,
            borderColor: '#0f766e',
            backgroundColor: 'rgba(20, 184, 166, 0.18)',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
          },
        ],
      }}
      options={baseOptions}
      aria-label={`${label} line chart`}
    />
  );
}

export function SimpleBarChart({ labels, values, label = 'Units', horizontal = false, colors }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label,
            data: values,
            backgroundColor: colors || palette,
            borderRadius: 4,
          },
        ],
      }}
      options={{
        ...baseOptions,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: { ...baseOptions.plugins, legend: { display: false } },
      }}
      aria-label={`${label} bar chart`}
    />
  );
}

export function BreakdownDoughnut({ labels, values, label = 'Breakdown' }) {
  return (
    <Doughnut
      data={{
        labels,
        datasets: [{ data: values, backgroundColor: palette, borderWidth: 2, borderColor: '#fff' }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { ...baseOptions.plugins, legend: { position: 'bottom', labels: { color: '#334155', font: { size: 11 } } } },
      }}
      aria-label={`${label} doughnut chart`}
    />
  );
}
