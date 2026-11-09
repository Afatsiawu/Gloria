import { useState } from 'react';
import { usePageTitle } from '../hooks/useApi.js';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  PageTitle,
  Pagination,
  ProductCard,
  Select,
  StatusBadge,
  StatusChip,
  Stepper,
  StockChip,
  Tabs,
  Toast,
} from '../components/UI.jsx';
import { MiniCard, PhoneMock, VisualFrame } from '../components/LandingVisuals.jsx';

const DEMO_MEDICINE = {
  id: 1,
  brand_name: 'Panadol',
  strength: '500 mg',
  dosage_form: 'Tablet',
  min_price: 5,
  stock: 24,
  requires_prescription: 0,
  image_path: null,
};

const DEMO_ROWS = [
  { id: 1, name: 'Panadol 500 mg', stock: 24, status: 'success' },
  { id: 2, name: 'Brufen 400 mg', stock: 7, status: 'warning' },
  { id: 3, name: 'Amoxil 500 mg', stock: 0, status: 'danger' },
];

function Section({ title, children }) {
  return (
    <section className="styleguide-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function StyleGuidePage() {
  usePageTitle('Styleguide');
  const [tab, setTab] = useState('one');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="section">
      <PageTitle
        title="Styleguide"
        subtitle="Development-only view of every shared component and state."
        actions={<Badge tone="primary">dev only</Badge>}
      />

      <Section title="Buttons">
        <div className="sg-row">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Quiet</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button className="btn-sm">Small</Button>
        </div>
      </Section>

      <Section title="Forms">
        <div className="sg-grid">
          <Field label="Medicine" htmlFor="sg-medicine" hint="Search by brand or generic name.">
            <Input id="sg-medicine" placeholder="Search medicines" />
          </Field>
          <Field label="Phone" htmlFor="sg-phone">
            <Input id="sg-phone" type="tel" inputMode="tel" placeholder="024 000 0000" />
          </Field>
          <Field label="Pharmacy" htmlFor="sg-pharmacy">
            <Select id="sg-pharmacy" defaultValue="">
              <option value="" disabled>
                Choose a pharmacy
              </option>
              <option>Doryumu Community Pharmacy</option>
              <option>Kordibe Health Pharmacy</option>
            </Select>
          </Field>
          <Field label="Phone" htmlFor="sg-phone-error" error="Enter a Ghana mobile number.">
            <Input id="sg-phone-error" type="tel" inputMode="tel" defaultValue="024" aria-invalid="true" />
          </Field>
        </div>
        <div className="sg-row">
          <label className="checkbox">
            <input type="checkbox" defaultChecked /> I understand a pharmacist checks prescriptions.
          </label>
        </div>
        <div className="option-cards">
          <label className="option-card selected">
            <input type="radio" name="sg-fulfilment" defaultChecked /> Pickup
          </label>
          <label className="option-card">
            <input type="radio" name="sg-fulfilment" /> Delivery
          </label>
        </div>
      </Section>

      <Section title="Status and tags">
        <div className="sg-row">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="primary">Primary</Badge>
          <span className="rx-tag">Prescription needed</span>
        </div>
        <div className="sg-row">
          <StatusBadge status="placed" />
          <StatusBadge status="awaiting_prescription" />
          <StatusBadge status="verified" />
          <StatusBadge status="ready" />
          <StatusBadge status="out_for_delivery" />
          <StatusBadge status="completed" />
          <StatusBadge status="cancelled" />
        </div>
        <div className="sg-row">
          <StatusChip tone="success">In stock</StatusChip>
          <StatusChip tone="warning">Low stock</StatusChip>
          <StatusChip tone="danger">Out of stock</StatusChip>
          <StockChip stock={24} />
          <StockChip stock={6} />
          <StockChip stock={0} />
        </div>
      </Section>

      <Section title="Alerts and toasts">
        <div className="sg-stack">
          <Alert tone="info">Information guidance for the next step.</Alert>
          <Alert tone="success">Your order was placed.</Alert>
          <Alert tone="warning">This medicine needs a prescription.</Alert>
          <Alert tone="error">That reference and phone number do not match.</Alert>
        </div>
        <div className="sg-stack" style={{ marginTop: 16 }}>
          <div className="toast" style={{ position: 'static' }}>
            <span>Added to cart.</span>
            <button type="button" className="toast-close" aria-label="Dismiss message">
              Close
            </button>
          </div>
        </div>
      </Section>

      <Section title="Cards and product">
        <div className="sg-grid">
          <div className="card">
            <h3>Card title</h3>
            <p className="muted">A white card with a 16px radius, neutral border and e1 shadow.</p>
          </div>
          <ProductCard medicine={DEMO_MEDICINE} onAdd={() => {}} />
        </div>
      </Section>

      <Section title="Stepper">
        <div className="card">
          <Stepper
            steps={[
              { key: 'verified', label: 'Verified', state: 'done', time: '9 Nov, 10:20' },
              { key: 'ready', label: 'Ready', state: 'current', time: '9 Nov, 10:45' },
              { key: 'completed', label: 'Completed', state: 'todo' },
            ]}
          />
        </div>
      </Section>

      <Section title="Tables and pagination">
        <DataTable
          columns={[
            { key: 'name', label: 'Medicine' },
            { key: 'stock', label: 'Stock', align: 'right' },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <StatusChip tone={row.status}>
                  {row.status === 'success' ? 'In stock' : row.status === 'warning' ? 'Low stock' : 'Out of stock'}
                </StatusChip>
              ),
            },
          ]}
          rows={DEMO_ROWS}
        />
        <Pagination pagination={{ page: 2, totalPages: 4 }} onPage={() => {}} />
      </Section>

      <Section title="Tabs and modal">
        <Tabs
          tabs={[
            { value: 'one', label: 'Overview' },
            { value: 'two', label: 'Orders' },
            { value: 'three', label: 'Stock' },
          ]}
          active={tab}
          onChange={setTab}
        />
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Open modal
        </Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Modal example"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Confirm</Button>
            </>
          }
        >
          <p>Modals use the e3 elevation, a white surface and a close action at least 44px.</p>
        </Modal>
      </Section>

      <Section title="States">
        <div className="sg-grid">
          <Loading text="Loading example" />
          <EmptyState title="Nothing here yet" action={<Button variant="secondary">Try again</Button>}>
            Empty states explain what to do next.
          </EmptyState>
          <ErrorState error={{ message: 'Could not load this.' }} retry={() => {}} />
        </div>
      </Section>

      <Section title="Landing visuals">
        <div className="sg-visuals">
          <VisualFrame tone="peach" className="sg-visual">
            <PhoneMock />
            <MiniCard>
              <span className="mini-dot" />
              <span>
                <strong>In stock</strong>
                <span className="mini-label">Panadol 500 mg</span>
              </span>
            </MiniCard>
          </VisualFrame>
          <VisualFrame tone="blue" shape="panel" className="sg-visual">
            <MiniCard>
              <span className="mini-search">
                <span>Search medicines</span>
              </span>
            </MiniCard>
          </VisualFrame>
          <VisualFrame tone="rose" shape="panel" className="sg-visual">
            <MiniCard>
              <span className="mini-dot" />
              <span>
                <strong>Ready</strong>
                <span className="mini-label">Order updates appear here</span>
              </span>
            </MiniCard>
          </VisualFrame>
        </div>
      </Section>

      <Section title="Type scale">
        <p className="eyebrow">Section eyebrow</p>
        <h1>Heading one</h1>
        <h2>Heading two</h2>
        <h3>Heading three</h3>
        <h4>Heading four</h4>
        <p className="lead">Lead paragraph at 18px.</p>
        <p>Body copy at 16px. Prices and totals use tabular figures, for example GHS 24.50.</p>
        <p className="muted">Secondary text at 14px sits on neutral-600.</p>
        <p className="mono">PH-20261109-AB12</p>
        <Toast tone="success" onClose={() => {}} className="toast-static">
          A toast uses the e3 elevation.
        </Toast>      </Section>
    </div>
  );
}
