import bcrypt from 'bcryptjs';
import { closeDb, getDb } from '../db/index.js';
import { migrate } from '../db/migrate.js';

export const TEST_PASSWORD = 'TestPass123!';

// Hash once per worker: bcrypt cost 10 is deliberately slow, and every fixture
// user shares the same known password.
export const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);

export function resetDb() {
  closeDb();
  const db = getDb();
  const log = console.log;
  console.log = () => {};
  try {
    migrate();
  } finally {
    console.log = log;
  }
  return db;
}

export function db() {
  return getDb();
}

function isoDate(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addBatch({ pharmacyId, medicineId, batchNo, expiresInDays, quantity, supplierId = null }) {
  const info = getDb()
    .prepare(
      `INSERT INTO batches (pharmacy_id, medicine_id, batch_no, supplier_id, expiry_date,
        quantity_received, quantity_on_hand)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(pharmacyId, medicineId, batchNo, supplierId, isoDate(expiresInDays), quantity, quantity);
  return Number(info.lastInsertRowid);
}

function insertUser({
  role,
  fullName,
  phone,
  email = null,
  pharmacyId = null,
  community = null,
  deliveryAddress = null,
  digitalAddressCode = null,
}) {
  const info = getDb()
    .prepare(
      `INSERT INTO users (role, full_name, phone, email, password_hash, pharmacy_id, community,
        delivery_address, digital_address_code, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      role,
      fullName,
      phone,
      email,
      TEST_PASSWORD_HASH,
      pharmacyId,
      community,
      deliveryAddress,
      digitalAddressCode
    );
  return Number(info.lastInsertRowid);
}

/**
 * Creates a compact but realistic two-pharmacy dataset:
 * - pharmacy 1 (Doryumu) and pharmacy 2 (Kordibe)
 * - one admin, two customers, two pharmacists and two riders
 * - one OTC medicine (three batches, one expired), one POM medicine, one out-of-stock medicine
 * - delivery zones and a supplier
 */
export function seedBase() {
  const database = getDb();

  const pharmacyA = Number(
    database
      .prepare(
        `INSERT INTO pharmacies (name, community, address, landmark, phone, license_no)
         VALUES ('Doryumu Community Pharmacy', 'Doryumu', '12 Market Road', 'Near the lorry station',
                 '+233240000201', 'PH-DOR-001')`
      )
      .run().lastInsertRowid
  );
  const pharmacyB = Number(
    database
      .prepare(
        `INSERT INTO pharmacies (name, community, address, landmark, phone, license_no)
         VALUES ('Kordibe Health Pharmacy', 'Kordibe', '3 Clinic Lane', 'Opposite the clinic',
                 '+233240000202', 'PH-KOR-001')`
      )
      .run().lastInsertRowid
  );

  const admin = insertUser({
    role: 'admin',
    fullName: 'Ama Administrator',
    phone: '+233240000100',
    email: 'admin@test.local',
  });
  const customer = insertUser({
    role: 'customer',
    fullName: 'Kofi Customer',
    phone: '+233240000101',
    email: 'kofi@test.local',
    community: 'Doryumu',
    deliveryAddress: 'House 4, Doryumu',
    digitalAddressCode: 'GD-123-4567',
  });
  const customerB = insertUser({
    role: 'customer',
    fullName: 'Akosua Customer',
    phone: '+233240000102',
    email: 'akosua@test.local',
    community: 'Kordibe',
  });
  const pharmacistA = insertUser({
    role: 'pharmacist',
    fullName: 'Yaw Pharmacist',
    phone: '+233240000103',
    pharmacyId: pharmacyA,
    community: 'Doryumu',
  });
  const pharmacistB = insertUser({
    role: 'pharmacist',
    fullName: 'Adjoa Pharmacist',
    phone: '+233240000104',
    pharmacyId: pharmacyB,
    community: 'Kordibe',
  });
  const riderA = insertUser({
    role: 'rider',
    fullName: 'Kwesi Rider',
    phone: '+233240000105',
    pharmacyId: pharmacyA,
    community: 'Doryumu',
  });
  const riderB = insertUser({
    role: 'rider',
    fullName: 'Esi Rider',
    phone: '+233240000106',
    pharmacyId: pharmacyB,
    community: 'Kordibe',
  });

  database.prepare('INSERT INTO carts (customer_id) VALUES (?)').run(customer);
  database.prepare('INSERT INTO carts (customer_id) VALUES (?)').run(customerB);

  const category = Number(
    database
      .prepare("INSERT INTO categories (name, description) VALUES ('Pain relief', 'Analgesics and antipyretics')")
      .run().lastInsertRowid
  );

  const insertMedicine = database.prepare(
    `INSERT INTO medicines (brand_name, generic_name, strength, dosage_form, category_id,
      requires_prescription, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const medicineOtc = Number(
    insertMedicine.run(
      'Paracetamol',
      'Paracetamol',
      '500 mg',
      'Tablet',
      category,
      0,
      'For mild pain and fever'
    ).lastInsertRowid
  );
  const medicinePom = Number(
    insertMedicine.run(
      'Amoxil',
      'Amoxicillin',
      '250 mg',
      'Capsule',
      category,
      1,
      'Prescription antibiotic'
    ).lastInsertRowid
  );
  const medicineNoStock = Number(
    insertMedicine.run('ORS Plus', 'Oral rehydration salts', '20.5 g', 'Sachet', category, 0, 'Rehydration').lastInsertRowid
  );

  const insertPharmacyMedicine = database.prepare(
    'INSERT INTO pharmacy_medicines (pharmacy_id, medicine_id, price, reorder_level) VALUES (?, ?, ?, ?)'
  );
  insertPharmacyMedicine.run(pharmacyA, medicineOtc, 5.5, 10);
  insertPharmacyMedicine.run(pharmacyA, medicinePom, 12, 5);
  insertPharmacyMedicine.run(pharmacyA, medicineNoStock, 3, 10);
  insertPharmacyMedicine.run(pharmacyB, medicineOtc, 6, 10);
  insertPharmacyMedicine.run(pharmacyB, medicinePom, 13, 5);
  insertPharmacyMedicine.run(pharmacyB, medicineNoStock, 3.5, 10);

  const supplier = Number(
    database
      .prepare(
        `INSERT INTO suppliers (pharmacy_id, name, contact_person, phone, email)
         VALUES (?, 'Accra Wholesale Drugs', 'Nana Supplier', '+233240000301', 'supplier@test.local')`
      )
      .run(pharmacyA).lastInsertRowid
  );

  const batchSoon = addBatch({
    pharmacyId: pharmacyA,
    medicineId: medicineOtc,
    batchNo: 'PAR-SOON',
    expiresInDays: 20,
    quantity: 20,
    supplierId: supplier,
  });
  const batchLater = addBatch({
    pharmacyId: pharmacyA,
    medicineId: medicineOtc,
    batchNo: 'PAR-LATER',
    expiresInDays: 365,
    quantity: 10,
    supplierId: supplier,
  });
  const batchExpired = addBatch({
    pharmacyId: pharmacyA,
    medicineId: medicineOtc,
    batchNo: 'PAR-EXPIRED',
    expiresInDays: -10,
    quantity: 50,
  });
  const batchPom = addBatch({
    pharmacyId: pharmacyA,
    medicineId: medicinePom,
    batchNo: 'AMOX-001',
    expiresInDays: 200,
    quantity: 10,
    supplierId: supplier,
  });
  const batchB = addBatch({
    pharmacyId: pharmacyB,
    medicineId: medicineOtc,
    batchNo: 'PAR-B-001',
    expiresInDays: 120,
    quantity: 7,
  });

  const zoneA = Number(
    database
      .prepare("INSERT INTO delivery_zones (pharmacy_id, name, fee, rules) VALUES (?, 'Doryumu centre', 5, 'Within 3 km')")
      .run(pharmacyA).lastInsertRowid
  );
  const zoneB = Number(
    database
      .prepare("INSERT INTO delivery_zones (pharmacy_id, name, fee, rules) VALUES (?, 'Kordibe centre', 7, 'Within 4 km')")
      .run(pharmacyB).lastInsertRowid
  );

  return {
    pharmacyA,
    pharmacyB,
    admin,
    customer,
    customerB,
    pharmacistA,
    pharmacistB,
    riderA,
    riderB,
    category,
    medicineOtc,
    medicinePom,
    medicineNoStock,
    supplier,
    zoneA,
    zoneB,
    batches: { soon: batchSoon, later: batchLater, expired: batchExpired, pom: batchPom, b: batchB },
  };
}
