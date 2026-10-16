import { Global, Module } from '@nestjs/common';
import { MockDataStore } from './mock-data.store';

@Global()
@Module({
  providers: [MockDataStore],
  exports: [MockDataStore],
})
export class StoreModule {}
