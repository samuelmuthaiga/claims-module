import {
  ApprovalRecord, CarRef, ClaimRecord, ClaimStatusCode, ClaimType,
  FileRef, PartPriceRecord, PaymentRecord, QuoteLineItem, QuoteRecord, WarrantyType,
} from '../../domain/claim.types';
import { CLAIM_STATUS_LABELS, round2 } from '../../domain/claim.constants';
import type { MockDataStore } from '../mock-data.store';
import { CARS, COUNTRIES, COVER_ITEMS, CUSTOMERS, VENDORS } from './reference-data';

const DAY = 86_400_000;
const daysAgo = (days: number): string => new Date(Date.now() - days * DAY).toISOString();
const plusHours = (iso: string, hours: number): string =>
  new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();

const file = (name: string): FileRef => ({
  fileId: `file-${name.replace(/\W+/g, '-').toLowerCase()}`,
  name,
  url: `https://files.claims.autochek.africa/mock/${encodeURIComponent(name)}`,
});

type Item = [desc: string, spec: string, brand: string, cond: string, qty: number, unit: number, cat: string, cover: string];
const lineItems = (rows: Item[]): QuoteLineItem[] =>
  rows.map(([description, spec, brand, condition, quantity, unitAmount, categoryCode, coverItem], i) => ({
    lineNo: i + 1, description, spec, brand, condition, quantity, unitAmount,
    amount: round2(quantity * unitAmount), categoryCode, coverItem,
  }));

interface ClaimSeed {
  id: number;
  type: ClaimType;
  warrantyType?: WarrantyType;
  status: ClaimStatusCode;
  car: string;
  vendor?: string;
  age: number;
  issueSubType: string;
  issueTypes: string[];
  odometer: number;
  capUsed?: number;
  repairFinanced?: boolean;
  quote?: { invoice: string; upfront: number; items: Item[] };
  cancelledFrom?: ClaimStatusCode;
  details: string;
}

