import type { ClaimsSettings } from '../modules/configs/types/config.types';
import type { MockDataStore } from '../store/mock-data.store';

export interface Eligibility {
  eligible: boolean;
  reason: string | null;
}

export type CarEligibility = Record<'warranty' | 'repairs' | 'insurance', Eligibility>;

/** Cars with an active insurance policy. Replaced by the policy lookup once that upstream is wired. */
const INSURED_CAR_IDS = ['car-991', 'car-992', 'car-993', 'car-996'];

/**
 * Whether a car can open each claim type. Warranty depends on cap headroom,
 * insurance on an active policy. Upstream (loan/contract) checks plug in here.
 */
export const carEligibility = (store: MockDataStore, settings: ClaimsSettings, carId: string): CarEligibility => {
  const car = store.cars.find((c) => c.id === carId);
  const capLimit = car ? (car.price * settings.warrantyCapPercentage) / 100 : 0;
  const capUsed = Math.max(0, ...store.claims.filter((c) => c.car.id === carId).map((c) => c.warrantyCapUsedAmount));

  return {
    warranty:
      capLimit > 0 && capUsed >= capLimit
        ? { eligible: false, reason: 'Warranty cap has been fully used' }
        : { eligible: true, reason: null },
    repairs: { eligible: true, reason: null },
    insurance: INSURED_CAR_IDS.includes(carId)
      ? { eligible: true, reason: null }
      : { eligible: false, reason: 'No active insurance policy' },
  };
};
