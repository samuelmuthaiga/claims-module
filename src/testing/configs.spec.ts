import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuditLogsController } from '../modules/audit-logs/controllers/audit-logs.controller';
import { ApprovalsController } from '../modules/approvals/controllers/approvals.controller';
import { AuthController } from '../auth/controllers/auth.controller';
import { ClaimsController } from '../modules/claims/controllers/claims.controller';
import { ConfigsController } from '../modules/configs/controllers/configs.controller';
import { LookupsController } from '../modules/lookups/controllers/lookups.controller';
import { PartsPricingController } from '../modules/parts-pricing/controllers/parts-pricing.controller';
import { PaymentsController } from '../modules/payments/controllers/payments.controller';
import { PublicScheduleController } from '../modules/public-schedule/controllers/public-schedule.controller';
import { TestApp, createTestApp, tokenFor } from './test-app';

const CONTROLLERS = [
  AuditLogsController, ApprovalsController, AuthController, ClaimsController, ConfigsController,
  LookupsController, PartsPricingController, PaymentsController, PublicScheduleController,
];

/** `GET /v1/claims/:p/quotes`-style signatures of every route the service really serves. */
const registeredRoutes = (): Set<string> => {
  const routes = new Set<string>();
  for (const controller of CONTROLLERS) {
    const base: string = Reflect.getMetadata(PATH_METADATA, controller);
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = (controller.prototype as unknown as Record<string, object>)[name]!;
      const method = Reflect.getMetadata(METHOD_METADATA, handler);
      if (method === undefined) continue;
      const path: string = Reflect.getMetadata(PATH_METADATA, handler);
      routes.add(signature(RequestMethod[method]!, `/${base}/${path}`));
    }
  }
  return routes;
};

const signature = (method: string, url: string): string =>
  `${method} ${url.split('?')[0]!.replace(/\{\{[^}]+\}\}/g, ':p').replace(/:[A-Za-z]+/g, ':p').replace(/\/+/g, '/').replace(/\/$/, '')}`;

