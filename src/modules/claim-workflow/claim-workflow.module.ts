import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ConfigsModule } from '../configs/configs.module';
import { ClaimWorkflowService } from './services/claim-workflow.service';

@Module({
  imports: [ConfigsModule, AuditLogsModule],
  providers: [ClaimWorkflowService],
  exports: [ClaimWorkflowService],
})
export class ClaimWorkflowModule {}
