import { Module } from '@nestjs/common';
import { ConfigsModule } from '../configs/configs.module';
import { LookupsController } from './controllers/lookups.controller';
import { LookupsService } from './services/lookups.service';

@Module({
  imports: [ConfigsModule],
  controllers: [LookupsController],
  providers: [LookupsService],
  exports: [LookupsService],
})
export class LookupsModule {}
