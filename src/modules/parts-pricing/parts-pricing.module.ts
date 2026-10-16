import { Module } from '@nestjs/common';
import { PartsPricingController } from './controllers/parts-pricing.controller';
import { PartsPricingService } from './services/parts-pricing.service';

@Module({
  controllers: [PartsPricingController],
  providers: [PartsPricingService],
  exports: [PartsPricingService],
})
export class PartsPricingModule {}
