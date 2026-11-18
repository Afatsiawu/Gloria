/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { finished } from 'node:stream/promises';
import { config } from '../config.js';
import { migrate } from './migrate.js';
import { getDb } from './index.js';
import { hashPassword } from '../utils/password.js';
import { orderReference } from '../utils/reference.js';

const DAY = 24 * 60 * 60 * 1000;
const isoDate = (d) => d.toISOString().slice(0, 10);
const isoDateTime = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const addDays = (d, n) => new Date(d.getTime() + n * DAY);

function mulberry32(a) {
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261107);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

const PHARMACIES = [
  ['Doryumu Community Pharmacy', 'Doryumu', 'Market Road, Doryumu', 'Near Doryumu Lorry Station', '0244000101', 'DD-PH-001'],
  ['Osudoku Health Pharmacy', 'Doryumu', 'Doryumu Junction', 'Opposite ECG District Office', '0244000102', 'DD-PH-002'],
  ["St. Mary's Chemist", 'Doryumu', 'Zongo Road, Doryumu', "Beside St. Mary's Clinic", '0244000103', 'DD-PH-003'],
  ['Adom Pharmacy', 'Doryumu', 'New Town, Doryumu', 'Near Doryumu Presby Church', '0244000104', 'DD-PH-004'],
  ['Nyame Nti Pharmacy', 'Doryumu', 'Old Market, Doryumu', "Behind the Chief's Palace", '0244000105', 'DD-PH-005'],
  ['Shai Hills Pharmacy', 'Doryumu', 'Accra-Akosombo Highway, Doryumu', 'Near Shai Hills Junction', '0244000106', 'DD-PH-006'],
  ['Kordibe Community Pharmacy', 'Kordibe', 'Central Kordibe', 'Opposite Kordibe Health Centre', '0244000201', 'KB-PH-001'],
  ['Volta Care Pharmacy', 'Kordibe', 'Market Square, Kordibe', 'Beside the Kordibe Lorry Park', '0244000202', 'KB-PH-002'],
  ['Amani Chemist', 'Kordibe', 'East Kordibe', 'Near Kordibe Presbyterian Basic School', '0244000203', 'KB-PH-003'],
  ['Bethel Pharmacy', 'Kordibe', 'West Kordibe', 'Along the main road, near Bethel Church', '0244000204', 'KB-PH-004'],
];

const CATEGORIES = [
  ['Analgesics & Pain Relief', 'Pain, fever and inflammation relief'],
  ['Antimalarials', 'Malaria treatment and prevention'],
  ['Antibiotics', 'Bacterial infection treatment'],
  ['Cardiovascular', 'Blood pressure and heart medicines'],
  ['Diabetes Care', 'Diabetes medicines and monitoring'],
  ['Gastrointestinal', 'Stomach, gut and rehydration products'],
  ['Vitamins & Supplements', 'Vitamins, minerals and tonics'],
  ['Respiratory', 'Asthma, cough and allergy medicines'],
  ['Dermatology', 'Skin creams, lotions and topical treatments'],
  ['Maternal & Child Health', 'Mother and baby care products'],
  ['First Aid & Wound Care', 'Dressings, antiseptics and plasters'],
  ['Sexual & Reproductive Health', 'Contraception and reproductive health'],
];

