import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigsModule } from '../modules/configs/configs.module';
import { AuthController } from './controllers/auth.controller';
import { BearerAuthGuard } from './guards/bearer-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [ConfigsModule],
  controllers: [AuthController],
  providers: [
    TokenService,
    AuthService,
    // Order matters: authenticate first, then check permissions.
    { provide: APP_GUARD, useClass: BearerAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
