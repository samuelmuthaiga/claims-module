import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';
import { Payment } from './entities/payment.entity';

// Simulates an unavailable DB so services exercise their mock-data fallback.
const mockRepository = () => ({
  find: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  findAndCount: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  findOne: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  count: jest.fn().mockRejectedValue(new Error('DB unavailable')),
});

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useFactory: mockRepository,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSummary', () => {
    it('should return payments summary', async () => {
      const result = await controller.getSummary();
      expect(result.data).toHaveProperty('pending');
      expect(result.data).toHaveProperty('approved');
      expect(result.data).toHaveProperty('paid');
      expect(result.data).toHaveProperty('totalAmount');
      expect(result.data).toHaveProperty('currency');
    });
  });

  describe('getQuotes', () => {
    it('should return payment quotes', async () => {
      const result = await controller.getQuotes({ page: 1, limit: 10 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('requestPayment', () => {
    it('should request payment', async () => {
      const result = await controller.requestPayment({
        amount: 450000,
        currency: 'NGN',
        reason: 'Test payment',
      });
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('amount');
      expect(result.data).toHaveProperty('status');
    });
  });

  describe('actionPayment', () => {
    it('should action payment', async () => {
      const result = await controller.actionPayment({
        id: 1,
        action: 'APPROVED' as any,
        reason: 'Test action',
      });
      expect(result.data).toHaveProperty('status');
      expect(result.data.status).toBe('APPROVED');
    });
  });
});
