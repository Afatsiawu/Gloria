import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../hooks/useApi.js';
import { Field } from './UI.jsx';

const STORAGE_KEY = 'staff_pharmacy_id';

export function useStaffPharmacy() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [pharmacyId, setPharmacyId] = useState(() => Number(localStorage.getItem(STORAGE_KEY)) || 1);
  useEffect(() => {
    if (isAdmin) localStorage.setItem(STORAGE_KEY, String(pharmacyId));
  }, [isAdmin, pharmacyId]);
  const change = useCallback((value) => setPharmacyId(Number(value) || 1), []);
  return {
    pharmacyId: isAdmin ? pharmacyId : user?.pharmacy_id,
    setPharmacyId: change,
    isAdmin,
    user,
  };
}

export default function PharmacyPicker({ pharmacyId, onChange, includeAll = false }) {
  const { data } = useFetch('/pharmacies');
  const pharmacies = data?.items || [];
  return (
    <Field label="Pharmacy" htmlFor="pharmacy-picker">
      <select id="pharmacy-picker" value={pharmacyId} onChange={(e) => onChange(Number(e.target.value))}>
        {includeAll && <option value="">All pharmacies</option>}
        {pharmacies.map((pharmacy) => (
          <option key={pharmacy.id} value={pharmacy.id}>
            {pharmacy.name} ({pharmacy.community})
          </option>
        ))}
      </select>
    </Field>
  );
}

export function PharmacyBar({ pharmacyId, onChange, includeAll = false }) {
  return (
    <div className="pharmacy-bar">
      <PharmacyPicker pharmacyId={pharmacyId} onChange={onChange} includeAll={includeAll} />
      <p className="hint">Administrator view: choose which outlet to manage.</p>
    </div>
  );
}