const CLAIMS: ClaimSeed[] = [
  { id: 1024, type: 'WARRANTY', warrantyType: 'LOAN_WARRANTY', status: 'DIAGNOSIS_IN_PROGRESS', car: 'car-991', vendor: 'v-101', age: 9, issueSubType: 'Gear Slippage', issueTypes: ['TRANSMISSION'], odometer: 45000, capUsed: 300_000, details: 'Customer reported harsh gear shifts during acceleration' },
  { id: 1025, type: 'REPAIRS', status: 'JOB_ORDER_CREATED', car: 'car-992', age: 1, issueSubType: 'Awaiting Customer Form', issueTypes: [], odometer: 0, details: 'Brakes squeal when stopping, vibration through the pedal' },
  { id: 1026, type: 'INSURANCE', status: 'CUSTOMER_SUBMITTED_FORM', car: 'car-993', vendor: 'v-102', age: 3, issueSubType: 'Accident Damage', issueTypes: ['BODY'], odometer: 38000, details: 'Rear-ended at a junction, boot and bumper damaged' },
  { id: 1027, type: 'WARRANTY', warrantyType: 'CASH_WARRANTY', status: 'PENDING_APPROVAL', car: 'car-996', vendor: 'v-101', age: 5, issueSubType: 'AC Compressor', issueTypes: ['ELECTRICAL'], odometer: 61000, details: 'Air conditioning blows warm air after 10 minutes' },
  { id: 1028, type: 'REPAIRS', status: 'QUOTE_IN_REVIEW', car: 'car-997', vendor: 'v-102', age: 8, issueSubType: 'Suspension', issueTypes: ['SUSPENSION'], odometer: 72000, details: 'Knocking noise over speed bumps', quote: { invoice: 'INV-88301', upfront: 74_000, items: [['Front Shock Absorber', 'Pair', 'Monroe', 'NEW', 2, 52_000, 'SUSPENSION', 'Suspension'], ['Stabiliser Link', 'Front left/right', 'Moog', 'NEW', 2, 9_500, 'SUSPENSION', 'Suspension'], ['Labour', '4 hours', 'Workshop', 'NEW', 4, 15_500, 'LABOUR', 'Suspension']] } },
  { id: 1029, type: 'WARRANTY', warrantyType: 'LOAN_WARRANTY', status: 'QUOTE_SUBMITTED', car: 'car-994', vendor: 'v-201', age: 7, issueSubType: 'Engine Fault', issueTypes: ['ENGINE'], odometer: 58000, capUsed: 120_000, details: 'Engine misfires and check-engine light on', quote: { invoice: 'INV-88310', upfront: 96_000, items: [['Ignition Coil Set', '4 piece', 'Denso', 'NEW', 1, 120_000, 'ENGINE', 'Ignition System'], ['Spark Plugs', 'Iridium', 'NGK', 'NEW', 4, 18_000, 'ENGINE', 'Ignition System'], ['Labour', '3 hours', 'Workshop', 'NEW', 3, 16_000, 'LABOUR', 'Engine']] } },
  { id: 1030, type: 'REPAIRS', status: 'REPAIR_ONGOING', car: 'car-995', vendor: 'v-301', age: 10, issueSubType: 'Brakes', issueTypes: ['BRAKING'], odometer: 33000, details: 'Grinding noise from front brakes', quote: { invoice: 'INV-88320', upfront: 4_800, items: [['Front Brake Pads', 'Ceramic', 'Bosch', 'NEW', 1, 5_500, 'BRAKING', 'Braking System'], ['Brake Disc', 'Front pair', 'Brembo', 'NEW', 1, 4_500, 'BRAKING', 'Braking System'], ['Labour', '2 hours', 'Workshop', 'NEW', 2, 1_000, 'LABOUR', 'Braking System']] } },
  { id: 1031, type: 'WARRANTY', warrantyType: 'LOAN_WARRANTY', status: 'QUALITY_CONTROL', car: 'car-993', vendor: 'v-102', age: 14, issueSubType: 'Transmission Fault', issueTypes: ['TRANSMISSION'], odometer: 52000, capUsed: 90_000, details: 'Delayed engagement when shifting to drive', quote: { invoice: 'INV-88330', upfront: 124_000, items: [['Transmission Fluid Flush', 'ATF Type IV', 'Toyota Genuine', 'NEW', 1, 50_000, 'TRANSMISSION', 'Gearbox (Automatic)'], ['Clutch Pack Replacement', 'Complete kit', 'Toyota Genuine', 'NEW', 1, 220_000, 'TRANSMISSION', 'Gearbox (Automatic)'], ['Labour', '5 hours', 'Workshop', 'NEW', 5, 8_000, 'LABOUR', 'Gearbox (Automatic)']] } },
  { id: 1032, type: 'REPAIRS', status: 'VEHICLE_READY', car: 'car-996', vendor: 'v-103', age: 18, issueSubType: 'Body Work', issueTypes: ['BODY'], odometer: 64000, details: 'Dented rear door and scratched bumper', quote: { invoice: 'INV-88340', upfront: 38_000, items: [['Rear Door Panel Repair', 'Dent + respray', 'Workshop', 'NEW', 1, 60_000, 'BODY', 'Suspension'], ['Bumper Respray', 'Rear', 'Workshop', 'NEW', 1, 35_000, 'BODY', 'Suspension']] } },
  { id: 1033, type: 'INSURANCE', status: 'VEHICLE_DELIVERED', car: 'car-991', vendor: 'v-101', age: 30, issueSubType: 'Accident Damage', issueTypes: ['BODY'], odometer: 41000, details: 'Collision damage to front end', quote: { invoice: 'INV-88100', upfront: 180_000, items: [['Front Bumper Assembly', 'OEM', 'Toyota Genuine', 'NEW', 1, 250_000, 'BODY', 'Suspension'], ['Headlamp Unit', 'Left', 'Toyota Genuine', 'NEW', 1, 120_000, 'LIGHTING', 'Electrical System'], ['Labour', '10 hours', 'Workshop', 'NEW', 10, 8_000, 'LABOUR', 'Suspension']] } },
  { id: 1034, type: 'REPAIRS', status: 'CANCELLED', car: 'car-991', vendor: 'v-101', age: 20, issueSubType: 'Electrical', issueTypes: ['ELECTRICAL'], odometer: 40000, cancelledFrom: 'DIAGNOSIS_IN_PROGRESS', details: 'Intermittent dashboard warning lights' },
];

