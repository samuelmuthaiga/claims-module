import { Module } from '@nestjs/common';
import { LookupsController } from './controllers/lookups.controller';
import { LookupsService } from './services/lookups.service';

@Module({
  controllers: [LookupsController],
  providers: [LookupsService],
  exports: [LookupsService],
})
export class LookupsModule {}
