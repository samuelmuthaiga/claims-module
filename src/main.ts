import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Claims Service API')
    .setDescription('Backend API for Claims Portal')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('claims', 'Claims management endpoints')
    .addTag('lookups', 'Lookup endpoints')
    .addTag('approvals', 'Approval management endpoints')
    .addTag('payments', 'Payment management endpoints')
    .addTag('auth', 'Authentication endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(3000);
  console.log(`Application is running on: http://localhost:3000`);
  console.log(`Swagger documentation: http://localhost:3000/docs`);
}
bootstrap();
