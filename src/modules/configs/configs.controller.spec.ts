import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigsController } from './controllers/configs.controller';
import { ConfigsService } from './services/configs.service';
import { ConfigMetadataValidator } from './services/config-metadata.validator';
import { FormConfig } from './entities/config.entity';

// Simulates an unavailable DB so the service exercises its mock-data fallback.
const mockRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockRejectedValue(new Error('DB unavailable')),
});

describe('ConfigsController', () => {
  let controller: ConfigsController;
  let service: ConfigsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigsController],
      providers: [
        ConfigsService,
        ConfigMetadataValidator,
        {
          provide: getRepositoryToken(FormConfig),
          useFactory: mockRepository,
        },
      ],
    }).compile();

    controller = module.get<ConfigsController>(ConfigsController);
    service = module.get<ConfigsService>(ConfigsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return the seeded form configs', async () => {
      const result = await controller.findAll();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      const keys = result.data.map((c) => c.key);
      expect(keys).toContain('claim-create');
      expect(keys).toContain('claim-scheduling');
      expect(keys).toContain('quote-upload');
      expect(keys).toContain('payment-split');
    });

    it('should filter configs by domain', async () => {
      const result = await controller.findAll('payments');
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((c) => expect(c.domain).toBe('payments'));
    });
  });

  describe('findByKey', () => {
    it('should return a config with sections and fields', async () => {
      const result = await controller.findByKey('claim-create', {});
      expect(result.data.key).toBe('claim-create');
      expect(result.data.metaData).toHaveProperty('sections');

      const sections = result.data.metaData.sections as any[];
      const fields = sections.flatMap((s) => s.fields);
      expect(fields.map((f: any) => f.key)).toContain('claimType');
      expect(fields.map((f: any) => f.key)).toContain('carId');
    });

    it('should merge query params into context', async () => {
      const result = await controller.findByKey('payment-split', {
        quoteTotal: '450000',
        currency: 'NGN',
      });
      expect(result.data.context).toEqual({
        quoteTotal: '450000',
        currency: 'NGN',
      });
    });

    it('should throw NotFoundException for an unknown key', async () => {
      await expect(controller.findByKey('does-not-exist', {})).rejects.toThrow(
        'not found',
      );
    });
  });

  describe('create', () => {
    it('should create a valid config', async () => {
      const result = await controller.create({
        key: 'test-form',
        title: 'Test Form',
        metaData: {
          fields: [
            {
              key: 'notes',
              type: 'text',
              label: 'Notes',
              required: true,
            },
          ],
        },
      });
      expect(result.data.key).toBe('test-form');
      expect(result.data.isActive).toBe(true);
    });

    it('should reject an invalid metaData schema', async () => {
      await expect(
        controller.create({
          key: 'bad-form',
          title: 'Bad Form',
          metaData: {
            fields: [{ key: '', type: 'unknown-type', label: '' }],
          },
        }),
      ).rejects.toThrow();
    });

    it('should reject a duplicate key', async () => {
      await expect(
        controller.create({
          key: 'claim-create',
          title: 'Duplicate',
          metaData: { fields: [{ key: 'x', type: 'text', label: 'X' }] },
        }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('submitValues', () => {
    it('should validate a complete claim-create submission', async () => {
      const result = await controller.submitValues('claim-create', {
        values: {
          claimType: 'WARRANTY',
          warrantyType: 'CASH_WARRANTY',
          requestChannel: 'Phone Call',
          searchType: 'VIN',
          carId: 'car-991',
          customerName: 'Jane Doe',
          customerEmail: 'jane.doe@example.com',
          customerPhone: '+2348012345678',
          initialDetails: 'Customer reports engine noise on cold start.',
        },
      });
      expect(result.data.ok).toBe(true);
      expect(result.data.errors).toHaveLength(0);
      expect(result.data.submission).toBeDefined();
    });

    it('should return field-keyed errors for missing required values', async () => {
      const result = await controller.submitValues('claim-create', {
        values: { claimType: 'REPAIRS' },
      });
      expect(result.data.ok).toBe(false);

      const errorKeys = result.data.errors.map((e) => e.key);
      expect(errorKeys).toContain('requestChannel');
      expect(errorKeys).toContain('carId');
      expect(errorKeys).toContain('initialDetails');
    });

    it('should enforce required_if when the trigger value is present', async () => {
      const result = await controller.submitValues('claim-create', {
        values: { claimType: 'WARRANTY' },
      });
      expect(result.data.ok).toBe(false);
      expect(result.data.errors.map((e) => e.key)).toContain('warrantyType');
    });

    it('should not require warrantyType for non-warranty claims', async () => {
      const result = await controller.submitValues('claim-create', {
        values: { claimType: 'INSURANCE' },
      });
      expect(result.data.errors.map((e) => e.key)).not.toContain(
        'warrantyType',
      );
    });

    it('should enforce the payment-split sum constraint against context', async () => {
      const result = await controller.submitValues('payment-split', {
        values: {
          autochekSplit: 100000,
          customerSplit: 50000,
          insuranceSplit: 0,
          repairFinancingSplit: 0,
        },
        context: { quoteTotal: 450000 },
      });
      expect(result.data.ok).toBe(false);
      expect(result.data.errors[0]?.message).toContain('split');
    });

    it('should accept a payment split that matches the quote total', async () => {
      const result = await controller.submitValues('payment-split', {
        values: {
          autochekSplit: 300000,
          customerSplit: 100000,
          insuranceSplit: 50000,
          repairFinancingSplit: 0,
        },
        context: { quoteTotal: 450000 },
      });
      expect(result.data.ok).toBe(true);
    });

    it('should reject invalid select options', async () => {
      const result = await controller.submitValues('claim-create', {
        values: {
          claimType: 'NOT_A_TYPE',
          requestChannel: 'Phone Call',
          searchType: 'VIN',
          carId: 'car-991',
          customerName: 'Jane Doe',
          customerEmail: 'jane.doe@example.com',
          customerPhone: '+2348012345678',
          initialDetails: 'Customer reports engine noise on cold start.',
        },
      });
      expect(result.data.ok).toBe(false);
      expect(
        result.data.errors.find((e) => e.key === 'claimType'),
      ).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update an existing config', async () => {
      const result = await controller.update('repair-completion', {
        title: 'Complete Repair — v2',
      });
      expect(result.data.title).toBe('Complete Repair — v2');
      expect(result.data.version).toBe(2);
    });

    it('should throw NotFoundException for an unknown key', async () => {
      await expect(
        controller.update('does-not-exist', { title: 'X' }),
      ).rejects.toThrow('not found');
    });
  });
});
