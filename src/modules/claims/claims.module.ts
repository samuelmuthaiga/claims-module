import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ClaimWorkflowModule } from '../claim-workflow/claim-workflow.module';
import { ConfigsModule } from '../configs/configs.module';
import { ClaimsController } from './controllers/claims.controller';
import { ClaimsService } from './services/claims.service';

@Module({
  imports: [ClaimWorkflowModule, ConfigsModule, AuditLogsModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