const needsSplit = (seed: ClaimSeed): boolean =>
  seed.type === 'WARRANTY' || Boolean(seed.repairFinanced);

/** Statuses a claim passes through to reach `target`, mirroring the workflow rail. */
const pathTo = (seed: ClaimSeed, target: ClaimStatusCode): ClaimStatusCode[] => {
  const review: ClaimStatusCode = seed.type === 'INSURANCE' ? 'QUOTATION_REVIEW_WITH_INSURANCE' : 'QUOTE_IN_REVIEW';
  const rail: ClaimStatusCode[] = [
    'JOB_ORDER_CREATED', 'CUSTOMER_SUBMITTED_FORM', 'PENDING_APPROVAL', 'DIAGNOSIS_IN_PROGRESS',
    ...(needsSplit(seed) ? (['QUOTE_SUBMITTED'] as ClaimStatusCode[]) : []),
    review, 'REPAIR_ONGOING', 'QUALITY_CONTROL', 'VEHICLE_READY', 'VEHICLE_DELIVERED',
  ];
  return rail.slice(0, rail.indexOf(target) + 1);
};

const EVENTS: Partial<Record<ClaimStatusCode, [event: string, channel: 'Email' | 'WhatsApp' | 'System' | 'Public', action: string]>> = {
  JOB_ORDER_CREATED: ['Job order created', 'System', 'create_claim'],
  CUSTOMER_SUBMITTED_FORM: ['Customer submitted scheduling form', 'Public', 'submit_schedule_form'],
  PENDING_APPROVAL: ['Diagnosis approval requested', 'System', 'request_diagnosis_approval'],
  DIAGNOSIS_IN_PROGRESS: ['Diagnosis approved', 'System', 'approve_diagnosis'],
  QUOTE_SUBMITTED: ['Repair quote uploaded', 'System', 'upload_quote'],
  QUOTE_IN_REVIEW: ['Quote sent for review', 'System', 'upload_quote'],
  QUOTATION_REVIEW_WITH_INSURANCE: ['Quote sent for insurer review', 'System', 'upload_quote'],
  REPAIR_ONGOING: ['Quote approved', 'System', 'approve_quote'],
  QUALITY_CONTROL: ['Repair marked complete', 'System', 'complete_repair'],
  VEHICLE_READY: ['QC passed', 'System', 'approve_qa'],
  VEHICLE_DELIVERED: ['Vehicle picked up', 'System', 'complete_pickup'],
  CANCELLED: ['Claim cancelled', 'System', 'cancel_claim'],
};

const APPROVER = { id: 'user-207', name: 'Admin User' };
const OFFICER = { id: 'user-101', name: 'John Doe' };

