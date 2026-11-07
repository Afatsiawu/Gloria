import { useState } from 'react';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { SalesLineChart, SimpleBarChart, BreakdownDoughnut } from '../../components/Charts.jsx';
import { Alert, Badge, EmptyState, ErrorState, Field, PageHeader, Skeleton, StatCard } from '../../components/UI.jsx';
import { formatMoney, titleCase } from '../../utils/format.js';

const DAY = 86400000;
const iso = (date) => date.toISOString().slice(0, 10);

export default function AnalyticsPage() {
  usePageTitle('Analytics & forecast');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * DAY)));
  const [to, setTo] = useState(iso(new Date()));
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
      <PageHeader
        eyebrow="Business intelligence"
        title="Analytics & demand forecast"
        subtitle="Revenue trends, product mix, unmet demand, slow-moving stock and a moving-average reorder forecast."
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={() => { summary.reload(); forecast.reload(); }}>Refresh</button>}
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}

      <div className="card mb-2">
        <div className="card-body">
          <div className="form-grid">
            <Field label="From" htmlFor="analytics-from">
              <input id="analytics-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="To" htmlFor="analytics-to">
              <input id="analytics-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
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
        </div>
      </div>

      {summary.error && <ErrorState error={summary.error} retry={summary.reload} />}
      {summary.loading && <Skeleton lines={7} />}

      {data && (
        <>
          <div className="stat-grid">
            <StatCard label="Revenue" value={formatMoney(data.totals.revenue)} hint={`${data.range.from} to ${data.range.to}`} tone="success" icon="💰" />
            <StatCard label="Paid orders" value={data.totals.orders} hint={`Average ${formatMoney(data.totals.average_order)}`} icon="🧾" />
            <StatCard label="Units dispensed" value={data.totals.units} hint="Across all order lines" icon="💊" />
            <StatCard label="Product revenue" value={formatMoney(data.totals.product_revenue)} hint="Excludes delivery fees" icon="📦" />
          </div>

          <div className="grid grid-2 mt-2">
            <section className="card">
              <div className="card-header"><h2>Revenue trend</h2></div>
              <div className="card-body">
                <div className="chart-box">
                  <SalesLineChart labels={data.trend.map((row) => row.date.slice(5))} values={data.trend.map((row) => row.revenue)} />
                </div>
              </div>
            </section>
            <section className="card">
              <div className="card-header"><h2>Payment methods</h2></div>
              <div className="card-body">
                {data.payment_methods.length ? (
                  <div className="chart-box">
                    <BreakdownDoughnut
                      labels={data.payment_methods.map((row) => titleCase(row.method))}
                      values={data.payment_methods.map((row) => row.amount)}
                      label="Revenue by payment method"
                    />
                  </div>
                ) : <p className="muted">No successful payments in this range.</p>}
              </div>
            </section>
          </div>

          <div className="grid grid-2 mt-2">
            <section className="card">
              <div className="card-header"><h2>Top products by units</h2></div>
              <div className="card-body">
                {data.top_products.length ? (
                  <div className="chart-box tall">
                    <SimpleBarChart
                      horizontal
                      labels={data.top_products.map((row) => `${row.brand_name}${row.strength ? ` ${row.strength}` : ''}`)}
                      values={data.top_products.map((row) => row.units)}
                      label="Units sold"
                    />
                  </div>
                ) : <p className="muted">No product sales in this range.</p>}
              </div>
            </section>
            <section className="card">
              <div className="card-header"><h2>Revenue by community</h2></div>
              <div className="card-body">
                {data.by_community.length ? (
                  <div className="chart-box tall">
                    <SimpleBarChart
                      labels={data.by_community.map((row) => row.community)}
                      values={data.by_community.map((row) => row.revenue)}
                      label="Revenue (GHS)"
                    />
                  </div>
                ) : <p className="muted">No community revenue in this range.</p>}
              </div>
            </section>
          </div>

          {isAdmin && data.by_pharmacy.length > 0 && (
            <section className="card mt-2">
              <div className="card-header"><h2>Revenue by pharmacy</h2></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Pharmacy</th><th>Community</th><th className="text-right">Orders</th><th className="text-right">Revenue</th></tr></thead>
                  <tbody>
                    {data.by_pharmacy.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.community}</td>
                        <td className="text-right">{row.orders}</td>
                        <td className="text-right">{formatMoney(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="grid grid-2 mt-2">
            <section className="card">
              <div className="card-header"><h2>Unmet demand</h2></div>
              <div className="card-body">
                {data.unmet_demand.length === 0 ? <p className="muted mb-0">No unmatched searches in this range.</p> : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Search term</th><th>Community</th><th className="text-right">Searches</th></tr></thead>
                      <tbody>
                        {data.unmet_demand.map((row) => (
                          <tr key={`${row.searched_term}-${row.community || ''}`}>
                            <td>{row.searched_term}</td>
                            <td>{row.community || 'Any'}</td>
                            <td className="text-right">{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
            <section className="card">
              <div className="card-header"><h2>Slow-moving stock</h2></div>
              <div className="card-body">
                {data.slow_moving.length === 0 ? <p className="muted mb-0">No stock with zero sales in this range.</p> : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Medicine</th><th className="text-right">On hand</th><th className="text-right">Sold</th></tr></thead>
                      <tbody>
                        {data.slow_moving.map((row) => (
                          <tr key={row.medicine_id}>
                            <td>{row.brand_name}{row.strength ? ` ${row.strength}` : ''}</td>
                            <td className="text-right">{row.stock}</td>
                            <td className="text-right">{row.sold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <section className="card mt-3">
        <div className="card-header">
          <h2>Reorder forecast</h2>
          <Badge tone="info">Moving average</Badge>
        </div>
        <div className="card-body">
          {forecast.error && <ErrorState error={forecast.error} retry={forecast.reload} />}
          {forecast.loading && <Skeleton lines={5} />}
          {forecast.data && (
            <>
              <p className="formula-box">{forecast.data.formula}</p>
              <p className="small muted">
                Window {forecast.data.params.window_weeks} week(s), lead time {forecast.data.params.lead_time_days} days,
                safety stock {forecast.data.params.safety_stock_days} days. Items are ranked by suggested reorder quantity.
              </p>
              {items.length === 0 ? (
                <EmptyState title="No forecast lines">There are no active medicines at this pharmacy.</EmptyState>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th className="text-right">On hand</th>
                        <th className="text-right">Avg weekly demand</th>
                        <th className="text-right">Lead-time demand</th>
                        <th className="text-right">Safety stock</th>
                        <th className="text-right">Suggested reorder</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.slice(0, 30).map((item) => (
                        <tr key={item.medicine_id}>
                          <td><strong>{item.brand_name}{item.strength ? ` ${item.strength}` : ''}</strong><div className="tiny muted">{item.generic_name}</div></td>
                          <td className="text-right">{item.on_hand}</td>
                          <td className="text-right">{item.avg_weekly_demand}</td>
                          <td className="text-right">{item.forecast_lead_time_demand}</td>
                          <td className="text-right">{item.safety_stock}</td>
                          <td className="text-right"><strong>{item.suggested_reorder}</strong></td>
                          <td>
                            {item.suggested_reorder > 0
                              ? <Badge tone="warning">Reorder</Badge>
                              : <Badge tone="success">Covered</Badge>}
                            {item.below_reorder_level && <div className="tiny tone-danger mt-1">Below reorder level</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Alert tone="info">
                The forecast is decision support, not an instruction. Adjust for seasonality, promotions and
                supplier constraints before ordering.
              </Alert>
            </>
          )}
        </div>
      </section>
    </>
  );
}
