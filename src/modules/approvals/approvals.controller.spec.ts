import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApprovalsController } from './controllers/approvals.controller';
import { ApprovalsService } from './services/approvals.service';
import { Approval } from './entities/approval.entity';

// Simulates an unavailable DB so services exercise their mock-data fallback.
const mockRepository = () => ({
  find: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  findAndCount: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  findOne: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  count: jest.fn().mockRejectedValue(new Error('DB unavailable')),
});

describe('ApprovalsController', () => {
  let controller: ApprovalsController;
  let service: ApprovalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApprovalsController],
      providers: [
        ApprovalsService,
        {
          provide: getRepositoryToken(Approval),
          useFactory: mockRepository,
        },
      ],
    }).compile();

    controller = module.get<ApprovalsController>(ApprovalsController);
    service = module.get<ApprovalsService>(ApprovalsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of approvals', async () => {
      const result = await controller.findAll({ page: 1, limit: 10 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return approvals summary', async () => {
      const result = await controller.getSummary();
      expect(result.data).toHaveProperty('pending');
      expect(result.data).toHaveProperty('approved');
      expect(result.data).toHaveProperty('declined');
      expect(result.data).toHaveProperty('total');
    });
  });

  describe('findOne', () => {
    it('should return a single approval', async () => {
      const result = await controller.findOne('42');
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('status');
      expect(result.data.id).toBe(42);
    });
  });

  describe('submitDecision', () => {
    it('should submit approval decision', async () => {
      const result = await controller.submitDecision('42', {
        decision: 'APPROVED' as any,
        reason: 'Test approval',
      });
      expect(result.data).toHaveProperty('status');
      expect(result.data.status).toBe('APPROVED');
    });
  });
});
