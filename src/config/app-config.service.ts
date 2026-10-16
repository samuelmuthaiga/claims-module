import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import configuration from './configuration';

export type AppConfig = ReturnType<typeof configuration>;

/** Typed access to the validated environment configuration. */
@Injectable()
export class AppConfigService {
  constructor(
    @Inject(configuration.KEY)
    private readonly config: ConfigType<typeof configuration>,
  ) {}

  getConfig(): AppConfig {
    return this.config;
  }
}