export function seedStore(store: MockDataStore): void {
  store.countries = COUNTRIES.map((c) => ({ ...c }));
  store.vendors = VENDORS.map((v) => ({ ...v }));
  store.customers = CUSTOMERS.map((c) => ({ ...c }));
  store.cars = CARS.map((c) => ({ ...c }));
  store.coverItems = COVER_ITEMS.map((c) => ({ ...c }));

  const carOf = (id: string): CarRef => store.cars.find((c) => c.id === id)!;

  for (const seed of CLAIMS) {
    const car = carOf(seed.car);
    const customer = store.customers.find((c) => c.id === car.customerId)!;
    const vendor = store.vendors.find((v) => v.id === seed.vendor);
    const country = vendor?.country ?? store.countries.find((c) => c.currency === car.currency)?.code ?? 'NG';
    const createdAt = daysAgo(seed.age);
    const effective = seed.status === 'CANCELLED' ? seed.cancelledFrom! : seed.status;
    const path = pathTo(seed, effective);
    const lastAt = plusHours(createdAt, path.length * 9);
    const items = seed.quote ? lineItems(seed.quote.items) : [];
    const total = round2(items.reduce((sum, item) => sum + item.amount, 0));
    const pastQuote = path.includes('REPAIR_ONGOING');
    const split = pastQuote || seed.status === 'QUOTE_IN_REVIEW'
      ? { customer: round2(total * 0.2), autochek: round2(total * 0.8), insurance: 0, repairFinancing: 0 }
      : { customer: 0, autochek: 0, insurance: 0, repairFinancing: 0 };
    if (seed.type === 'INSURANCE' && total) {
      split.customer = 0; split.autochek = round2(total * 0.1); split.insurance = round2(total - split.autochek);
    }

    const claim: ClaimRecord = {
      id: seed.id,
      reference: `CLM-${country}-2026-${String(seed.id).padStart(6, '0')}`,
      jobOrderNumber: `JO-${country}-2026-${String(seed.id).padStart(6, '0')}`,
      claimType: seed.type,
      warrantyType: seed.warrantyType,
      status: seed.status,
      country,
      currency: car.currency,
      requestDate: createdAt,
      claimsDate: createdAt,
      appointmentDate: path.includes('CUSTOMER_SUBMITTED_FORM') ? plusHours(createdAt, 48) : undefined,
      customer, car, vendor,
      issueSubType: seed.issueSubType,
      issueTypes: seed.issueTypes,
      odometer: seed.odometer,
      ppiHighlighted: seed.id % 2 === 0,
      insuranceClaim: seed.type === 'INSURANCE',
      trackerStatus: seed.id % 3 === 0 ? 'Inactive' : 'Active',
      repairFinanced: Boolean(seed.repairFinanced),
      initialDetails: seed.details,
      requestChannel: seed.id % 2 ? 'PHONE_CALL' : 'EMAIL',
      supportingDocument: path.length > 1 ? file(`evidence-${seed.id}.jpg`) : undefined,
      diagnosisReport: items.length ? file(`diagnosis-${seed.id}.pdf`) : undefined,
      scanReport: items.length ? file(`scan-${seed.id}.pdf`) : undefined,
      diagnosisNotes: items.length ? 'Fault confirmed on strip-down; parts required as itemised.' : undefined,
      upfrontAmount: seed.quote?.upfront,
      totalAmount: items.length ? total : undefined,
      paymentSplit: split,
      warrantyCapUsedAmount: seed.capUsed ?? 0,
      intelligence: {
        amcDone: 2, expectedAmc: 4, coverStartDate: daysAgo(240),
        operationalStatus: 'Compliant', ifrsStatus: 'Recognized',
      },
      scheduling: path.includes('CUSTOMER_SUBMITTED_FORM')
        ? {
            repairType: seed.type, repairCategory: seed.issueTypes[0] ?? 'GENERAL',
            preferredWorkshop: vendor?.name ?? '', appointmentDate: plusHours(createdAt, 48),
            submittedAt: plusHours(createdAt, 5), confirmationRef: `SCH-${country}-2026-${String(seed.id).padStart(6, '0')}`,
          }
        : undefined,
      scheduleToken: seed.id === 1025 ? 'demo-schedule-1025' : `sched-${seed.id}-${Math.random().toString(36).slice(2, 12)}`,
      scheduleTokenExpiresAt: plusHours(createdAt, 48 * (seed.id === 1025 ? 100 : 1)),
      scheduleTokenUsedAt: path.includes('CUSTOMER_SUBMITTED_FORM') ? plusHours(createdAt, 5) : undefined,
      scheduleResends: [],
      needsTypeConfirmation: seed.id === 1025,
      cancelledAt: seed.status === 'CANCELLED' ? lastAt : undefined,
      cancelledBy: seed.status === 'CANCELLED' ? OFFICER.id : undefined,
      cancelledReason: seed.status === 'CANCELLED' ? 'Customer requested cancellation' : undefined,
      version: path.length + 1,
      createdAt, updatedAt: lastAt, createdBy: OFFICER.id, updatedBy: OFFICER.id,
    };
    if (seed.status === 'CANCELLED') path.push('CANCELLED');
    store.claims.push(claim);

    // History, timeline and audit trail for every step the claim has taken.
    path.forEach((status, i) => {
      const at = plusHours(createdAt, i * 9);
      const [event, channel, action] = EVENTS[status]!;
      const actor = status === 'CUSTOMER_SUBMITTED_FORM' ? { id: customer.id, name: customer.name, role: 'Customer' } : { ...OFFICER, role: 'CLAIMS_OFFICER' };
      store.history.push({
        id: store.nextId('history'), claimId: claim.id, fromStatus: i ? path[i - 1]! : null, toStatus: status,
        action, actorId: actor.id, actorRole: actor.role, reason: status === 'CANCELLED' ? claim.cancelledReason! : null, occurredAt: at,
      });
      store.timeline.push({
        id: store.nextId('timeline'), claimId: claim.id, event, channel,
        message: `${event} — ${CLAIM_STATUS_LABELS[status]}`, timestamp: at, actor,
      });
      store.appendAudit({
        timestamp: at, actorId: actor.id, actorName: actor.name, actorRole: actor.role, actorIp: '197.210.45.12',
        module: 'CLAIMS', action: action.toUpperCase(), entityType: 'claim', entityId: String(claim.id), claimId: claim.id,
        severity: status === 'CANCELLED' ? 'WARNING' : 'INFO', details: `${event} on ${claim.reference}`,
        after: { status },
      });
    });

    store.documents.push({
      id: store.nextId('document'), claimId: claim.id, documentType: 'JOB_ORDER', fileId: `file-jo-${claim.id}`,
      fileName: `job_order_${claim.id}.pdf`, url: file(`job_order_${claim.id}.pdf`).url, uploadedAt: createdAt, uploadedBy: OFFICER.id,
    });

    // Quote, line items and the approvals that decided it.
    if (seed.quote && !(seed.status === 'CANCELLED')) {
      const decided = pastQuote;
      const quote: QuoteRecord = {
        id: store.nextId('quote'), claimId: claim.id, revision: 1, kind: 'INITIAL',
        status: decided ? 'APPROVED' : 'SUBMITTED', invoiceNumber: seed.quote.invoice,
        upfrontAmount: seed.quote.upfront, totalAmount: total, currency: car.currency, lineItems: items,
        diagnosisReport: claim.diagnosisReport!, scanReport: claim.scanReport!, invoice: file(`${seed.quote.invoice}.pdf`),
        issueTypes: seed.issueTypes, diagnosisNotes: claim.diagnosisNotes, vendorId: vendor!.id,
        submittedAt: plusHours(createdAt, 36), submittedBy: OFFICER.id,
      };
      store.quotes.push(quote);
      claim.quoteId = quote.id;
      for (const [docType, ref] of [['DIAGNOSIS_REPORT', quote.diagnosisReport], ['SCAN_REPORT', quote.scanReport], ['INVOICE', quote.invoice]] as const) {
        store.documents.push({ id: store.nextId('document'), claimId: claim.id, documentType: docType, fileId: ref.fileId!, fileName: ref.name, url: ref.url, uploadedAt: quote.submittedAt, uploadedBy: OFFICER.id });
      }
      if (decided) {
        for (const item of items) {
          const part: PartPriceRecord = {
            id: store.nextId('part'), partName: item.description, workshop: vendor!.name, vendorId: vendor!.id,
            approvedPrice: item.unitAmount, currency: car.currency, country, carLabel: `${car.make} ${car.model} ${car.year}`,
            make: car.make, model: car.model, category: item.categoryCode, approvedDate: plusHours(createdAt, 54), claimId: claim.id,
          };
          if (item.categoryCode !== 'LABOUR') store.parts.push(part);
        }
      }
    }

    const approval = (partial: Omit<ApprovalRecord, 'id' | 'version' | 'submittedBy' | 'submittedByName' | 'submittedAt' | 'overdueAt'> & { at: string }): ApprovalRecord => {
      const { at, ...rest } = partial;
      const record: ApprovalRecord = {
        ...rest, id: store.nextId('approval'), submittedBy: OFFICER.id, submittedByName: OFFICER.name,
        submittedAt: at, overdueAt: plusHours(at, 48), version: 1,
      };
      store.approvals.push(record);
      return record;
    };
    const decide = (type: 'DIAGNOSIS' | 'QUOTE' | 'QA_SIGNOFF', subjectId: number, label: string, at: string, amount?: number) =>
      approval({
        type, status: 'APPROVED', claimId: claim.id, subjectId, subjectLabel: label, at, amount, currency: car.currency,
        decidedBy: APPROVER.id, decidedByName: APPROVER.name, decidedAt: plusHours(at, 6), decisionReason: 'Approved',
      });

    const reached = (status: ClaimStatusCode) => path.includes(status);
    if (reached('DIAGNOSIS_IN_PROGRESS')) decide('DIAGNOSIS', claim.id, `Diagnosis for ${claim.reference}`, plusHours(createdAt, 18));
    if (seed.status === 'PENDING_APPROVAL') {
      approval({ type: 'DIAGNOSIS', status: 'PENDING', claimId: claim.id, subjectId: claim.id, subjectLabel: `Diagnosis for ${claim.reference}`, at: plusHours(createdAt, 18), workshopProof: file(`workshop-proof-${claim.id}.jpg`) });
    }
    if (claim.quoteId) {
      const q = store.quotes.find((x) => x.id === claim.quoteId)!;
      if (pastQuote) decide('QUOTE', q.id, `Quote ${q.invoiceNumber}`, plusHours(createdAt, 36), q.totalAmount);
      else if (seed.status === 'QUOTE_IN_REVIEW' || seed.status === 'QUOTATION_REVIEW_WITH_INSURANCE') {
        approval({ type: 'QUOTE', status: 'PENDING', claimId: claim.id, subjectId: q.id, subjectLabel: `Quote ${q.invoiceNumber}`, at: plusHours(createdAt, 40), amount: q.totalAmount, currency: car.currency });
      }
    }
    if (reached('VEHICLE_READY')) {
      claim.qa = { inspectionId: store.nextId('inspection'), state: 'PASSED', round: 1, failedItemCount: 0, assignedInspector: 'inspector-123', slaDueAt: plusHours(createdAt, 100) };
      decide('QA_SIGNOFF', claim.qa.inspectionId, `QC for ${claim.reference}`, plusHours(createdAt, 80));
    } else if (seed.status === 'QUALITY_CONTROL') {
      claim.qa = { inspectionId: store.nextId('inspection'), state: 'ASSIGNED', round: 1, failedItemCount: 0, assignedInspector: 'inspector-123', slaDueAt: plusHours(createdAt, 130) };
      claim.repairCompletionProof = { file: file(`repair-done-${claim.id}.jpg`), submittedAt: plusHours(createdAt, 70) };
      approval({ type: 'QA_SIGNOFF', status: 'PENDING', claimId: claim.id, subjectId: claim.qa.inspectionId, subjectLabel: `QC for ${claim.reference}`, at: plusHours(createdAt, 70) });
    }
    if (reached('VEHICLE_READY') && !claim.repairCompletionProof) claim.repairCompletionProof = { file: file(`repair-done-${claim.id}.jpg`), submittedAt: plusHours(createdAt, 70) };
    if (seed.status === 'VEHICLE_DELIVERED') claim.pickupProof = { file: file(`pickup-${claim.id}.jpg`), submittedAt: lastAt };
    if (claim.repairCompletionProof) {
      const f = claim.repairCompletionProof.file;
      store.documents.push({ id: store.nextId('document'), claimId: claim.id, documentType: 'REPAIR_COMPLETION', fileId: f.fileId!, fileName: f.name, url: f.url, uploadedAt: claim.repairCompletionProof.submittedAt, uploadedBy: OFFICER.id });
    }
  }

  // Payments: auto-raised on quote approval (UPFRONT) and QC pass (BALANCE).
  const pay = (
    claimId: number, kind: 'UPFRONT' | 'BALANCE', status: PaymentRecord['status'],
    withApproval: 'pending' | 'decided' | null,
  ): void => {
    const claim = store.findClaim(claimId)!;
    const quote = store.quotes.find((q) => q.id === claim.quoteId)!;
    const amount = kind === 'UPFRONT' ? quote.upfrontAmount : round2(quote.totalAmount - quote.upfrontAmount);
    const createdAt = plusHours(claim.createdAt, kind === 'UPFRONT' ? 56 : 90);
    const payment: PaymentRecord = {
      id: store.nextId('payment'), claimId, kind, status, amount, currency: claim.currency,
      invoiceNumber: kind === 'UPFRONT' ? quote.invoiceNumber : `RPR-${String(claimId).padStart(5, '0')}`,
      vendorId: quote.vendorId, paymentSplit: { ...claim.paymentSplit }, createdAt, updatedAt: createdAt,
      requestedBy: OFFICER.id, walletReference: status === 'PAID' || status === 'APPROVED' ? `WALLET-REF-${10000 + claimId}` : undefined,
    };
    store.payments.push(payment);
    if (!withApproval) return;
    const record: ApprovalRecord = {
      id: store.nextId('approval'), type: 'PAYMENT', status: withApproval === 'pending' ? 'PENDING' : 'APPROVED',
      claimId, subjectId: payment.id, paymentId: payment.id, subjectLabel: `${kind === 'UPFRONT' ? 'Upfront' : 'Balance'} payment ${payment.invoiceNumber}`,
      submittedBy: OFFICER.id, submittedByName: OFFICER.name, submittedAt: createdAt, overdueAt: plusHours(createdAt, 48),
      amount, currency: claim.currency, version: 1,
      ...(withApproval === 'decided' ? { decidedBy: APPROVER.id, decidedByName: APPROVER.name, decidedAt: plusHours(createdAt, 5), decisionReason: 'Payment disbursed to workshop account' } : {}),
    };
    store.approvals.push(record);
    payment.approvalId = record.id;
  };
  pay(1030, 'UPFRONT', 'PENDING_APPROVAL', 'pending');
  pay(1031, 'UPFRONT', 'PENDING', null);
  pay(1032, 'UPFRONT', 'PAID', 'decided');
  pay(1032, 'BALANCE', 'PENDING_APPROVAL', 'pending');
  pay(1033, 'UPFRONT', 'PAID', 'decided');
  pay(1033, 'BALANCE', 'PAID', 'decided');

  // Historic benchmarks so line-item price checks have something to compare against.
  const extra: [string, string, number, string, string, string][] = [
    ['Front Brake Pads', 'v-101', 48_000, 'Toyota', 'Camry', 'BRAKING'],
    ['Front Shock Absorber', 'v-102', 50_000, 'Lexus', 'RX 350', 'SUSPENSION'],
    ['Ignition Coil Set', 'v-201', 115_000, 'Mazda', 'CX-5', 'ENGINE'],
    ['Transmission Fluid Flush', 'v-101', 48_000, 'Toyota', 'Camry', 'TRANSMISSION'],
    ['Radiator Assembly', 'v-103', 38_000, 'Honda', 'Accord', 'COOLING'],
    ['Front Bumper Assembly', 'v-101', 245_000, 'Toyota', 'Camry', 'BODY'],
  ];
  extra.forEach(([partName, vendorId, price, make, model, category], i) => {
    const vendor = store.vendors.find((v) => v.id === vendorId)!;
    store.parts.push({
      id: store.nextId('part'), partName, workshop: vendor.name, vendorId, approvedPrice: price,
      currency: store.countries.find((c) => c.code === vendor.country)!.currency, country: vendor.country,
      carLabel: `${make} ${model}`, make, model, category, oemNumber: `OEM-${4000 + i}`,
      approvedDate: daysAgo(40 + i * 7), claimId: 1024,
    });
  });
}
