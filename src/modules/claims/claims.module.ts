import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DB_ENABLED } from '../../config/database.config';
import { ClaimsController } from './controllers/claims.controller';
import { ClaimsService } from './services/claims.service';
import { Claim } from './entities/claim.entity';
import { ClaimStatusHistory } from './entities/claim-status-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(DB_ENABLED ? [Claim, ClaimStatusHistory] : []),
  ],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
