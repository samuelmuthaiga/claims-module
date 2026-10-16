import { VendorRef } from './claim.types';

export interface VendorBank {
  accountName: string;
  bankName: string;
  accountNumber: string;
  paymentType: string;
}

const BANKS = ['Zenith Bank', 'GTBank', 'Access Bank', 'Stanbic IBTC', 'Equity Bank'];

/**
 * Vendor banking details are fetched from the vendor service once it is
 * integrated; until then they are derived deterministically from the vendor
 * id so the same vendor always shows the same (masked) account.
 */
export const vendorBank = (vendor: Pick<VendorRef, 'id' | 'name'>): VendorBank => {
  const seed = [...vendor.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return {
    accountName: vendor.name,
    bankName: BANKS[seed % BANKS.length]!,
    accountNumber: `******${String(1000 + (seed % 9000)).slice(-4)}`,
    paymentType: 'Bank Transfer',
  };
};
