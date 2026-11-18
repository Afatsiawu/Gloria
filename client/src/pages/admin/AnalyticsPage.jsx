import { useState } from 'react';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { SalesLineChart, SimpleBarChart, BreakdownDoughnut } from '../../components/Charts.jsx';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageTitle,
  Tabs,
} from '../../components/UI.jsx';
import { formatMoney, titleCase } from '../../utils/format.js';

const DAY = 86400000;
const iso = (date) => date.toISOString().slice(0, 10);

export default function AnalyticsPage() {
  usePageTitle('Analytics');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * DAY)));
  const [to, setTo] = useState(iso(new Date()));
  const [tab, setTab] = useState('sales');
  const [weeks, setWeeks] = useState(4);
  const [leadTimeDays, setLeadTimeDays] = useState(7);
  const [safetyDays, setSafetyDays] = useState(3);

  const base = `from=${from}&to=${to}${isAdmin ? `&pharmacyId=${pharmacyId}` : ''}`;
  const summary = useFetch(`/analytics/summary?${base}`);
  const forecast = useFetch(
    `/analytics/forecast?${isAdmin ? `pharmacyId=${pharmacyId}&` : ''}weeks=${weeks}&leadTimeDays=${leadTimeDays}&safetyDays=${safetyDays}`
  );

  const data = summary.data;
  const items = forecast.data?.items || [];

  return (
    <>
      <PageTitle title="Analytics" subtitle="Sales, product and reorder information for the selected period." />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}

      <div className="toolbar toolbar-start">
        <Field label="From" htmlFor="analytics-from" className="inline-field">
          <input id="analytics-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To" htmlFor="analytics-to" className="inline-field">
          <input id="analytics-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { summary.reload(); forecast.reload(); }}>
          Refresh
        </button>
      </div>

      <Tabs
        tabs={[
          { value: 'sales', label: 'Sales' },
          { value: 'products', label: 'Products' },
          { value: 'demand', label: 'Demand' },
          { value: 'forecast', label: 'Forecast' },
        ]}
        active={tab}
        onChange={setTab}
        label="Analytics sections"
      />

      {summary.error && <ErrorState error={summary.error} retry={summary.reload} />}
      {tab !== 'forecast' && summary.loading && <p className="loading">Loading…</p>}

      {tab !== 'forecast' && data && (
        <p className="hint">
          {data.range.from} to {data.range.to} · Revenue {formatMoney(data.totals.revenue)} · {data.totals.orders} paid orders · Average {formatMoney(data.totals.average_order)} · {data.totals.units} units
        </p>
      )}

      {tab === 'sales' && data && (
        <div className="grid grid-2">
          <section>
            <h2 className="section-heading">Revenue by day</h2>
            <SalesLineChart
              labels={data.trend.map((row) => row.date.slice(5))}
              values={data.trend.map((row) => row.revenue)}
              label="Revenue"
            />
            <p className="hint">Paid order revenue, including delivery fees.</p>
          </section>
          <section>
            <h2 className="section-heading">Payment methods</h2>
            {data.payment_methods.length ? (
              <>
                <BreakdownDoughnut
                  labels={data.payment_methods.map((row) => titleCase(row.method))}
                  values={data.payment_methods.map((row) => row.amount)}
                  label="Revenue by payment method"
                  format={formatMoney}
                  tone="amber"
                />
                <p className="hint">Amount received by each method.</p>
              </>
            ) : <p className="muted">No successful payments in this period.</p>}
          </section>

          <section className="span-2">
            <h2 className="section-heading">{isAdmin ? 'Revenue by pharmacy' : 'Revenue by community'}</h2>
            {isAdmin ? (
              <DataTable
                empty="No pharmacy revenue in this period."
                columns={[
                  { key: 'name', label: 'Pharmacy' },
                  { key: 'community', label: 'Community' },
                  { key: 'orders', label: 'Orders', align: 'right' },
                  { key: 'revenue', label: 'Revenue', align: 'right', render: (row) => formatMoney(row.revenue) },
                ]}
                rows={data.by_pharmacy}
              />
            ) : (
              <DataTable
                empty="No community revenue in this period."
                rowKey="community"
                columns={[
                  { key: 'community', label: 'Community' },
                  { key: 'revenue', label: 'Revenue', align: 'right', render: (row) => formatMoney(row.revenue) },
                ]}
                rows={data.by_community}
              />
            )}
          </section>
        </div>
      )}

      {tab === 'products' && data && (
        <div className="stack">
          <section>
            <h2 className="section-heading">Top products by units</h2>
            {data.top_products.length ? (
              <>
                <SimpleBarChart
                  labels={data.top_products.map((row) => `${row.brand_name}${row.strength ? ` ${row.strength}` : ''}`)}
                  values={data.top_products.map((row) => row.units)}
                  label="Units sold"
                />
                <p className="hint">Units sold in paid orders.</p>
              </>
            ) : <p className="muted">No product sales in this period.</p>}
          </section>

          <section>
            <h2 className="section-heading">Slow-moving stock</h2>
            <DataTable
              empty="No stock with zero sales in this period."
              rowKey="medicine_id"
              columns={[
                { key: 'brand_name', label: 'Medicine', render: (row) => `${row.brand_name}${row.strength ? ` ${row.strength}` : ''}` },
                { key: 'stock', label: 'On hand', align: 'right' },
                { key: 'sold', label: 'Sold', align: 'right' },
              ]}
              rows={data.slow_moving}
            />
            <p className="hint">Only medicines with stock on hand and no sales in the period.</p>
          </section>
        </div>
      )}

      {tab === 'demand' && data && (
        <section>
          <h2 className="section-heading">Unmet demand</h2>
          <DataTable
            empty="No unmatched searches in this period."
            rowKey={(row) => `${row.searched_term}-${row.community || ''}`}
            columns={[
              { key: 'searched_term', label: 'Search term' },
              { key: 'community', label: 'Community', render: (row) => row.community || 'Any' },
              { key: 'count', label: 'Searches', align: 'right' },
            ]}
            rows={data.unmet_demand}
          />
          <p className="hint">Searches that returned no medicine available in the chosen community.</p>
        </section>
      )}

      {tab === 'forecast' && (
        <section>
          <h2 className="section-heading">Reorder forecast</h2>
          <div className="form-grid">
            <Field label="Forecast window (weeks)" htmlFor="forecast-weeks">
              <input id="forecast-weeks" type="number" min="1" max="52" value={weeks} onChange={(event) => setWeeks(event.target.value)} />
            </Field>
            <Field label="Supplier lead time (days)" htmlFor="forecast-lead">
              <input id="forecast-lead" type="number" min="1" max="180" value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value)} />
            </Field>
            <Field label="Safety stock (days)" htmlFor="forecast-safety">
              <input id="forecast-safety" type="number" min="0" max="90" value={safetyDays} onChange={(event) => setSafetyDays(event.target.value)} />
            </Field>
          </div>

          {forecast.error && <ErrorState error={forecast.error} retry={forecast.reload} />}
          {forecast.loading && <p className="loading">Loading…</p>}
          {forecast.data && (
            <>
              <p className="hint">
                {forecast.data.formula} Window {forecast.data.params.window_weeks} week(s), lead time {forecast.data.params.lead_time_days} days, safety stock {forecast.data.params.safety_stock_days} days.
              </p>
              {items.length === 0 ? (
                <EmptyState title="No forecast lines">There are no active medicines at this pharmacy.</EmptyState>
              ) : (
                <DataTable
                  columns={[
                    { key: 'brand_name', label: 'Medicine', render: (row) => <><strong>{row.brand_name}{row.strength ? ` ${row.strength}` : ''}</strong><div className="tiny muted">{row.generic_name}</div></> },
                    { key: 'on_hand', label: 'On hand', align: 'right' },
                    { key: 'avg_weekly_demand', label: 'Avg weekly', align: 'right' },
                    { key: 'forecast_lead_time_demand', label: 'Lead-time demand', align: 'right' },
                    { key: 'safety_stock', label: 'Safety stock', align: 'right' },
                    { key: 'suggested_reorder', label: 'Suggested reorder', align: 'right' },
                    { key: 'status', label: 'Status', render: (row) => (row.suggested_reorder > 0 ? <Badge tone="warning">Reorder</Badge> : <Badge tone="success">Covered</Badge>) },
                  ]}
                  rows={items.slice(0, 30)}
                />
              )}
              <Alert tone="info">The forecast is a guide. Check seasonality and supplier limits before ordering.</Alert>
            </>
          )}
        </section>
      )}
    </>
  );
}
