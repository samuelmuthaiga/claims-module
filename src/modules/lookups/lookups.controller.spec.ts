import { Test, TestingModule } from '@nestjs/testing';
import { LookupsController } from './controllers/lookups.controller';
import { LookupsService } from './services/lookups.service';

describe('LookupsController', () => {
  let controller: LookupsController;
  let service: LookupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LookupsController],
      providers: [LookupsService],
    }).compile();

    controller = module.get<LookupsController>(LookupsController);
    service = module.get<LookupsService>(LookupsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchCars', () => {
    it('should return cars', async () => {
      const result = await controller.searchCars('CUSTOMER_NAME', 'Jane');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('getEnums', () => {
    it('should return enums', async () => {
      const result = await controller.getEnums();
      expect(result.data).toHaveProperty('claimType');
      expect(result.data).toHaveProperty('claimStatus');
      expect(result.data).toHaveProperty('warrantyType');
    });
  });

  describe('getCountries', () => {
    it('should return countries', async () => {
      const result = await controller.getCountries();
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('getVendors', () => {
    it('should return vendors', async () => {
      const result = await controller.getVendors();
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });
});
