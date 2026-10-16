import { ApiResult, ClaimDriver, TestApp, createTestApp } from './test-app';

describe('claim lifecycle (end to end)', () => {
  let t: TestApp;
  let driver: ClaimDriver;

  beforeAll(async () => {
    t = await createTestApp();
    driver = new ClaimDriver(t.api);
  });
  afterAll(() => t.close());

  const errors = (res: ApiResult) => (res.body.errors ?? []).map((e: any) => e.key);

  describe('request envelope', () => {
    it('wraps success and error responses consistently', async () => {
      const ok = await t.api('GET', '/v1/claims/summary');
      expect(ok.body).toMatchObject({ success: true, statusCode: 200 });
      expect(ok.body.timestamp).toBeDefined();
      expect(ok.headers.get('x-request-id')).toBeTruthy();

      const missing = await t.api('GET', '/v1/claims/999999');
      expect(missing.status).toBe(404);
      expect(missing.body).toMatchObject({ success: false, errorCode: 'RESOURCE_NOT_FOUND', path: '/v1/claims/999999' });
    });

    it('returns lists as { data, meta } with pagination', async () => {
      const res = await t.api('GET', '/v1/claims?limit=2&page=2');
      expect(res.body.meta).toMatchObject({ page: 2, limit: 2, hasPreviousPage: true });
      expect(res.data).toHaveLength(2);
    });

    it('rejects unknown properties and bad ids with 422 VALIDATION_FAILED', async () => {
      const unknown = await t.api('POST', '/v1/claims', { claimType: 'REPAIRS', surprise: 1 });
      expect(unknown.status).toBe(422);
      expect(errors(unknown)).toContain('surprise');
      expect((await t.api('GET', '/v1/claims/abc')).status).toBe(422);
      expect((await t.api('GET', '/v1/claims?limit=500')).body.errorCode).toBe('VALIDATION_FAILED');
    });
  });

  describe('claims list', () => {
    it('filters by status, type, country and search', async () => {
      const byStatus = await t.api('GET', '/v1/claims?status=REPAIR_ONGOING,QUALITY_CONTROL');
      expect(byStatus.data.every((c: any) => ['REPAIR_ONGOING', 'QUALITY_CONTROL'].includes(c.status))).toBe(true);

      const byType = await t.api('GET', '/v1/claims?claimType=INSURANCE');
      expect(byType.data.every((c: any) => c.claimType === 'INSURANCE')).toBe(true);

      const byVin = await t.api('GET', '/v1/claims?searchType=VIN&search=4T1B11');
      expect(byVin.data.length).toBeGreaterThan(0);
      expect(byVin.data.every((c: any) => c.car.vin.includes('4T1B11'))).toBe(true);

      const kenya = await t.api('GET', '/v1/claims?country=KE');
      expect(kenya.data.every((c: any) => c.country === 'KE')).toBe(true);
    });

    it('sorts on a whitelisted field and ignores others', async () => {
      const asc = await t.api('GET', '/v1/claims?sort=id:asc&limit=100');
      const ids = asc.data.map((c: any) => c.id);
      expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));
      expect((await t.api('GET', '/v1/claims?sort=password:asc')).status).toBe(200);
    });

    it('counts only active claims in the summary', async () => {
      const summary = (await t.api('GET', '/v1/claims/summary')).data;
      const all = (await t.api('GET', '/v1/claims?limit=100')).data;
      const active = all.filter((c: any) => !['VEHICLE_DELIVERED', 'CANCELLED'].includes(c.status));
      expect(summary.vehiclesInWorkshop).toBe(active.length);
    });
  });

  describe('create claim', () => {
    it('rejects an ineligible car and a duplicate open claim', async () => {
      const ineligible = await t.api('POST', '/v1/claims', {
        claimType: 'INSURANCE', carId: 'car-994', customerPhone: '+254700000001', requestChannel: 'EMAIL', initialDetails: 'No policy on this car at all',
      });
      expect(ineligible.status).toBe(422);
      expect(ineligible.body.errorCode).toBe('CAR_NOT_ELIGIBLE');

      const duplicate = await t.api('POST', '/v1/claims', {
        claimType: 'WARRANTY', warrantyType: 'LOAN_WARRANTY', carId: 'car-991', customerPhone: '+2348012345678', requestChannel: 'EMAIL', initialDetails: 'Another warranty claim please',
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.errorCode).toBe('DUPLICATE_OPEN_CLAIM');
    });

    it('requires warrantyType for warranty claims and E.164 phones', async () => {
      const res = await t.api('POST', '/v1/claims', {
        claimType: 'WARRANTY', carId: 'car-995', customerPhone: '0801', requestChannel: 'EMAIL', initialDetails: 'Short but long enough',
      });
      expect(errors(res).sort()).toEqual(['customerPhone', 'warrantyType']);
    });

    it('replays an idempotent create instead of making a second claim', async () => {
      const body = { claimType: 'REPAIRS', carId: 'car-998', customerPhone: '+2348055500002', requestChannel: 'EMAIL', initialDetails: 'Idempotent create check here' };
      const headers = { 'idempotency-key': `key-${Date.now()}` };
      const first = await t.api('POST', '/v1/claims', body, { headers });
      const second = await t.api('POST', '/v1/claims', body, { headers });
      expect(second.headers.get('idempotent-replayed')).toBe('true');
      expect(second.data.id).toBe(first.data.id);
      expect(first.headers.get('location')).toBe(`/v1/claims/${first.data.id}`);
    });
  });

  describe('public scheduling', () => {
    it('hides internals, enforces the working window and single use', async () => {
      const { id, token } = await driver.create('REPAIRS', 'car-992').catch(() => driver.create('INSURANCE', 'car-992'));
      const link = await t.api('GET', `/v1/public/schedule/${token}`);
      expect(link.status).toBe(200);
      expect(link.data.vehicle.plateMasked).toContain('*');
      expect(link.data.form.key).toBe('claim-scheduling');
      expect(link.data.form.context.token).toBe(token);

      const tooSoon = await t.api('POST', `/v1/public/schedule/${token}/submission`, {
        category: 'BRAKING', vendorId: 'v-101', appointmentDate: new Date(Date.now() + 3_600_000).toISOString(),
      });
      expect(tooSoon.body.errorCode).toBe('APPOINTMENT_OUT_OF_WINDOW');

      const kenyaVendor = await t.api('POST', `/v1/public/schedule/${token}/submission`, {
        category: 'BRAKING', vendorId: 'v-201', appointmentDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      });
      expect(kenyaVendor.body.errorCode).toBe('VENDOR_NOT_ELIGIBLE');

      await driver.schedule(token);
      const reused = await t.api('GET', `/v1/public/schedule/${token}`);
      expect(reused.status).toBe(410);
      expect(reused.body.errorCode).toBe('SCHEDULE_LINK_USED');
      expect((await t.api('GET', `/v1/claims/${id}`)).data.status).toBe('CUSTOMER_SUBMITTED_FORM');
      expect((await t.api('GET', '/v1/public/schedule/not-a-token')).status).toBe(404);
    });

    it('limits link resends to 3 per window and rotates the token', async () => {
      const { id, token } = await driver.create('REPAIRS', 'car-994');
      let latest = token;
      for (let i = 0; i < 3; i++) {
        const res = await t.api('POST', `/v1/claims/${id}/schedule-link/resends`);
        expect(res.status).toBe(200);
        expect(res.data.scheduleLink).not.toContain(latest);
        latest = res.data.scheduleLink.split('/').pop();
      }
      const blocked = await t.api('POST', `/v1/claims/${id}/schedule-link/resends`);
      expect(blocked.status).toBe(429);
      expect(blocked.body.errorCode).toBe('RATE_LIMITED');
      expect((await t.api('GET', `/v1/public/schedule/${token}`)).status).toBe(404);
    });
  });

  describe('repairs workflow', () => {
    it('walks a claim from creation to delivery, raising approvals and payments on the way', async () => {
      const { id, token } = await driver.create('REPAIRS', 'car-993');
      await driver.toQuoteApproved(id, token, 150_000, 60_000);

      expect((await t.api('GET', `/v1/claims/${id}`)).data.status).toBe('REPAIR_ONGOING');

      // Approving the quote raised the upfront payment into the approvals queue.
      const payments = (await t.api('GET', '/v1/payments/approvals')).data;
      const upfront = payments.find((p: any) => p.claimId === id);
      expect(upfront).toMatchObject({ kind: 'UPFRONT', amount: 60_000 });
      const paid = await t.api('POST', '/v1/payments/action', { list: 'approvals', id: upfront.id, approve: true, reason: 'Disburse' });
      expect(paid.data).toMatchObject({ status: 'APPROVED', paymentStatus: 'APPROVED' });
      expect(paid.data.walletReference).toMatch(/^WALLET-REF-/);

      const completed = await t.api('POST', `/v1/claims/${id}/repair-completion`, { afterImageUrl: 'https://files.test/after.jpg' });
      expect(completed.data).toMatchObject({ status: 'QUALITY_CONTROL', qa: { state: 'ASSIGNED' } });

      const early = await t.api('POST', `/v1/claims/${id}/pickup`, {});
      expect(early.body.errorCode).toBe('INVALID_TRANSITION');

      const qc = await driver.approvalFor(id, 'QA_SIGNOFF');
      expect((await t.api('POST', `/v1/approvals/${qc.id}/decision`, { decision: 'APPROVE' })).data.claimStatus).toBe('VEHICLE_READY');

      const balance = (await t.api('GET', '/v1/payments/approvals')).data.find((p: any) => p.claimId === id && p.kind === 'BALANCE');
      expect(balance.amount).toBe(90_000);

      expect((await t.api('POST', `/v1/claims/${id}/pickup`, {})).data.status).toBe('VEHICLE_DELIVERED');

      const detail = (await t.api('GET', `/v1/claims/${id}`)).data;
      expect(detail.workflow.rail.at(-1)).toMatchObject({ code: 'VEHICLE_DELIVERED', state: 'CURRENT' });
      expect(detail.availableActions.every((a: any) => !a.enabled)).toBe(true);

      const history = (await t.api('GET', `/v1/claims/${id}/status-history`)).data.map((h: any) => h.toStatus);
      expect(history).toEqual([
        'JOB_ORDER_CREATED', 'CUSTOMER_SUBMITTED_FORM', 'PENDING_APPROVAL', 'DIAGNOSIS_IN_PROGRESS',
        'QUOTE_IN_REVIEW', 'REPAIR_ONGOING', 'QUALITY_CONTROL', 'VEHICLE_READY', 'VEHICLE_DELIVERED',
      ]);

      const audit = (await t.api('GET', `/v1/audit-logs?claimId=${id}&limit=100`)).data;
      expect(audit.length).toBeGreaterThanOrEqual(9);
      expect((await t.api('GET', `/v1/parts-pricing?search=Front Brake Pads&limit=100`)).data.some((p: any) => p.claimId === id)).toBe(true);
    });

    it('sends a declined diagnosis back so the workshop can re-request', async () => {
      const { id, token } = await driver.create('REPAIRS', 'car-999');
      await driver.schedule(token);
      const req = await t.api('POST', `/v1/claims/${id}/diagnosis-approval-requests`, { workshopProofUrl: 'https://files.test/p.jpg' });
      const decline = await t.api('POST', `/v1/approvals/${req.data.approvalId}/decision`, { decision: 'DECLINE', reason: 'Photo does not show the plate number' });
      expect(decline.data).toMatchObject({ status: 'DECLINED', claimStatus: 'CUSTOMER_SUBMITTED_FORM' });
      const again = await t.api('POST', `/v1/claims/${id}/diagnosis-approval-requests`, { workshopProofUrl: 'https://files.test/p2.jpg' });
      expect(again.status).toBe(200);
    });

    it('lets the workshop revise a declined quote', async () => {
      const { id, token } = await driver.create('REPAIRS', 'car-1000');
      await driver.toDiagnosis(id, token);
      await t.api('POST', `/v1/claims/${id}/quotes`, driver.quote());
      const approval = await driver.approvalFor(id, 'QUOTE');
      const declined = await t.api('POST', `/v1/approvals/${approval.id}/decision`, { decision: 'DECLINE', reason: 'Labour looks too high for this job' });
      expect(declined.data.claimStatus).toBe('DIAGNOSIS_IN_PROGRESS');
      const revised = await t.api('POST', `/v1/claims/${id}/quotes`, driver.quote(120_000, 40_000));
      expect(revised.data).toMatchObject({ revision: 2, kind: 'REVISION' });
    });

    it('sends failed QC back to repair and opens the next round', async () => {
      const { id, token } = await driver.create('REPAIRS', 'car-1001');
      await driver.toQuoteApproved(id, token);
      await t.api('POST', `/v1/claims/${id}/repair-completion`, { afterImageUrl: 'https://files.test/a.jpg' });
      const qc = await driver.approvalFor(id, 'QA_SIGNOFF');
      const fail = await t.api('POST', `/v1/approvals/${qc.id}/decision`, { decision: 'DECLINE', reason: 'Brake pedal still spongy after repair' });
      expect(fail.data.claimStatus).toBe('REPAIR_ONGOING');
      const redo = await t.api('POST', `/v1/claims/${id}/repair-completion`, { afterImageUrl: 'https://files.test/b.jpg' });
      expect((await t.api('GET', `/v1/claims/${id}`)).data.qa).toMatchObject({ round: 2, state: 'ASSIGNED' });
      expect(redo.status).toBe(200);
    });

    it('closes pending approvals when a claim is cancelled', async () => {
      const { id, token } = await driver.create('REPAIRS', 'car-991');
      await driver.schedule(token);
      const req = await t.api('POST', `/v1/claims/${id}/diagnosis-approval-requests`, { workshopProofUrl: 'https://files.test/p.jpg' });

      expect((await t.api('POST', `/v1/claims/${id}/cancellation`, { reason: 'short' })).status).toBe(422);
      const cancelled = await t.api('POST', `/v1/claims/${id}/cancellation`, { reason: 'Customer requested cancellation' });
      expect(cancelled.data).toMatchObject({ status: 'CANCELLED', cancelledBy: 'user-207' });

      const approval = (await t.api('GET', `/v1/approvals/${req.data.approvalId}`)).data;
      expect(approval).toMatchObject({ status: 'DECLINED', decisionReason: 'Claim cancelled' });
      const rail = (await t.api('GET', `/v1/claims/${id}`)).data.workflow.rail;
      expect(rail.at(-1)).toMatchObject({ code: 'CANCELLED', state: 'CURRENT' });
      expect((await t.api('POST', `/v1/claims/${id}/cancellation`, { reason: 'Cancelling a second time' })).status).toBe(409);
    });
  });

  describe('quote and split rules', () => {
    let id: number;
    beforeAll(async () => {
      const created = await driver.create('WARRANTY', 'car-992', { warrantyType: 'CASH_WARRANTY' });
      id = created.id;
      await driver.toDiagnosis(id, created.token);
    });

    it.each([
      ['total does not match the lines', (q: any) => ({ ...q, totalAmount: 140_000 }), 'lineItems'],
      ['upfront exceeds total', (q: any) => ({ ...q, upfrontAmount: 200_000 }), 'upfrontAmount'],
      ['a report is missing', (q: any) => ({ ...q, scanReportUrl: undefined }), 'scanReportUrl'],
      ['quantity is not a 0.5 step', (q: any) => ({ ...q, lineItems: [{ ...q.lineItems[0], quantity: 1.3 }, q.lineItems[1]] }), 'lineItems.0.quantity'],
      ['a line amount is wrong', (q: any) => ({ ...q, lineItems: [{ ...q.lineItems[0], amount: 1 }, q.lineItems[1]] }), 'lineItems.0.amount'],
    ])('rejects a quote when %s', async (_name, mutate, key) => {
      const res = await t.api('POST', `/v1/claims/${id}/quotes`, mutate(driver.quote()));
      expect(res.status).toBe(422);
      expect(errors(res)).toContain(key);
    });

    it('rejects a quote that exceeds the remaining warranty cap', async () => {
      const res = await t.api('POST', `/v1/claims/${id}/quotes`, driver.quote(600_000, 100_000));
      expect(res.body.errorCode).toBe('WARRANTY_CAP_EXCEEDED');
    });

    it('requires a payment split for warranty quotes and checks it against the quote total', async () => {
      const upload = await t.api('POST', `/v1/claims/${id}/quotes`, driver.quote(150_000, 60_000, 'INV-WARR-1'));
      expect(upload.data.approvalId).toBeNull();
      expect((await t.api('GET', `/v1/claims/${id}`)).data.status).toBe('QUOTE_SUBMITTED');

      const wrong = await t.api('PUT', `/v1/claims/${id}/payment-split`, { customer: 10_000, autochek: 100_000, insurance: 0 });
      expect(wrong.status).toBe(422);
      const financing = await t.api('PUT', `/v1/claims/${id}/payment-split`, { customer: 0, autochek: 100_000, insurance: 0, repairFinancing: 50_000 });
      expect(errors(financing)).toContain('repairFinancing');

      const ok = await t.api('PUT', `/v1/claims/${id}/payment-split`, { customer: 30_000, autochek: 120_000, insurance: 0 });
      expect(ok.data.total).toBe(150_000);
      expect((await t.api('GET', `/v1/claims/${id}`)).data.status).toBe('QUOTE_IN_REVIEW');
      expect(await driver.approvalFor(id, 'QUOTE')).toMatchObject({ amount: 150_000 });
    });

    it('refuses a duplicate invoice number for the same workshop', async () => {
      const other = await driver.create('REPAIRS', 'car-993', {});
      await driver.toDiagnosis(other.id, other.token);
      const res = await t.api('POST', `/v1/claims/${other.id}/quotes`, driver.quote(150_000, 60_000, 'INV-WARR-1'));
      expect(res.body.errorCode).toBe('DUPLICATE_INVOICE');
    });
  });

  describe('approvals and payments', () => {
    it('summarises pending counts per type and filters the queue', async () => {
      const summary = (await t.api('GET', '/v1/approvals/summary')).data;
      for (const type of ['DIAGNOSIS', 'QUOTE', 'QA_SIGNOFF', 'PAYMENT']) {
        const queue = await t.api('GET', `/v1/approvals?type=${type}&limit=100`);
        expect(queue.body.meta).toBeDefined();
        expect(queue.data.length).toBe(summary[type]);
      }
      expect((await t.api('GET', '/v1/approvals')).status).toBe(422); // type is required
    });

    it('returns per-type approval detail with price and cover checks', async () => {
      const quote = (await t.api('GET', '/v1/approvals?type=QUOTE')).data[0];
      const detail = (await t.api('GET', `/v1/approvals/${quote.id}`)).data;
      expect(detail.quote.lineItems[0]).toHaveProperty('priceCheck');
      expect(detail.quote.lineItems[0]).toHaveProperty('coverCheck');
      expect(detail.warrantyCap.capLimit).toBeGreaterThan(0);
      expect(detail.decision.canDecide).toBe(true);
    });

    it('does not allow deciding an approval twice', async () => {
      const diag = (await t.api('GET', '/v1/approvals?type=DIAGNOSIS')).data[0];
      expect((await t.api('POST', `/v1/approvals/${diag.id}/decision`, { decision: 'APPROVE' })).status).toBe(200);
      const again = await t.api('POST', `/v1/approvals/${diag.id}/decision`, { decision: 'APPROVE' });
      expect(again.status).toBe(409);
    });

    it('requests a payment again after an invoice was declined', async () => {
      const seeded = (await t.api('GET', '/v1/payments/quotes?paymentStatus=PENDING')).data[0];
      const requested = await t.api('POST', '/v1/payments/request', {
        list: 'quotes', id: seeded.id, amount: seeded.amount, invoiceNumber: seeded.invoiceNumber,
        paymentSplit: { customer: 0, autochek: seeded.amount, insurance: 0 },
      });
      expect(requested.status).toBe(201);
      const decline = await t.api('POST', '/v1/payments/action', { list: 'approvals', id: requested.data.approvalId, approve: false, reason: 'Invoice is unclear' });
      expect(decline.data).toMatchObject({ status: 'DECLINED', paymentStatus: 'INVOICE_DECLINED' });
      const retry = await t.api('POST', '/v1/payments/request', {
        list: 'quotes', id: seeded.id, amount: seeded.amount, invoiceNumber: seeded.invoiceNumber,
        paymentSplit: { customer: seeded.amount, autochek: 0, insurance: 0 },
      });
      expect(retry.status).toBe(201);
    });

    it('validates a payment request split against the requested amount', async () => {
      const row = (await t.api('GET', '/v1/payments/repairs?paymentStatus=PENDING_APPROVAL')).data[0];
      expect((await t.api('POST', '/v1/payments/request', {
        list: 'repairs', id: row.id, amount: 1000, invoiceNumber: 'RPR-1', paymentSplit: { customer: 1, autochek: 1, insurance: 0 },
      })).status).toBe(409); // already awaiting approval
    });

    it('applies row-level actions (dispute) and keeps the approval queue consistent', async () => {
      const row = (await t.api('GET', '/v1/payments/repairs?paymentStatus=PENDING_APPROVAL')).data[0];
      const disputed = await t.api('POST', '/v1/payments/action', { list: 'repairs', id: row.id, newStatus: 'DISPUTED', reason: 'Vendor to clarify' });
      expect(disputed.data.paymentStatus).toBe('DISPUTED');
      expect((await t.api('GET', `/v1/payments/repairs/${row.id}`)).data.statusReason).toBe('Vendor to clarify');
      expect((await t.api('POST', '/v1/payments/action', { list: 'repairs', id: row.id, reason: 'x1' })).status).toBe(422);
    });
  });

  describe('audit trail', () => {
    it('is hash-chained and summarised', async () => {
      const list = (await t.api('GET', '/v1/audit-logs?limit=5')).data;
      const detail = (await t.api('GET', `/v1/audit-logs/${list[0].id}`)).data;
      expect(detail.chainHash).toHaveLength(64);
      expect(detail.previousHash).toHaveLength(64);

      const summary = (await t.api('GET', '/v1/audit-logs/summary')).data;
      expect(summary.totalEvents).toBeGreaterThan(50);
      expect(Object.keys(summary.byModule)).toEqual(expect.arrayContaining(['CLAIMS']));
      const ui = (await t.api('GET', '/v1/audit-logs?entityType=Claim Request&searchType=PERFORMED_BY&search=john')).data;
      expect(ui.length).toBeGreaterThan(0);
    });
  });
});
