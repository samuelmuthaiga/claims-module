import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { AppConfigService } from './config/app-config.service';

/**
 * Cross-cutting HTTP setup shared by `main.ts` and the end-to-end tests, so
 * tests exercise the same validation, envelope and error shaping as production.
 */
export function setupApp(app: INestApplication): void {
  const { app: cfg } = app.get(AppConfigService).getConfig();

  app.enableCors({
    origin: cfg.corsOrigins.length ? cfg.corsOrigins : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['ETag', 'Location', 'x-request-id', 'Idempotent-Replayed'],
  });
  if (cfg.globalPrefix) app.setGlobalPrefix(cfg.globalPrefix);

  app.useGlobalPipes(createValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(cfg.logStack));
}

export function setupSwagger(app: INestApplication): void {
  const { swagger } = app.get(AppConfigService).getConfig();
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(swagger.title)
      .setDescription(swagger.description)
      .setVersion(swagger.version)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'BearerAuth')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: false });
}
