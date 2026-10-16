import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DB_ENABLED } from '../../config/database.config';
import { ApprovalsController } from './controllers/approvals.controller';
import { ApprovalsService } from './services/approvals.service';
import { Approval } from './entities/approval.entity';

@Module({
  imports: [TypeOrmModule.forFeature(DB_ENABLED ? [Approval] : [])],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
