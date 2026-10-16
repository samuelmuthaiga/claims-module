import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ConfigsController } from './controllers/configs.controller';
import { ConfigContextService } from './services/config-context.service';
import { ConfigMetadataValidator } from './services/config-metadata.validator';
import { ConfigsService } from './services/configs.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ConfigsController],
  providers: [ConfigsService, ConfigContextService, ConfigMetadataValidator],
  exports: [ConfigsService, ConfigContextService, ConfigMetadataValidator],
})
export class ConfigsModule {}
