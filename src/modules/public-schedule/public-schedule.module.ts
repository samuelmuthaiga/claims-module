import { Module } from '@nestjs/common';
import { ClaimWorkflowModule } from '../claim-workflow/claim-workflow.module';
import { ConfigsModule } from '../configs/configs.module';
import { PublicScheduleController } from './controllers/public-schedule.controller';
import { PublicScheduleService } from './services/public-schedule.service';

@Module({
  imports: [ClaimWorkflowModule, ConfigsModule],
  controllers: [PublicScheduleController],
  providers: [PublicScheduleService],
})
export class PublicScheduleModule {}