// [brand, generic, strength, form, category index, POM?, description, base price GHS]
const MEDICINES = [
  ['Panadol', 'Paracetamol', '500 mg', 'Tablet', 0, 0, 'Relieves mild to moderate pain and fever.', 5],
  ['Brufen', 'Ibuprofen', '400 mg', 'Tablet', 0, 0, 'Anti-inflammatory pain relief.', 7],
  ['Voltaren', 'Diclofenac Sodium', '50 mg', 'Tablet', 0, 1, 'Prescription anti-inflammatory for moderate pain.', 12],
  ['Cardiprin', 'Aspirin', '75 mg', 'Tablet', 3, 0, 'Low-dose aspirin for cardiovascular protection.', 6],
  ['Coartem', 'Artemether-Lumefantrine', '20/120 mg', 'Tablet', 1, 1, 'First-line uncomplicated malaria treatment.', 35],
  ['Artesun', 'Artesunate', '60 mg', 'Injection', 1, 1, 'Severe malaria, administered under clinical supervision.', 28],
  ['Amoxil', 'Amoxicillin', '500 mg', 'Capsule', 2, 1, 'Broad-spectrum antibiotic.', 22],
  ['Augmentin', 'Amoxicillin-Clavulanate', '625 mg', 'Tablet', 2, 1, 'Antibiotic for resistant respiratory and skin infections.', 48],
  ['Zithromax', 'Azithromycin', '500 mg', 'Tablet', 2, 1, 'Antibiotic for respiratory and sexually transmitted infections.', 32],
  ['Cipro', 'Ciprofloxacin', '500 mg', 'Tablet', 2, 1, 'Antibiotic for urinary and gastrointestinal infections.', 18],
  ['Flagyl', 'Metronidazole', '400 mg', 'Tablet', 2, 1, 'Antibiotic and antiprotozoal.', 10],
  ['Vibramycin', 'Doxycycline', '100 mg', 'Capsule', 2, 1, 'Antibiotic used for malaria prevention and infections.', 14],
  ['Septrin', 'Cotrimoxazole', '480 mg', 'Tablet', 2, 1, 'Antibiotic for urinary and respiratory infections.', 9],
  ['Glucophage', 'Metformin', '500 mg', 'Tablet', 4, 1, 'First-line type 2 diabetes medicine.', 16],
  ['Daonil', 'Glibenclamide', '5 mg', 'Tablet', 4, 1, 'Type 2 diabetes medicine.', 12],
  ['Norvasc', 'Amlodipine', '5 mg', 'Tablet', 3, 1, 'Calcium channel blocker for high blood pressure.', 20],
  ['Zestril', 'Lisinopril', '10 mg', 'Tablet', 3, 1, 'ACE inhibitor for high blood pressure.', 24],
  ['Cozaar', 'Losartan', '50 mg', 'Tablet', 3, 1, 'Angiotensin receptor blocker for hypertension.', 30],
  ['Esidrex', 'Hydrochlorothiazide', '25 mg', 'Tablet', 3, 1, 'Diuretic for high blood pressure.', 11],
  ['Lipitor', 'Atorvastatin', '20 mg', 'Tablet', 3, 1, 'Lowers cholesterol.', 38],
  ['Losec', 'Omeprazole', '20 mg', 'Capsule', 5, 0, 'Reduces stomach acid and treats ulcers.', 25],
  ['ORS', 'Oral Rehydration Salts', '20.5 g', 'Sachet', 5, 0, 'Rehydrates during diarrhoea and vomiting.', 3],
  ['Zinc-20', 'Zinc Sulphate', '20 mg', 'Tablet', 5, 0, 'Supports recovery from childhood diarrhoea.', 3],
  ['Zyrtec', 'Cetirizine', '10 mg', 'Tablet', 7, 0, 'Non-drowsy antihistamine for allergies.', 8],
  ['Clarityne', 'Loratadine', '10 mg', 'Tablet', 7, 0, 'Antihistamine for hay fever and itching.', 10],
  ['Piriton', 'Chlorpheniramine', '4 mg', 'Tablet', 7, 0, 'Antihistamine for allergic reactions.', 4],
  ['Ventolin', 'Salbutamol', '100 mcg', 'Inhaler', 7, 1, 'Relieves asthma and wheezing.', 45],
  ['Becotide', 'Beclomethasone', '250 mcg', 'Inhaler', 7, 1, 'Preventer inhaler for asthma.', 62],
  ['Vitafol', 'Multivitamin', '200 ml', 'Syrup', 6, 0, 'Daily multivitamin tonic.', 18],
  ['Redoxon', 'Vitamin C', '100 mg', 'Tablet', 6, 0, 'Vitamin C supplement.', 6],
  ['Folacid', 'Folic Acid', '5 mg', 'Tablet', 9, 0, 'Folic acid for pregnancy and anaemia.', 4],
  ['Ferrous', 'Ferrous Sulphate', '200 mg', 'Tablet', 6, 0, 'Iron supplement for anaemia.', 5],
  ['Cal-D', 'Calcium + Vitamin D', '600 mg', 'Tablet', 6, 0, 'Bone health supplement.', 15],
  ['Neurobion', 'Vitamin B Complex', '100 mg', 'Tablet', 6, 0, 'B-complex for nerve health.', 12],
  ['SD Bioline', 'Malaria Rapid Test Kit', '25 tests', 'Test kit', 1, 0, 'Rapid malaria diagnostic test.', 18],
  ['Clearblue', 'Pregnancy Test Kit', '1 test', 'Test kit', 11, 0, 'Home pregnancy test.', 15],
  ['Durex', 'Condoms', '3 pack', 'Pack', 11, 0, 'Male condoms for protection.', 8],
  ['Postinor', 'Levonorgestrel', '1.5 mg', 'Tablet', 11, 1, 'Emergency contraception; pharmacist counselling required.', 22],
  ['Canesten', 'Clotrimazole', '1%', 'Cream', 8, 0, 'Treats fungal skin infections.', 20],
  ['Genticin', 'Gentamicin', '0.3%', 'Eye drops', 8, 1, 'Antibiotic eye drops.', 14],
  ['Tetracycline', 'Tetracycline', '1%', 'Eye ointment', 8, 0, 'Eye ointment for bacterial infections.', 9],
  ['Hydrocortisone', 'Hydrocortisone', '1%', 'Cream', 8, 0, 'Relieves inflammation and itching.', 12],
  ['Calamine', 'Calamine', '15%', 'Lotion', 8, 0, 'Soothes itchy skin and rashes.', 10],
  ['Betadine', 'Povidone Iodine', '10%', 'Solution', 10, 0, 'Antiseptic for wounds.', 16],
  ['Hydrogen Peroxide', 'Hydrogen Peroxide', '3%', 'Solution', 10, 0, 'Wound cleaning solution.', 7],
  ['Elastoplast', 'Adhesive Plasters', 'Assorted', 'Pack', 10, 0, 'Sterile plasters for minor cuts.', 6],
  ['Cotton Wool', 'Absorbent Cotton Wool', '100 g', 'Pack', 10, 0, 'Wound cleaning and dressing.', 8],
  ['Amoxil Syrup', 'Amoxicillin', '125 mg/5 ml', 'Suspension', 2, 1, 'Paediatric antibiotic suspension.', 18],
  ['Calpol', 'Paracetamol', '120 mg/5 ml', 'Syrup', 9, 0, 'Fever and pain relief for children.', 12],
  ['Coartem Baby', 'Artemether-Lumefantrine', '20/120 mg', 'Suspension', 1, 1, 'Paediatric malaria treatment.', 30],
  ['ORS + Zinc Kit', 'Oral Rehydration Salts + Zinc', 'Kit', 'Kit', 9, 0, 'Childhood diarrhoea treatment kit.', 6],
  ['Lantus', 'Insulin Glargine', '100 IU/ml', 'Injection', 4, 1, 'Long-acting insulin; cold chain required.', 145],
  ['Mixtard', 'Insulin Human', '100 IU/ml', 'Injection', 4, 1, 'Mixed insulin; cold chain required.', 95],
  ['Amoxil 250', 'Amoxicillin', '250 mg', 'Capsule', 2, 1, 'Antibiotic for adults and older children.', 15],
  ['Zinnat', 'Cefuroxime', '500 mg', 'Tablet', 2, 1, 'Second-generation cephalosporin antibiotic.', 42],
  ['Tramal', 'Tramadol', '50 mg', 'Capsule', 0, 1, 'Prescription pain relief; controlled medicine.', 25],
  ['Valium', 'Diazepam', '5 mg', 'Tablet', 0, 1, 'Controlled medicine for anxiety and spasms.', 18],
  ['Ventolin Syrup', 'Salbutamol', '2 mg/5 ml', 'Syrup', 7, 1, 'Bronchodilator syrup.', 22],
  ['Brufen Syrup', 'Ibuprofen', '100 mg/5 ml', 'Suspension', 9, 0, 'Pain and fever relief for children.', 14],
  ['Glucose', 'Glucose', '50%', 'Injection', 10, 1, 'Emergency hypoglycaemia treatment.', 12],
  ['Quinine', 'Quinine', '300 mg', 'Tablet', 1, 1, 'Malaria treatment where artemisinin is unavailable.', 16],
  ['Mist. Mag', 'Magnesium Trisilicate', '200 ml', 'Suspension', 5, 0, 'Antacid for indigestion.', 11],
  ['Dulcolax', 'Bisacodyl', '5 mg', 'Tablet', 5, 0, 'Short-term constipation relief.', 9],
  ['Microgynon', 'Ethinylestradiol + Levonorgestrel', '30 mcg/150 mcg', 'Tablet', 11, 1, 'Combined oral contraceptive.', 20],
  ['Toxoid', 'Tetanus Toxoid', '0.5 ml', 'Injection', 9, 1, 'Tetanus vaccination.', 15],
  ['Vitamin A', 'Retinol', '200,000 IU', 'Capsule', 9, 0, 'Vitamin A supplementation.', 3],
];