describe('UI configs', () => {
  let t: TestApp;
  const admin = tokenFor('cfg-admin', ['CLAIMS_ADMIN']);

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  describe('drift guard', () => {
    it('only points at routes that exist', async () => {
      const routes = registeredRoutes();
      const missing: string[] = [];
      const check = (where: string, method: string, url: unknown) => {
        if (typeof url !== 'string' || !url.startsWith('/v1/')) return;
        if (!routes.has(signature(method, url))) missing.push(`${where}: ${method} ${url}`);
      };

      const configs = (await t.api('GET', '/v1/configs')).data as any[];
      expect(configs.length).toBeGreaterThan(20);

      const visit = (key: string, node: any): void => {
        if (!node || typeof node !== 'object') return;
        if (node.options_source?.url) check(`${key}.${node.key}.options_source`, 'GET', node.options_source.url);
        if (node.slots?.url) check(`${key}.${node.key}.slots`, 'GET', node.slots.url);
        Object.values(node).forEach((child) => Array.isArray(child) ? child.forEach((c) => visit(key, c)) : visit(key, child));
      };

      for (const config of configs) {
        (config.actions ?? []).forEach((a: any) => check(`${config.key}.action.${a.key}`, a.method, a.endpoint));
        if (config.type === 'TABLE') {
          check(`${config.key}.endpoint`, 'GET', config.metaData.endpoint);
          if (config.metaData.summary?.endpoint) check(`${config.key}.summary`, 'GET', config.metaData.summary.endpoint);
        }
        if (config.type === 'WORKFLOW') {
          config.metaData.actions.forEach((a: any) => check(`workflow.${a.action}`, a.method, a.endpoint));
        }
        visit(config.key, config.metaData);
      }
      expect(missing).toEqual([]);
    });

    it('wires every workflow action to a form config that exists', async () => {
      const workflow = (await t.api('GET', '/v1/configs/claim-workflow')).data;
      for (const action of workflow.metaData.actions) {
        if (!action.inputSchemaRef) continue;
        expect((await t.api('GET', `/v1/configs/${action.inputSchemaRef}`)).status).toBe(200);
      }
    });

    it('serves the same option values from configs and lookups', async () => {
      const enums = (await t.api('GET', '/v1/lookups/enums')).data;
      const form = (await t.api('GET', '/v1/configs/claim-create')).data;
      const claimType = form.metaData.sections[0].fields.find((f: any) => f.key === 'claimType');
      expect(claimType.options.map((o: any) => o.value)).toEqual(enums.claimTypes.map((o: any) => o.value));
    });
  });

  describe('API', () => {
    it('covers every UI form, filter bar and table', async () => {
      const keys = ((await t.api('GET', '/v1/configs')).data as any[]).map((c) => c.key);
      expect(keys).toEqual(expect.arrayContaining([
        'claim-create', 'claim-scheduling', 'diagnosis-approval-request', 'quote-upload', 'payment-split',
        'repair-completion', 'vehicle-pickup', 'claim-cancel', 'approval-decision', 'payment-request', 'payment-action',
        'claims-filters', 'reviews-filters', 'payments-filters', 'payment-approvals-filters', 'parts-pricing-filters', 'audit-logs-filters',
        'claims-table', 'review-requests-table', 'review-quotes-table', 'review-repairs-table', 'payment-quotes-table',
        'payment-repairs-table', 'payment-approvals-table', 'parts-pricing-table', 'audit-logs-table',
        'claim-workflow', 'claims-settings',
      ]));
      expect(((await t.api('GET', '/v1/configs?type=TABLE')).data as any[]).every((c) => c.type === 'TABLE')).toBe(true);
    });

    it('hydrates context and initial values for an entity', async () => {
      const split = (await t.api('GET', '/v1/configs/payment-split?entityType=claim&entityId=1031')).data;
      expect(split.context).toMatchObject({ claimId: 1031, claimType: 'WARRANTY', repairFinanced: false });
      expect(split.context.quoteTotal).toBeGreaterThan(0);
      expect(split.initialValues).toHaveProperty('autochek');

      const request = (await t.api('GET', '/v1/configs/payment-request?entityType=payment&entityId=50')).data;
      expect(request.initialValues).toMatchObject({ bankName: expect.any(String), paymentType: 'Bank Transfer' });
      expect((await t.api('GET', '/v1/configs/payment-split?entityType=claim&entityId=424242')).status).toBe(404);
    });

    it('dry-runs form validation with field-keyed errors', async () => {
      const bad = await t.api('POST', '/v1/configs/quote-upload/submit', {
        values: { invoiceNumber: 'bad number!', upfrontAmount: 10, totalAmount: 5, lineItems: [{ description: '', quantity: 20, unitAmount: 5 }] },
      });
      expect(bad.status).toBe(200);
      expect(bad.data.ok).toBe(false);
      const keys = bad.data.errors.map((e: any) => e.key);
      expect(keys).toEqual(expect.arrayContaining(['invoiceNumber', 'lineItems.0.description', 'lineItems.0.quantity', 'diagnosisReportUrl']));
    });

    it('honours conditional rules (warranty needs a warranty type; Others needs text)', async () => {
      const claim = (await t.api('POST', '/v1/configs/claim-create/submit', { values: { claimType: 'WARRANTY' } })).data;
      expect(claim.errors.map((e: any) => e.key)).toContain('warrantyType');
      const cancel = (await t.api('POST', '/v1/configs/claim-cancel/submit', { values: { reason: 'Others' } })).data;
      expect(cancel.errors.map((e: any) => e.key)).toEqual(['otherReason']);
    });

    it('changes the etag when a config changes and serves 304 when it has not', async () => {
      const first = await t.api('GET', '/v1/configs/bootstrap');
      const etag = first.headers.get('etag')!;
      expect(first.data.etag).toBe(etag.replace(/"/g, ''));
      expect((await t.api('GET', '/v1/auth/me')).data.configEtag).toBe(first.data.etag);
      expect((await t.api('GET', '/v1/configs/bootstrap', undefined, { headers: { 'if-none-match': etag } })).status).toBe(304);

      const patched = await t.api('PATCH', '/v1/configs/vehicle-pickup', { title: 'Vehicle Handover' });
      expect(patched.data).toMatchObject({ version: 2, title: 'Vehicle Handover' });
      const second = await t.api('GET', '/v1/configs/bootstrap');
      expect(second.data.etag).not.toBe(first.data.etag);
      expect(second.status).toBe(200);
    });

    it('validates schemas on create and update, and records changes in the audit log', async () => {
      const invalid = await t.api('PATCH', '/v1/configs/claim-cancel', { metaData: { fields: [{ key: 'x', type: 'select', label: 'X' }] } });
      expect(invalid.status).toBe(422);
      expect(invalid.body.errors[0].message).toContain('options or options_source');

      const created = await t.api('POST', '/v1/configs', {
        key: 'demo-form', type: 'FORM', title: 'Demo', metaData: { fields: [{ key: 'note', type: 'text', label: 'Note', required: true }] },
      });
      expect(created.status).toBe(201);
      expect((await t.api('POST', '/v1/configs', { key: 'demo-form', type: 'FORM', title: 'Dup', metaData: { fields: [{ key: 'a', type: 'text', label: 'A' }] } })).status).toBe(409);
      expect((await t.api('POST', '/v1/configs/demo-form/submit', { values: {} })).data.ok).toBe(false);

      const audit = (await t.api('GET', '/v1/audit-logs?module=CONFIGS&limit=10')).data;
      expect(audit.map((a: any) => a.action)).toEqual(expect.arrayContaining(['CONFIG_CREATED', 'CONFIG_UPDATED']));
    });

    it('prefers a country-specific config over the global one', async () => {
      await t.api('POST', '/v1/configs', {
        key: 'repair-completion', type: 'FORM', title: 'Complete Repair (Kenya)', country: 'KE',
        metaData: { fields: [{ key: 'afterImageUrl', type: 'file', label: 'Proof', required: true }] },
      });
      expect((await t.api('GET', '/v1/configs/repair-completion?country=KE')).data.title).toBe('Complete Repair (Kenya)');
      expect((await t.api('GET', '/v1/configs/repair-completion?country=NG')).data.title).not.toContain('Kenya');
      expect(admin).toBeTruthy();
    });
  });
});
