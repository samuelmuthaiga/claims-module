import { round2 } from './claim.constants';
import { QuoteLineItem, QuoteRecord } from './claim.types';
import type { MockDataStore } from '../store/mock-data.store';

export interface CoverLine {
  id: number;
  item: string;
  limit: number;
  used: number;
  remaining: number;
}

/** Plan component a repair category is claimed against when the line does not name one. */
const CATEGORY_COVER_ITEM: Record<string, string> = {
  TRANSMISSION: 'Gearbox (Automatic)',
  ENGINE: 'Engine',
  BRAKING: 'Braking System',
  SUSPENSION: 'Suspension',
  ELECTRICAL: 'Electrical System',
  LIGHTING: 'Electrical System',
  COOLING: 'Cooling System',
};

export const coverItemOf = (line: Pick<QuoteLineItem, 'coverItem' | 'categoryCode'>): string | undefined =>
  line.coverItem ?? (line.categoryCode ? CATEGORY_COVER_ITEM[line.categoryCode] : undefined);

/** Quotes that count against a car's plan cover (everything not declined). */
const countable = (store: MockDataStore, carId: string): QuoteRecord[] => {
  const claimIds = new Set(store.claims.filter((c) => c.car.id === carId).map((c) => c.id));
  return store.quotes.filter((q) => claimIds.has(q.claimId) && q.status !== 'DECLINED');
};

export const coverUsage = (store: MockDataStore, carId: string): Map<string, number> => {
  const used = new Map<string, number>();
  for (const quote of countable(store, carId)) {
    for (const line of quote.lineItems) {
      const item = coverItemOf(line);
      if (item) used.set(item, round2((used.get(item) ?? 0) + line.amount));
    }
  }
  return used;
};

export const coverBreakdown = (store: MockDataStore, carId: string) => {
  const used = coverUsage(store, carId);
  const items: CoverLine[] = store.coverItems.map((entry) => {
    const spent = used.get(entry.item) ?? 0;
    return { id: entry.id, item: entry.item, limit: entry.limit, used: spent, remaining: Math.max(entry.limit - spent, 0) };
  });
  const totalLimit = items.reduce((sum, i) => sum + i.limit, 0);
  const totalUsed = items.reduce((sum, i) => sum + i.used, 0);
  return { totalLimit, totalUsed, totalRemaining: Math.max(totalLimit - totalUsed, 0), items };
};

export const warrantyCap = (vehiclePrice: number, used: number, capPercentage: number) => {
  const capLimit = round2((vehiclePrice * capPercentage) / 100);
  return {
    vehiclePrice,
    capPercentage,
    capLimit,
    used,
    remaining: Math.max(round2(capLimit - used), 0),
    eligible: used < capLimit,
    percentUsed: capLimit ? round2((used / capLimit) * 100) : 0,
  };
};
