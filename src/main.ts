import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp, setupSwagger } from './app.setup';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService).getConfig();
  const logger = new Logger('Bootstrap');

  setupApp(app);
  setupSwagger(app);
  app.enableShutdownHooks();

  if (config.app.disableAuth) {
    logger.warn(`DISABLE_AUTH is on: every request runs as ${config.app.disableAuthUserId} [${config.app.disableAuthUserRoles.join(', ')}]`);
  }
  if (config.database.enabled) {
    logger.warn('DB_ENABLED=true but services still read/write the in-memory store until the repository adapters are implemented');
  }

  await app.listen(config.app.port);
  logger.log(`${config.app.serviceName} running on port ${config.app.port} (${config.app.env}); docs at /docs`);
}

bootstrap();
