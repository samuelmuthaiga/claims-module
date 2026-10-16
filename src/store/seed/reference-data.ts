import { CarRef, CountryRecord, CoverItem, CustomerRef, VendorRef } from '../../domain/claim.types';

export const COUNTRIES: CountryRecord[] = [
  { code: 'NG', name: 'Nigeria', currency: 'NGN', currencySymbol: '₦', exponent: 0, timezone: 'Africa/Lagos', callingCode: '+234' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', currencySymbol: 'GH₵', exponent: 2, timezone: 'Africa/Accra', callingCode: '+233' },
  { code: 'KE', name: 'Kenya', currency: 'KES', currencySymbol: 'KSh', exponent: 0, timezone: 'Africa/Nairobi', callingCode: '+254' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', currencySymbol: 'USh', exponent: 0, timezone: 'Africa/Kampala', callingCode: '+256' },
  { code: 'SN', name: 'Senegal', currency: 'XOF', currencySymbol: 'CFA', exponent: 0, timezone: 'Africa/Dakar', callingCode: '+221' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', currencySymbol: 'E£', exponent: 2, timezone: 'Africa/Cairo', callingCode: '+20' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', currencySymbol: 'MAD', exponent: 2, timezone: 'Africa/Casablanca', callingCode: '+212' },
  { code: 'CI', name: 'Ivory Coast', currency: 'XOF', currencySymbol: 'CFA', exponent: 0, timezone: 'Africa/Abidjan', callingCode: '+225' },
];

export const STATES: Record<string, { code: string; name: string; cities: { code: string; name: string }[] }[]> = {
  NG: [
    { code: 'LA', name: 'Lagos', cities: [{ code: 'IKJ', name: 'Ikeja' }, { code: 'LEK', name: 'Lekki' }, { code: 'VI', name: 'Victoria Island' }] },
    { code: 'FC', name: 'Abuja (FCT)', cities: [{ code: 'GAR', name: 'Garki' }, { code: 'WUS', name: 'Wuse' }] },
  ],
  KE: [{ code: 'NBO', name: 'Nairobi', cities: [{ code: 'WLD', name: 'Westlands' }, { code: 'KAR', name: 'Karen' }] }],
  GH: [{ code: 'GA', name: 'Greater Accra', cities: [{ code: 'ACC', name: 'Accra' }, { code: 'TEM', name: 'Tema' }] }],
};

export const VENDORS: VendorRef[] = [
  { id: 'v-101', name: 'Autochek Flagship Workshop Ikeja', country: 'NG', city: 'Ikeja', category: 'GENERAL', active: true },
  { id: 'v-102', name: 'Autochek Workshop Lekki', country: 'NG', city: 'Lekki', category: 'GENERAL', active: true },
  { id: 'v-103', name: 'Autochek Workshop Abuja', country: 'NG', city: 'Garki', category: 'BODY_WORK', active: true },
  { id: 'v-104', name: 'Olayinka Auto Repairs', country: 'NG', city: 'Ikeja', category: 'GENERAL', active: false },
  { id: 'v-201', name: 'Autochek Workshop Nairobi', country: 'KE', city: 'Westlands', category: 'GENERAL', active: true },
  { id: 'v-301', name: 'Autochek Workshop Accra', country: 'GH', city: 'Accra', category: 'GENERAL', active: true },
];

export const CUSTOMERS: CustomerRef[] = [
  { id: 'cust-882', name: 'Jane Doe', email: 'jane.doe@example.com', phone: '+2348012345678' },
  { id: 'cust-883', name: 'Chinedu Okafor', email: 'chinedu.okafor@example.com', phone: '+2348023456789' },
  { id: 'cust-884', name: 'Amina Bello', email: 'amina.bello@example.com', phone: '+2348034567890' },
  { id: 'cust-885', name: 'Peter Kamau', email: 'peter.kamau@example.com', phone: '+254712345678' },
  { id: 'cust-886', name: 'Kwame Mensah', email: 'kwame.mensah@example.com', phone: '+233201234567' },
  { id: 'cust-887', name: 'Ngozi Eze', email: 'ngozi.eze@example.com', phone: '+2348045678901' },
];

const car = (
  n: number, customerId: string, make: string, model: string, year: number,
  plateNumber: string, vin: string, price: number, currency: string,
): CarRef => ({
  id: `car-${n}`, loanId: `loan-${n}`, acquireId: `acq-${n}`, warrantyId: `warranty-${n}`,
  vin, plateNumber, make, model, year, price, currency, customerId,
});

export const CARS: CarRef[] = [
  car(991, 'cust-882', 'Toyota', 'Camry', 2021, 'KJA-123AA', '4T1B11HK5MU123456', 2_500_000, 'NGN'),
  car(992, 'cust-883', 'Honda', 'Accord', 2019, 'LSD-456BC', '1HGCV1F34KA765432', 2_100_000, 'NGN'),
  car(993, 'cust-884', 'Toyota', 'Corolla', 2020, 'ABC-789DE', '2T1BURHE0KC112233', 1_800_000, 'NGN'),
  car(994, 'cust-885', 'Mazda', 'CX-5', 2018, 'KDA 321X', 'JM3KFBCM1J0445566', 3_200_000, 'KES'),
  car(995, 'cust-886', 'Hyundai', 'Elantra', 2022, 'GR-4521-22', 'KMHD84LF2NU778899', 95_000, 'GHS'),
  car(996, 'cust-887', 'Kia', 'Sportage', 2017, 'EKY-654FG', 'KNDPB3AC5H7990011', 2_900_000, 'NGN'),
  car(997, 'cust-882', 'Lexus', 'RX 350', 2016, 'APP-987HJ', '2T2BK1BA0GC223344', 4_000_000, 'NGN'),
  car(998, 'cust-883', 'Nissan', 'Altima', 2020, 'MUS-111AB', '1N4AL3AP0LC100111', 2_300_000, 'NGN'),
  car(999, 'cust-884', 'Ford', 'Focus', 2018, 'LND-222CD', '1FADP3F20JL200222', 1_600_000, 'NGN'),
  car(1000, 'cust-887', 'Honda', 'Civic', 2021, 'ABJ-333EF', '2HGFC2F59MH300333', 2_700_000, 'NGN'),
  car(1001, 'cust-882', 'BMW', 'X5', 2019, 'KRD-444GH', '5UXCR6C05KLL40444', 6_500_000, 'NGN'),
  car(1002, 'cust-883', 'Mercedes-Benz', 'C300', 2018, 'EKY-555JK', 'WDDWF4KB5JR500555', 5_200_000, 'NGN'),
];

/** Plan cover limits per component (Claims UI `mockCoverBreakdown`). */
export const COVER_ITEMS: CoverItem[] = [
  ['Air Conditioner', 350_000], ['Alarm Immobiliser', 170_000], ['Braking System', 350_000],
  ['CV Joints', 350_000], ['Cambelt Failure', 350_000], ['Central Locking', 270_000],
  ['Clutch', 350_000], ['Cooling System', 350_000], ['Differential', 830_000],
  ['Differential Lock', 640_000], ['Drive Shafts', 420_000], ['ECU', 690_000],
  ['Electrical System', 380_000], ['Engine', 1_250_000], ['Exhaust System', 240_000],
  ['Fuel System', 410_000], ['Gearbox (Automatic)', 1_150_000], ['Gearbox (Manual)', 980_000],
  ['Head Gasket', 520_000], ['Ignition System', 260_000], ['Instrument Cluster', 310_000],
  ['Power Steering', 430_000], ['Propshaft', 380_000], ['Radiator', 290_000],
  ['Starter Motor', 220_000], ['Steering Rack', 470_000], ['Suspension', 560_000],
  ['Timing Chain', 480_000], ['Transfer Box', 720_000], ['Turbocharger', 890_000],
  ['Water Pump', 210_000], ['Wheel Bearings', 180_000], ['Windscreen Motors', 150_000],
  ['Wiring Harness', 340_000],
].map(([item, limit], index) => ({ id: index + 1, item: item as string, limit: limit as number }));