const SUPPLIER_NAMES = [
  ['Ernest Chemists Ltd', 'Ernest Ofori', '0244333001', 'orders@ernestchemists.com', 'Tema, Greater Accra'],
  ['Kinapharma Ltd', 'Akosua Boateng', '0244333002', 'sales@kinapharma.com', 'Accra Industrial Area'],
  ['Danadams Pharmaceutical', 'Daniel Addo', '0244333003', 'supply@danadams.com', 'Tema, Greater Accra'],
  ['M&G Pharmaceuticals', 'Mavis Gyasi', '0244333004', 'orders@mgpharma.com', 'Accra, Greater Accra'],
  ['Intravenous Infusions Ltd', 'Isaac Koomson', '0244333005', 'sales@iil.com.gh', 'Koforidua, Eastern Region'],
  ['Tobinco Pharmaceuticals', 'Rita Tetteh', '0244333006', 'orders@tobinco.com', 'Accra, Greater Accra'],
  ['Entrance Pharmaceuticals', 'Samuel Nartey', '0244333007', 'supply@entrancepharma.com', 'Tema, Greater Accra'],
  ['Pharmanova Ltd', 'Linda Amoah', '0244333008', 'sales@pharmanova.com', 'Accra, Greater Accra'],
  ['Starwin Products', 'Yaw Mensah', '0244333009', 'orders@starwin.com.gh', 'Tema, Greater Accra'],
  ['LaGray Chemical Company', 'Naa Adjei', '0244333010', 'info@lagray.com', 'Nsawam, Eastern Region'],
];

const CUSTOMER_NAMES = [
  'Ama Serwaa', 'Kwame Asante', 'Esi Danso', 'Yaw Oduro', 'Akosua Frimpong',
  'Kofi Antwi', 'Abena Nyarko', 'Kojo Amankwah', 'Adwoa Mensah', 'Kwesi Appiah',
  'Afia Sarpong', 'Nana Yeboah',
];

async function makeDemoPrescriptionPdf() {
  const file = path.join(config.prescriptionsDir, 'seed-demo-prescription.pdf');
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);
  doc.fontSize(18).text('Shai-Osudoku Community Clinic', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).text('DEMO PRESCRIPTION - generated for the PharmaLink capstone demonstration.');
  doc.moveDown();
  doc.text('Patient: Ama Serwaa');
  doc.text('Date: 01/11/2026');
  doc.moveDown();
  doc.text('Rx:');
  doc.text('1. Coartem 20/120 mg - 1 tablet twice daily for 3 days');
  doc.text('2. Panadol 500 mg - 1 tablet three times daily for 3 days');
  doc.moveDown(2);
  doc.text('Dr. N. A. Owusu');
  doc.text('Medical Officer');
  doc.end();
  await finished(stream);
  return 'seed-demo-prescription.pdf';
}

