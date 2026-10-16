import { ClaimDriver, TestApp, createTestApp, tokenFor } from './test-app';

describe('authentication, permissions and approval controls', () => {
  let t: TestApp;
  const admin = tokenFor('admin-1', ['CLAIMS_ADMIN'], 'Admin One');
  const admin2 = tokenFor('admin-2', ['CLAIMS_ADMIN'], 'Admin Two');
  const admin4 = tokenFor('admin-4', ['CLAIMS_ADMIN'], 'Admin Four');
  const officer = tokenFor('officer-1', ['CLAIMS_OFFICER'], 'Officer One');
  const viewer = tokenFor('viewer-1', ['CLAIMS_READONLY'], 'Viewer One');

  beforeAll(async () => {
    t = await createTestApp({ DISABLE_AUTH: 'false', MAKER_CHECKER_ENABLED: 'true', DISABLE_AUTH_USER_ID: 'unused' });
  });
  afterAll(() => t.close());

  describe('bearer authentication', () => {
    it('rejects missing, malformed and invalid tokens', async () => {
      const none = await t.api('GET', '/v1/claims');
      expect(none).toMatchObject({ status: 401 });
      expect(none.body.errorCode).toBe('UNAUTHORIZED');

      const bad = await t.api('GET', '/v1/claims', undefined, { token: 'not.a.jwt' });
      expect(bad.status).toBe(401);
      expect(bad.body.errorCode).toBe('TOKEN_INVALID');

      const wrongSecret = await t.api('GET', '/v1/claims', undefined, {
        token: require('jsonwebtoken').sign({ sub: 'x', roles: ['CLAIMS_ADMIN'] }, 'another-secret-another-secret-12345', { algorithm: 'HS512' }),
      });
      expect(wrongSecret.body.errorCode).toBe('TOKEN_INVALID');

      const expired = await t.api('GET', '/v1/claims', undefined, {
        token: require('jsonwebtoken').sign({ sub: 'x', roles: ['CLAIMS_ADMIN'], exp: Math.floor(Date.now() / 1000) - 60 }, 'test-secret-test-secret-test-secret-123', { algorithm: 'HS512' }),
      });
      expect(expired.body.errorCode).toBe('TOKEN_EXPIRED');
    });

    it('leaves health, the public schedule link and sso login open', async () => {
      expect((await t.api('GET', '/v1/health')).status).toBe(200);
      expect((await t.api('GET', '/v1/public/schedule/demo-schedule-1025')).status).toBe(200);
      expect((await t.api('POST', '/v1/auth/sso/login', { token: 'x' })).status).toBe(200);
    });

    it('describes the caller on /auth/me', async () => {
      const me = (await t.api('GET', '/v1/auth/me', undefined, { token: officer })).data;
      expect(me).toMatchObject({ id: 'officer-1', role: 'CLAIMS_OFFICER' });
      expect(me.permissions).toContain('claims:write');
      expect(me.permissions).not.toContain('reviews:approve');
      expect(me.configEtag).toBeTruthy();
    });

    it('issues a verifiable token from the non-production SSO stub', async () => {
      const login = (await t.api('POST', '/v1/auth/sso/login', { token: 'idp-token' })).data;
      const me = await t.api('GET', '/v1/auth/me', undefined, { token: login.accessToken });
      expect(me.status).toBe(200);
    });
  });

  describe('permissions', () => {
    it('lets a read-only user read but not write', async () => {
      expect((await t.api('GET', '/v1/claims', undefined, { token: viewer })).status).toBe(200);
      const write = await t.api('POST', '/v1/claims/1025/cancellation', { reason: 'Customer requested cancellation' }, { token: viewer });
      expect(write.status).toBe(403);
      expect(write.body.errorCode).toBe('FORBIDDEN');
      expect((await t.api('GET', '/v1/audit-logs', undefined, { token: viewer })).status).toBe(403);
    });

    it('lets an officer manage claims but not decide approvals or payments', async () => {
      const diag = (await t.api('GET', '/v1/approvals?type=DIAGNOSIS', undefined, { token: officer })).data[0];
      expect((await t.api('POST', `/v1/approvals/${diag.id}/decision`, { decision: 'APPROVE' }, { token: officer })).status).toBe(403);
      expect((await t.api('POST', '/v1/payments/action', { list: 'approvals', id: 1, approve: true, reason: 'ok' }, { token: officer })).status).toBe(403);
      expect((await t.api('GET', '/v1/audit-logs', undefined, { token: officer })).status).toBe(200);
    });

    it('limits config management to admins', async () => {
      const body = { title: 'Edited' };
      expect((await t.api('PATCH', '/v1/configs/repair-completion', body, { token: officer })).status).toBe(403);
      expect((await t.api('PATCH', '/v1/configs/repair-completion', body, { token: admin })).status).toBe(200);
    });

    it('reports per-user action availability', async () => {
      const asAdmin = (await t.api('GET', '/v1/claims/1031/available-actions', undefined, { token: admin })).data;
      const asViewer = (await t.api('GET', '/v1/claims/1031/available-actions', undefined, { token: viewer })).data;
      expect(asAdmin.find((a: any) => a.action === 'cancel_claim').enabled).toBe(true);
      expect(asViewer.find((a: any) => a.action === 'cancel_claim')).toMatchObject({
        enabled: false, disabledReason: 'You do not have permission to perform this action',
      });
    });
  });

  describe('maker-checker and dual control', () => {
    const officerDriver = () => new ClaimDriver(t.api, officer);
    const adminDriver = () => new ClaimDriver(t.api, admin);

    it('stops the submitter from deciding their own approval', async () => {
      const mine = tokenFor('admin-3', ['CLAIMS_ADMIN', 'CLAIMS_OFFICER']);
      const driver = new ClaimDriver(t.api, mine);
      const { id, token } = await driver.create('REPAIRS', 'car-1002');
      await driver.schedule(token);
      const req = await t.api('POST', `/v1/claims/${id}/diagnosis-approval-requests`, { workshopProofUrl: 'https://f/p.jpg' }, { token: mine });

      const detail = (await t.api('GET', `/v1/approvals/${req.data.approvalId}`, undefined, { token: mine })).data;
      expect(detail.decision).toMatchObject({ canDecide: false });

      const own = await t.api('POST', `/v1/approvals/${req.data.approvalId}/decision`, { decision: 'APPROVE' }, { token: mine });
      expect(own.status).toBe(403);
      expect(own.body.errorCode).toBe('MAKER_CHECKER_VIOLATION');

      const other = await t.api('POST', `/v1/approvals/${req.data.approvalId}/decision`, { decision: 'APPROVE' }, { token: admin });
      expect(other.status).toBe(200);
    });

    it('rejects a stale If-Match version', async () => {
      const driver = officerDriver();
      const { id } = await driver.create('REPAIRS', 'car-998');
      const stale = await t.api('POST', `/v1/claims/${id}/cancellation`, { reason: 'Customer requested cancellation' }, { token: officer, headers: { 'if-match': '99' } });
      expect(stale.status).toBe(412);
      expect(stale.body.errorCode).toBe('VERSION_CONFLICT');
      const current = (await t.api('GET', `/v1/claims/${id}`, undefined, { token: officer })).data.version;
      expect((await t.api('POST', `/v1/claims/${id}/cancellation`, { reason: 'Customer requested cancellation' }, { token: officer, headers: { 'if-match': `"${current}"` } })).status).toBe(200);
    });

    it('needs two different approvers for payments at or above the dual-approval threshold', async () => {
      const driver = officerDriver();
      const { id, token } = await driver.create('REPAIRS', 'car-999');
      await driver.schedule(token);
      const req = await t.api('POST', `/v1/claims/${id}/diagnosis-approval-requests`, { workshopProofUrl: 'https://f/p.jpg' }, { token: officer });
      await t.api('POST', `/v1/approvals/${req.data.approvalId}/decision`, { decision: 'APPROVE' }, { token: admin });
      await t.api('POST', `/v1/claims/${id}/quotes`, driver.quote(1_200_000, 600_000), { token: officer });
      const quote = await adminDriver().approvalFor(id, 'QUOTE');
      await t.api('POST', `/v1/approvals/${quote.id}/decision`, { decision: 'APPROVE' }, { token: admin });

      const payment = (await t.api('GET', '/v1/payments/approvals', undefined, { token: admin })).data.find((p: any) => p.claimId === id);
      expect(payment.amount).toBe(600_000);
      const detail = (await t.api('GET', `/v1/payments/approvals/${payment.id}`, undefined, { token: admin2 })).data;
      expect(detail.decision).toMatchObject({ requiresSecondApprover: true, secondApproverState: 'AWAITING_FIRST' });

      // The admin who approved the quote raised this payment, so they cannot release it.
      const maker = await t.api('POST', '/v1/payments/action', { list: 'approvals', id: payment.id, approve: true, reason: 'Own request' }, { token: admin });
      expect(maker.body.errorCode).toBe('MAKER_CHECKER_VIOLATION');

      const first = await t.api('POST', '/v1/payments/action', { list: 'approvals', id: payment.id, approve: true, reason: 'First sign-off' }, { token: admin2 });
      expect(first.data).toMatchObject({ status: 'PENDING', secondApproverState: 'AWAITING_SECOND' });

      const sameAgain = await t.api('POST', '/v1/payments/action', { list: 'approvals', id: payment.id, approve: true, reason: 'Again' }, { token: admin2 });
      expect(sameAgain.body.errorCode).toBe('MAKER_CHECKER_VIOLATION');

      const second = await t.api('POST', '/v1/payments/action', { list: 'approvals', id: payment.id, approve: true, reason: 'Second sign-off' }, { token: admin4 });
      expect(second.data).toMatchObject({ status: 'APPROVED', paymentStatus: 'APPROVED' });
    });
  });
});
