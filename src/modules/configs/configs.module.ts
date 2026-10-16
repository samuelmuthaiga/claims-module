import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DB_ENABLED } from '../../config/database.config';
import { ConfigsController } from './controllers/configs.controller';
import { ConfigsService } from './services/configs.service';
import { ConfigMetadataValidator } from './services/config-metadata.validator';
import { FormConfig } from './entities/config.entity';

@Module({
  imports: [TypeOrmModule.forFeature(DB_ENABLED ? [FormConfig] : [])],
  controllers: [ConfigsController],
  providers: [ConfigsService, ConfigMetadataValidator],
  exports: [ConfigsService, ConfigMetadataValidator],
})
export class ConfigsModule {}