async function seed() {
  console.log('[seed] migrating schema...');
  migrate();
  const db = getDb();

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    const tables = [
      'order_item_allocations', 'payments', 'deliveries', 'prescriptions', 'order_items', 'orders',
      'cart_items', 'carts', 'stock_adjustments', 'batches', 'purchase_order_items', 'purchase_orders',
      'refill_reminders', 'notifications', 'unmet_requests', 'data_requests', 'audit_log',
      'password_resets', 'pharmacy_medicines', 'suppliers', 'delivery_zones', 'users',
      'medicines', 'categories', 'pharmacies',
    ];
    for (const table of tables) db.exec(`DELETE FROM ${table}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name NOT IN ('schema_migrations')");
  })();
  db.pragma('foreign_keys = ON');

  console.log('[seed] hashing demo passwords...');
  const passwords = {
    admin: await hashPassword('Admin123!'),
    pharmacist: await hashPassword('Pharm123!'),
    rider: await hashPassword('Rider123!'),
    customer: await hashPassword('Customer123!'),
  };
  const demoPrescription = await makeDemoPrescriptionPdf();

  const insertPharmacy = db.prepare(
    `INSERT INTO pharmacies (name, community, address, landmark, phone, license_no) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const pharmacyIds = PHARMACIES.map((p) => insertPharmacy.run(...p).lastInsertRowid);

  const insertCategory = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
  const categoryIds = CATEGORIES.map((c) => insertCategory.run(c[0], c[1]).lastInsertRowid);

  const insertMedicine = db.prepare(
    `INSERT INTO medicines (brand_name, generic_name, strength, dosage_form, category_id,
      requires_prescription, description) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const medicineIds = MEDICINES.map((m) =>
    insertMedicine.run(m[0], m[1], m[2], m[3], categoryIds[m[4]], m[5], m[6]).lastInsertRowid
  );
  const medicineById = new Map(MEDICINES.map((m, i) => [medicineIds[i], { ...m, basePrice: m[7] }]));

  const insertSupplier = db.prepare(
    `INSERT INTO suppliers (pharmacy_id, name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const suppliersByPharmacy = new Map();
  for (const pid of pharmacyIds) {
    const list = [];
    for (let i = 0; i < 3; i += 1) {
      const s = SUPPLIER_NAMES[(pid * 3 + i) % SUPPLIER_NAMES.length];
      list.push(insertSupplier.run(pid, s[0], s[1], s[2], s[3], s[4]).lastInsertRowid);
    }
    suppliersByPharmacy.set(pid, list);
  }

  const insertZone = db.prepare('INSERT INTO delivery_zones (pharmacy_id, name, fee, rules) VALUES (?, ?, ?, ?)');
  const zonesByPharmacy = new Map();
  for (const pid of pharmacyIds) {
    const isDoryumu = pid <= 6;
    const zones = isDoryumu
      ? [
          ['Doryumu township', 10, 'Within 3 km of the pharmacy. Orders placed before 6:00 pm are delivered same day.'],
          ['Kordibe township', 22, 'Cross-community delivery, usually 30-45 minutes.'],
          ['Doryumu outskirts', 28, 'Areas beyond 5 km; rider will call before arrival.'],
        ]
      : [
          ['Kordibe township', 10, 'Within 3 km of the pharmacy. Orders placed before 6:00 pm are delivered same day.'],
          ['Doryumu township', 22, 'Cross-community delivery, usually 30-45 minutes.'],
          ['Kordibe outskirts', 18, 'Areas beyond 5 km; rider will call before arrival.'],
        ];
    zonesByPharmacy.set(pid, zones.map((z) => insertZone.run(pid, z[0], z[1], z[2]).lastInsertRowid));
  }

  const insertUser = db.prepare(
    `INSERT INTO users (role, full_name, phone, email, password_hash, pharmacy_id, community,
      delivery_address, digital_address_code, consent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  insertUser.run('admin', 'Kofi Mensah', '+233240000001', 'admin@pharmalink.gh', passwords.admin, null, 'Doryumu', 'Doryumu Central', 'GA-123-4567');
  const pharmacistIds = pharmacyIds.map((pid, i) => {
    const names = ['Akua Boateng', 'Yaw Darko', 'Efua Owusu', 'Kwabena Osei', 'Adjoa Badu', 'Kwame Tetteh', 'Ama Kudzo', 'Selorm Agbeko', 'Mawuli Attah', 'Doris Aidoo'];
    const phone = `+2332410000${String(i + 1).padStart(2, '0')}`;
    return insertUser.run('pharmacist', names[i], phone, `pharmacist${i + 1}@pharmalink.gh`, passwords.pharmacist, pid, pid <= 6 ? 'Doryumu' : 'Kordibe', null, null).lastInsertRowid;
  });

  const rider1 = insertUser.run('rider', 'Musah Adams', '+233242000001', 'rider1@pharmalink.gh', passwords.rider, pharmacyIds[0], 'Doryumu', 'Doryumu Lorry Station', 'GA-124-7788').lastInsertRowid;
  const rider2 = insertUser.run('rider', 'Comfort Torsu', '+233242000002', 'rider2@pharmalink.gh', passwords.rider, pharmacyIds[6], 'Kordibe', 'Kordibe Market Square', 'GA-125-8899').lastInsertRowid;
  const riderIds = [rider1, rider2];

  const customerIds = CUSTOMER_NAMES.map((name, i) => {
    const phone = `+2332430000${String(i + 1).padStart(2, '0')}`;
    const community = chance(0.6) ? 'Doryumu' : 'Kordibe';
    const address = community === 'Doryumu' ? `House ${int(1, 90)}, Doryumu New Town` : `House ${int(1, 90)}, Kordibe Central`;
    const digital = `GA-${int(100, 999)}-${int(1000, 9999)}`;
    return insertUser.run('customer', name, phone, `customer${i + 1}@example.com`, passwords.customer, null, community, address, digital).lastInsertRowid;
  });
  db.prepare('INSERT INTO carts (customer_id) SELECT id FROM users WHERE role = ?').run('customer');

  const insertPm = db.prepare(
    `INSERT INTO pharmacy_medicines (pharmacy_id, medicine_id, price, reorder_level, is_active) VALUES (?, ?, ?, ?, ?)`
  );
  const insertBatch = db.prepare(
    `INSERT INTO batches (pharmacy_id, medicine_id, batch_no, supplier_id, expiry_date,
      quantity_received, quantity_on_hand, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const today = new Date();
  const lowStockTargets = new Set();
  for (const pid of pharmacyIds) {
    for (let i = 0; i < 3; i += 1) lowStockTargets.add(`${pid}:${pick(medicineIds)}`);
  }

  for (const pid of pharmacyIds) {
    const suppliers = suppliersByPharmacy.get(pid);
    medicineIds.forEach((mid, idx) => {
      const base = MEDICINES[idx][7];
      const price = Math.round(base * (0.85 + rand() * 0.35) * 100) / 100;
      const reorder = int(10, 30);
      insertPm.run(pid, mid, price, reorder, chance(0.97) ? 1 : 0);

      const expired = chance(0.06);
      const nearExpiry = !expired && chance(0.1);
      const outOfStock = chance(0.03);
      const low = lowStockTargets.has(`${pid}:${mid}`) || chance(0.08);
      let qtyA;
      if (outOfStock) qtyA = 0;
      else if (low) qtyA = int(0, reorder);
      else qtyA = int(reorder + 15, 320);
      let expiryA;
      if (expired) expiryA = int(-200, -1);
      else if (nearExpiry) expiryA = int(5, 85);
      else expiryA = int(120, 780);
      const receivedA = addDays(today, -int(30, 240));
      insertBatch.run(pid, mid, `B${pid}-${mid}-A`, pick(suppliers), isoDate(addDays(today, expiryA)), qtyA + int(0, 30), qtyA, isoDateTime(receivedA));

      const qtyB = outOfStock ? 0 : int(0, 160);
      const expiryB = int(60, 900);
      insertBatch.run(pid, mid, `B${pid}-${mid}-B`, pick(suppliers), isoDate(addDays(today, expiryB)), qtyB + int(0, 20), qtyB, isoDateTime(addDays(today, -int(10, 150))));
    });
  }

  // ---- historical orders (3 months) ----
  const insertOrder = db.prepare(
    `INSERT INTO orders (reference, customer_id, guest_name, guest_phone, guest_email, consent_given_at,
      pharmacy_id, channel, fulfilment, delivery_zone_id,
      delivery_fee, delivery_address, digital_address_code, status, payment_status, subtotal, total,
      created_by, created_at, updated_at)
     VALUES (@reference, @customerId, @guestName, @guestPhone, @guestEmail, @consentGivenAt,
      @pharmacyId, @channel, @fulfilment, @zoneId, @fee,
      @address, @digital, @status, @paymentStatus, @subtotal, @total, @createdBy, @createdAt, @createdAt)`
  );
  const insertOrderItem = db.prepare(
    `INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, medicine_name_snapshot)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertAllocation = db.prepare(
    'INSERT INTO order_item_allocations (order_item_id, batch_id, quantity) VALUES (?, ?, ?)'
  );
  const insertPayment = db.prepare(
    `INSERT INTO payments (order_id, method, network, phone, reference, provider, status, amount, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'mock', ?, ?, ?, ?)`
  );
  const insertPrescription = db.prepare(
    `INSERT INTO prescriptions (order_id, customer_id, file_path, original_name, mime_type, status, reviewed_by, remarks, reviewed_at, created_at)
     VALUES (?, ?, ?, 'demo-prescription.pdf', 'application/pdf', 'approved', ?, 'Verified against the paper prescription.', ?, ?)`
  );
  const insertPendingPrescription = db.prepare(
    `INSERT INTO prescriptions (order_id, customer_id, file_path, original_name, mime_type, status, created_at)
     VALUES (?, ?, ?, 'demo-prescription.pdf', 'application/pdf', 'pending', ?)`
  );
  const insertDelivery = db.prepare(
    `INSERT INTO deliveries (order_id, rider_id, status, updated_at) VALUES (?, ?, ?, ?)`
  );
  const insertNotification = db.prepare(
    `INSERT INTO notifications (user_id, order_id, channel, event, recipient, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)`
  );

  const batchesByPharmacyMedicine = new Map();
  const batchStmt = db.prepare(
    `SELECT * FROM batches WHERE pharmacy_id = ? AND medicine_id = ? AND quantity_on_hand > 0
      AND expiry_date >= date('now') ORDER BY expiry_date ASC`
  );
  function batchesFor(pid, mid) {
    const key = `${pid}:${mid}`;
    if (!batchesByPharmacyMedicine.has(key)) batchesByPharmacyMedicine.set(key, batchStmt.all(pid, mid));
    return batchesByPharmacyMedicine.get(key);
  }
  function allocate(pid, mid, qty) {
    const allocations = [];
    let remaining = qty;
    for (const batch of batchesFor(pid, mid)) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity_on_hand, remaining);
      if (take <= 0) continue;
      batch.quantity_on_hand -= take;
      remaining -= take;
      allocations.push([batch.id, take]);
    }
    if (remaining > 0) return null;
    db.prepare('UPDATE batches SET quantity_on_hand = ? WHERE id = ?');
    for (const [batchId, qtyTaken] of allocations) {
      const batch = batchesFor(pid, mid).find((b) => b.id === batchId);
      db.prepare('UPDATE batches SET quantity_on_hand = ? WHERE id = ?').run(batch.quantity_on_hand, batchId);
    }
    return allocations;
  }

  const references = new Set();
  let orderCount = 0;
  for (const [pIndex, pid] of pharmacyIds.entries()) {
    const pharmacistId = pharmacistIds[pIndex];
    const zones = zonesByPharmacy.get(pid);
    const orderTotal = int(18, 26);
    for (let i = 0; i < orderTotal; i += 1) {
      const daysAgo = int(0, 89);
      const createdAt = new Date(Date.now() - daysAgo * DAY - int(0, 10) * 60 * 60 * 1000);
      const channel = chance(0.18) ? 'walk_in' : 'online';
      const customerId = channel === 'walk_in' ? null : pick(customerIds);
      const fulfilment = channel === 'walk_in' ? 'pickup' : chance(0.38) ? 'delivery' : 'pickup';
      const zoneId = fulfilment === 'delivery' ? pick(zones) : null;
      const fee = fulfilment === 'delivery' ? [10, 22, 28, 18][zones.indexOf(zoneId)] ?? 15 : 0;
      const customer = customerId
        ? db.prepare('SELECT delivery_address, digital_address_code FROM users WHERE id = ?').get(customerId)
        : null;

      const itemCount = int(1, 4);
      const chosen = new Set();
      while (chosen.size < itemCount) chosen.add(pick(medicineIds));
      const items = [];
      let subtotal = 0;
      for (const mid of chosen) {
        const qty = int(1, 3);
        const pm = db.prepare('SELECT price FROM pharmacy_medicines WHERE pharmacy_id = ? AND medicine_id = ?').get(pid, mid);
        if (!pm) continue;
        const available = batchesFor(pid, mid).reduce((sum, b) => sum + b.quantity_on_hand, 0);
        if (available < qty) continue;
        const allocations = allocate(pid, mid, qty);
        if (!allocations) continue;
        items.push({ mid, qty, price: pm.price, allocations, name: `${MEDICINES[medicineIds.indexOf(mid)][0]} ${MEDICINES[medicineIds.indexOf(mid)][2]}` });
        subtotal += qty * pm.price;
      }
      if (!items.length) continue;

      subtotal = Math.round(subtotal * 100) / 100;
      const total = Math.round((subtotal + fee) * 100) / 100;

      let status;
      if (daysAgo > 7) status = chance(0.93) ? 'completed' : 'cancelled';
      else {
        const roll = rand();
        if (roll < 0.55) status = 'completed';
        else if (roll < 0.7) status = 'ready';
        else if (roll < 0.8 && fulfilment === 'delivery') status = 'out_for_delivery';
        else if (roll < 0.9) status = 'verified';
        else status = daysAgo < 2 ? 'awaiting_prescription' : 'completed';
      }
      if (status === 'cancelled') {
        // Cancelled orders do not consume stock; restore what was tentatively allocated.
        for (const item of items) {
          for (const [batchId, qtyTaken] of item.allocations) {
            db.prepare('UPDATE batches SET quantity_on_hand = quantity_on_hand + ? WHERE id = ?').run(qtyTaken, batchId);
          }
        }
        for (const key of [...batchesByPharmacyMedicine.keys()]) {
          if (key.startsWith(`${pid}:`)) batchesByPharmacyMedicine.delete(key);
        }
      }

      let reference = orderReference(createdAt);
      while (references.has(reference)) reference = orderReference(createdAt);
      references.add(reference);

      const paymentMethod = chance(0.62) ? 'momo' : 'cash';
      const paymentStatus = status === 'cancelled' ? 'failed' : paymentMethod === 'cash' ? 'cash_on_pickup' : 'success';
      const customerPhone = customerId ? db.prepare('SELECT phone FROM users WHERE id = ?').get(customerId)?.phone : null;
      const info = insertOrder.run({
        reference,
        customerId,
        guestName: null,
        guestPhone: null,
        guestEmail: null,
        consentGivenAt: null,
        pharmacyId: pid,
        channel,
        fulfilment,
        zoneId,
        fee,
        address: fulfilment === 'delivery' ? customer?.delivery_address || 'Kordibe Market Square' : null,
        digital: fulfilment === 'delivery' ? customer?.digital_address_code || 'GA-125-7788' : null,
        status,
        paymentStatus,
        subtotal,
        total,
        createdBy: channel === 'walk_in' ? pharmacistId : customerId,
        createdAt: isoDateTime(createdAt),
      });
      const orderId = info.lastInsertRowid;

      const itemIds = [];
      for (const item of items) {
        const itemInfo = insertOrderItem.run(orderId, item.mid, item.qty, item.price, item.name);
        itemIds.push(itemInfo.lastInsertRowid);
        for (const [batchId, qtyTaken] of item.allocations) {
          insertAllocation.run(itemInfo.lastInsertRowid, batchId, qtyTaken);
        }
      }

      insertPayment.run(
        orderId,
        paymentMethod,
        paymentMethod === 'momo' ? pick(['MTN', 'Telecel', 'AT']) : null,
        customerPhone,
        `SEED-${orderId}-${int(1000, 9999)}`,
        status === 'cancelled' ? 'failed' : 'success',
        total,
        isoDateTime(createdAt),
        isoDateTime(createdAt)
      );

      const hasPom = items.some((item) => MEDICINES[medicineIds.indexOf(item.mid)][5] === 1);
      if (hasPom && channel === 'online') {
        insertPrescription.run(orderId, customerId, demoPrescription, pharmacistId, isoDateTime(createdAt), isoDateTime(createdAt));
      }
      if (fulfilment === 'delivery') {
        const rider = pid <= 6 ? rider1 : rider2;
        const deliveryStatus = status === 'completed' ? 'delivered' : status === 'out_for_delivery' ? 'out_for_delivery' : 'assigned';
        insertDelivery.run(orderId, rider, deliveryStatus, isoDateTime(createdAt));
      }
      if (customerId && chance(0.45)) {
        insertNotification.run(customerId, orderId, 'in_app', 'order_confirmation', null, `Order ${reference} received by the pharmacy.`, isoDateTime(createdAt));
      }
      orderCount += 1;
    }
  }

  // ---- pending prescriptions + orders for the pharmacist demo queue ----
  const pendingMedicineId = medicineIds[4]; // Coartem
  for (let i = 0; i < 4; i += 1) {
    const pid = pharmacyIds[i];
    const customerId = customerIds[i];
    const pm = db.prepare('SELECT price FROM pharmacy_medicines WHERE pharmacy_id = ? AND medicine_id = ?').get(pid, pendingMedicineId);
    const qty = 1;
    const subtotal = Math.round(pm.price * qty * 100) / 100;
    const createdAt = new Date(Date.now() - int(0, 2) * DAY);
    const reference = `PH-${createdAt.toISOString().slice(0, 10).replace(/-/g, '')}-P${String(i + 1).padStart(3, '0')}`;
    const info = insertOrder.run({
      reference, customerId, guestName: null, guestPhone: null, guestEmail: null, consentGivenAt: null,
      pharmacyId: pid, channel: 'online', fulfilment: 'pickup', zoneId: null,
      fee: 0, address: null, digital: null, status: 'awaiting_prescription',
      paymentStatus: 'success', subtotal, total: subtotal, createdBy: customerId,
      createdAt: isoDateTime(createdAt),
    });
    const itemInfo = insertOrderItem.run(info.lastInsertRowid, pendingMedicineId, qty, pm.price, 'Coartem 20/120 mg');
    // reserve the stock for the pending order using FEFO
    const allocations = allocate(pid, pendingMedicineId, qty);
    if (allocations) {
      for (const [batchId, qtyTaken] of allocations) insertAllocation.run(itemInfo.lastInsertRowid, batchId, qtyTaken);
    }
    insertPayment.run(info.lastInsertRowid, 'momo', 'MTN', db.prepare('SELECT phone FROM users WHERE id = ?').get(customerId).phone, `SEED-PENDING-${i + 1}`, 'success', subtotal, isoDateTime(createdAt), isoDateTime(createdAt));
    insertPendingPrescription.run(info.lastInsertRowid, customerId, demoPrescription, isoDateTime(createdAt));
  }

  // ---- guest orders placed without an account ----
  const guestOrders = [
    {
      pid: pharmacyIds[0],
      mid: medicineIds[0],
      qty: 2,
      name: 'Ama Mensah',
      phone: '+233244000001',
      email: null,
      status: 'placed',
      fulfilment: 'pickup',
      payment: 'cash',
      daysAgo: 1,
    },
    {
      pid: pharmacyIds[6],
      mid: medicineIds[1],
      qty: 1,
      name: 'Kojo Owusu',
      phone: '+233244000002',
      email: 'kojo.owusu@example.com',
      status: 'ready',
      fulfilment: 'delivery',
      payment: 'cash',
      daysAgo: 0,
    },
    {
      pid: pharmacyIds[2],
      mid: medicineIds[21],
      qty: 3,
      name: 'Efua Asare',
      phone: '+233244000003',
      email: null,
      status: 'completed',
      fulfilment: 'pickup',
      payment: 'momo',
      daysAgo: 6,
    },
    {
      pid: pharmacyIds[3],
      mid: medicineIds[4],
      qty: 1,
      name: 'Yaw Boateng',
      phone: '+233244000004',
      email: null,
      status: 'awaiting_prescription',
      fulfilment: 'pickup',
      payment: 'cash',
      daysAgo: 0,
      pom: true,
    },
  ];

  for (const [index, guest] of guestOrders.entries()) {
    const pm = db
      .prepare('SELECT price FROM pharmacy_medicines WHERE pharmacy_id = ? AND medicine_id = ?')
      .get(guest.pid, guest.mid);
    if (!pm) continue;
    const allocations = allocate(guest.pid, guest.mid, guest.qty);
    if (!allocations) continue;
    const createdAt = new Date(Date.now() - guest.daysAgo * DAY - int(1, 6) * 60 * 60 * 1000);
    const zoneId = guest.fulfilment === 'delivery' ? zonesByPharmacy.get(guest.pid)[0] : null;
    const fee = guest.fulfilment === 'delivery' ? 10 : 0;
    const subtotal = Math.round(pm.price * guest.qty * 100) / 100;
    const total = Math.round((subtotal + fee) * 100) / 100;
    let reference = orderReference(createdAt);
    while (references.has(reference)) reference = orderReference(createdAt);
    references.add(reference);

    const info = insertOrder.run({
      reference,
      customerId: null,
      guestName: guest.name,
      guestPhone: guest.phone,
      guestEmail: guest.email,
      consentGivenAt: isoDateTime(createdAt),
      pharmacyId: guest.pid,
      channel: 'online',
      fulfilment: guest.fulfilment,
      zoneId,
      fee,
      address: guest.fulfilment === 'delivery' ? `House ${int(1, 60)}, ${guest.pid <= 6 ? 'Kordibe' : 'Doryumu'} Central` : null,
      digital: guest.fulfilment === 'delivery' ? `GA-${int(100, 999)}-${int(1000, 9999)}` : null,
      status: guest.status,
      paymentStatus: guest.payment === 'cash' ? 'cash_on_pickup' : 'success',
      subtotal,
      total,
      createdBy: null,
      createdAt: isoDateTime(createdAt),
    });
    const orderId = info.lastInsertRowid;
    const itemInfo = insertOrderItem.run(
      orderId,
      guest.mid,
      guest.qty,
      pm.price,
      `${MEDICINES[medicineIds.indexOf(guest.mid)][0]} ${MEDICINES[medicineIds.indexOf(guest.mid)][2]}`
    );
    for (const [batchId, qtyTaken] of allocations) {
      insertAllocation.run(itemInfo.lastInsertRowid, batchId, qtyTaken);
    }
    insertPayment.run(
      orderId,
      guest.payment,
      guest.payment === 'momo' ? pick(['MTN', 'Telecel', 'AT']) : null,
      guest.phone,
      `SEED-GUEST-${index + 1}`,
      'success',
      total,
      isoDateTime(createdAt),
      isoDateTime(createdAt)
    );
    if (guest.fulfilment === 'delivery') {
      insertDelivery.run(orderId, guest.pid <= 6 ? rider1 : rider2, 'assigned', isoDateTime(createdAt));
    }
    if (guest.pom) {
      insertPendingPrescription.run(orderId, null, demoPrescription, isoDateTime(createdAt));
    }
    insertNotification.run(
      null,
      orderId,
      'sms',
      'order_confirmation',
      guest.phone,
      `Order ${reference} received by the pharmacy.`,
      isoDateTime(createdAt)
    );
  }

  // ---- purchase orders ----
  const insertPo = db.prepare(
    `INSERT INTO purchase_orders (pharmacy_id, supplier_id, status, created_by, created_at, received_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertPoItem = db.prepare(
    `INSERT INTO purchase_order_items (purchase_order_id, medicine_id, quantity_ordered, quantity_received, unit_cost)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const [pIndex, pid] of pharmacyIds.entries()) {
    const supplier = suppliersByPharmacy.get(pid)[0];
    const status = pIndex % 3 === 0 ? 'ordered' : pIndex % 3 === 1 ? 'draft' : 'received';
    const created = addDays(today, -int(5, 40));
    const poId = insertPo.run(pid, supplier, status, pharmacistIds[pIndex], isoDateTime(created), status === 'received' ? isoDateTime(addDays(created, 4)) : null).lastInsertRowid;
    for (let j = 0; j < 3; j += 1) {
      const mid = pick(medicineIds);
      const qty = int(20, 120);
      const cost = Math.round(MEDICINES[medicineIds.indexOf(mid)][7] * 0.7 * 100) / 100;
      insertPoItem.run(poId, mid, qty, status === 'received' ? qty : 0, cost);
    }
  }

  // ---- refill reminders, unmet demand, audit trail ----
  db.prepare(
    `INSERT INTO refill_reminders (user_id, medicine_id, interval_days, next_due_at, is_active)
     VALUES (?, ?, 30, ?, 1)`
  ).run(customerIds[0], medicineIds[13], isoDateTime(addDays(today, 5)));
  db.prepare(
    `INSERT INTO refill_reminders (user_id, medicine_id, interval_days, next_due_at, is_active)
     VALUES (?, ?, 30, ?, 1)`
  ).run(customerIds[0], medicineIds[15], isoDateTime(addDays(today, 12)));

  const unmetTerms = [
    'hydroxychloroquine', 'insulin pen needles', 'blood pressure monitor', 'oxygen cylinder',
    'warfarin 5mg', 'cough syrup for infants', 'hepatitis B vaccine', 'crutches',
    'nebuliser mask', 'glucose test strips', 'iron injection', 'anti-snake serum',
    'typhoid test kit', 'urine pregnancy strips', 'hearing aid batteries',
  ];
  for (const term of unmetTerms) {
    db.prepare('INSERT INTO unmet_requests (pharmacy_id, searched_term, community, created_at) VALUES (?, ?, ?, ?)')
      .run(chance(0.5) ? pick(pharmacyIds) : null, term, chance(0.6) ? 'Doryumu' : 'Kordibe', isoDateTime(addDays(today, -int(0, 80))));
  }

  const insertAudit = db.prepare(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, after_json, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertAudit.run(pharmacistIds[0], 'price_changed', 'pharmacy_medicine', medicineIds[0], JSON.stringify({ price: 6 }), '127.0.0.1', isoDateTime(addDays(today, -20)));
  insertAudit.run(pharmacistIds[1], 'stock_adjusted', 'batch', 1, JSON.stringify({ delta: -5, reason: 'Damaged pack' }), '127.0.0.1', isoDateTime(addDays(today, -14)));
  insertAudit.run(pharmacistIds[2], 'prescription_approved', 'prescription', 1, JSON.stringify({ status: 'approved' }), '127.0.0.1', isoDateTime(addDays(today, -9)));

  db.prepare(
    `INSERT INTO stock_adjustments (batch_id, delta, reason, user_id, created_at)
     SELECT id, -2, 'Damaged during shelving', ?, datetime('now', '-9 days') FROM batches LIMIT 1`
  ).run(pharmacistIds[0]);

  const counts = {
    pharmacies: pharmacyIds.length,
    medicines: medicineIds.length,
    users: 1 + pharmacistIds.length + riderIds.length + customerIds.length,
    orders: orderCount + 4 + guestOrders.length,
  };
  console.log(`[seed] done: ${counts.pharmacies} pharmacies, ${counts.medicines} medicines, ${counts.users} users, ${counts.orders} orders.`);
  console.log('[seed] demo logins (phone / password):');
  console.log('  admin       +233240000001 / Admin123!   (or admin@pharmalink.gh)');
  console.log('  pharmacist  +233241000001 / Pharm123!');
  console.log('  rider       +233242000001 / Rider123!');
  console.log('  customer    +233243000001 / Customer123!');
}

export { seed };

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] failed', err);
      process.exit(1);
    });
}
