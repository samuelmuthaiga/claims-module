import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('ssoLogin', () => {
    it('should return login response', async () => {
      const result = await controller.ssoLogin({ token: 'mock-token' });
      expect(result.data).toHaveProperty('accessToken');
      expect(result.data).toHaveProperty('refreshToken');
      expect(result.data).toHaveProperty('expiresIn');
      expect(result.data).toHaveProperty('user');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const result = await controller.getCurrentUser();
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('email');
      expect(result.data).toHaveProperty('name');
      expect(result.data).toHaveProperty('role');
    });
  });
});
