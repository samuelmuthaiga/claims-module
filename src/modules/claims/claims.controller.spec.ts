import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClaimsController } from './controllers/claims.controller';
import { ClaimsService } from './services/claims.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { Claim } from './entities/claim.entity';
import { ClaimStatusHistory } from './entities/claim-status-history.entity';

// Simulates an unavailable DB so services exercise their mock-data fallback.
const mockRepository = () => ({
  find: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  findAndCount: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  findOne: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  count: jest.fn().mockRejectedValue(new Error('DB unavailable')),
  createQueryBuilder: jest.fn(() => {
    throw new Error('DB unavailable');
  }),
});

describe('ClaimsController', () => {
  let controller: ClaimsController;
  let service: ClaimsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClaimsController],
      providers: [
        ClaimsService,
        {
          provide: getRepositoryToken(Claim),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(ClaimStatusHistory),
          useFactory: mockRepository,
        },
      ],
    }).compile();

    controller = module.get<ClaimsController>(ClaimsController);
    service = module.get<ClaimsService>(ClaimsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of claims', async () => {
      const result = await controller.findAll({ page: 1, limit: 10 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return claims summary', async () => {
      const result = await controller.getSummary();
      expect(result.data).toHaveProperty('vehiclesInWorkshop');
      expect(result.data).toHaveProperty('repair');
      expect(result.data).toHaveProperty('warranty');
      expect(result.data).toHaveProperty('insurance');
    });
  });

  describe('findOne', () => {
    it('should return a single claim', async () => {
      const result = await controller.findOne('1024');
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('reference');
      expect(result.data.id).toBe(1024);
    });
  });

  describe('create', () => {
    it('should create a new claim', async () => {
      const createClaimDto: CreateClaimDto = {
        claimType: 'WARRANTY' as any,
        warrantyType: 'LOAN_WARRANTY' as any,
        carId: 'car-991',
        customerPhone: '+2348012345678',
        requestChannel: 'PHONE_CALL' as any,
        initialDetails: 'Test claim details',
      };
      const result = await controller.create(createClaimDto);
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('reference');
      expect(result.data).toHaveProperty('status');
    });
  });
});
