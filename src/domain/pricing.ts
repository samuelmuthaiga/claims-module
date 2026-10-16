import { round2 } from './claim.constants';
import type { MockDataStore } from '../store/mock-data.store';

export interface PriceCheck {
  withinCatalog: boolean | null;
  catalogPrice: number | null;
  variance: number | null;
  variancePercent: number | null;
}

/** Tolerance before a quoted unit price is flagged against the last approved price. */
const TOLERANCE_PERCENT = 10;

/**
 * Benchmarks a quoted unit price against the most recent approved price for
 * the same part in the same country (the parts-pricing history).
 */
export const priceCheck = (
  store: MockDataStore,
  partName: string,
  unitAmount: number,
  country: string,
): PriceCheck => {
  const match = store.parts
    .filter((p) => p.partName.toLowerCase() === partName.toLowerCase() && p.country === country)
    .sort((a, b) => b.approvedDate.localeCompare(a.approvedDate))[0];
  if (!match) return { withinCatalog: null, catalogPrice: null, variance: null, variancePercent: null };

  const variance = round2(unitAmount - match.approvedPrice);
  const variancePercent = round2((variance / match.approvedPrice) * 100);
  return {
    withinCatalog: Math.abs(variancePercent) <= TOLERANCE_PERCENT,
    catalogPrice: match.approvedPrice,
    variance,
    variancePercent,
  };
};
