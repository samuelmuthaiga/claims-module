import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ClaimWorkflowModule } from '../claim-workflow/claim-workflow.module';
import { ConfigsModule } from '../configs/configs.module';
import { PaymentsModule } from '../payments/payments.module';
import { ApprovalsController } from './controllers/approvals.controller';
import { ApprovalsService } from './services/approvals.service';

@Module({
  imports: [ClaimWorkflowModule, PaymentsModule, ConfigsModule, AuditLogsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
