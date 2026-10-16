import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../app.module';
import { setupApp } from '../app.setup';

export interface ApiResult<T = any> {
  status: number;
  body: any;
  data: T;
  headers: Headers;
}

export type Api = <T = any>(
  method: string,
  path: string,
  body?: unknown,
  options?: { token?: string; headers?: Record<string, string> },
) => Promise<ApiResult<T>>;

export interface TestApp {
  app: INestApplication;
  api: Api;
  close: () => Promise<void>;
}

const JWT_SECRET = 'test-secret-test-secret-test-secret-123';

/** Signs a gateway-style token for the auth-enabled tests. */
export const tokenFor = (id: string, roles: string[], name = id): string =>
  jwt.sign({ sub: id, name, roles }, JWT_SECRET, { algorithm: 'HS512', expiresIn: 600 });

/**
 * Boots the real application (same pipes, envelope and error filter as
 * production) on an ephemeral port. By default auth is bypassed and
 * maker-checker is off so a single user can walk a claim end to end.
 */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const previous = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DISABLE_AUTH: 'true',
    DISABLE_AUTH_USER_ID: 'user-207',
    DISABLE_AUTH_USER_ROLES: 'CLAIMS_ADMIN',
    MAKER_CHECKER_ENABLED: 'false',
    AUTH_JWT_SECRET: JWT_SECRET,
    AUTH_JWT_ALGORITHM: 'HS512',
    API_GLOBAL_PREFIX: '',
    CLAIMS_UI_BASE_URL: 'http://ui.test',
    ...env,
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  setupApp(app);
  await app.init();
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');

  const api: Api = async (method, path, body, options = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed = res.status === 304 ? null : await res.json().catch(() => null);
    return { status: res.status, body: parsed, data: parsed?.data, headers: res.headers };
  };

  return {
    app,
    api,
    close: async () => {
      await app.close();
      process.env = previous;
    },
  };
}

/** Drives a claim through the workflow so tests can start from any stage. */
export class ClaimDriver {
  constructor(
    private readonly api: Api,
    private readonly token?: string,
  ) {}

  private call = <T = any>(method: string, path: string, body?: unknown, headers?: Record<string, string>) =>
    this.api<T>(method, path, body, { token: this.token, headers });

  async create(claimType = 'REPAIRS', carId = 'car-993', extra: Record<string, unknown> = {}) {
    const res = await this.call('POST', '/v1/claims', {
      claimType, carId, customerPhone: '+2348055500001', requestChannel: 'PHONE_CALL',
      initialDetails: 'Customer reports a grinding noise from the front axle', ...extra,
    });
    expect(res.status).toBe(201);
    return { id: res.data.id as number, token: (res.data.scheduleLink as string).split('/').pop()! };
  }

  /** Customer picks a workshop and a valid working-hours slot via the public link. */
  async schedule(token: string, vendorId = 'v-101') {
    const from = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
    const slots = await this.api('GET', `/v1/public/schedule/${token}/slots?vendorId=${vendorId}&from=${from}&to=${to}`);
    const day = slots.data.find((d: any) => d.slots.some((s: any) => s.available));
    const slot = day.slots.find((s: any) => s.available);
    const res = await this.api('POST', `/v1/public/schedule/${token}/submission`, {
      category: 'BRAKING', vendorId, appointmentDate: `${day.date}T${slot.start}:00+01:00`,
    });
    expect(res.status).toBe(201);
    return res.data;
  }

  async approvalFor(claimId: number, type: string) {
    const res = await this.call('GET', `/v1/approvals?type=${type}&claimId=${claimId}`);
    return res.data[0];
  }

  async toDiagnosis(id: number, token: string) {
    await this.schedule(token);
    const req = await this.call('POST', `/v1/claims/${id}/diagnosis-approval-requests`, { workshopProofUrl: 'https://files.test/proof.jpg' });
    expect(req.status).toBe(200);
    const decision = await this.call('POST', `/v1/approvals/${req.data.approvalId}/decision`, { decision: 'APPROVE' });
    expect(decision.status).toBe(200);
  }

  quote(total = 150_000, upfront = 60_000, invoiceNumber = `INV-${Math.floor(Math.random() * 1e6)}`) {
    return {
      diagnosisReportUrl: 'https://files.test/d.pdf', scanReportUrl: 'https://files.test/s.pdf', documentUrl: 'https://files.test/i.pdf',
      issueTypes: ['BRAKING'], invoiceNumber, upfrontAmount: upfront, totalAmount: total,
      lineItems: [
        { description: 'Front Brake Pads', quantity: 2, unitAmount: (total - 10_000) / 2, condition: 'NEW', categoryCode: 'BRAKING' },
        { description: 'Labour', quantity: 1, unitAmount: 10_000, categoryCode: 'LABOUR' },
      ],
    };
  }

  async toQuoteApproved(id: number, token: string, total?: number, upfront?: number) {
    await this.toDiagnosis(id, token);
    const up = await this.call('POST', `/v1/claims/${id}/quotes`, this.quote(total, upfront));
    expect(up.status).toBe(201);
    const approval = await this.approvalFor(id, 'QUOTE');
    const res = await this.call('POST', `/v1/approvals/${approval.id}/decision`, { decision: 'APPROVE' });
    expect(res.status).toBe(200);
    return res.data;
  }
}
