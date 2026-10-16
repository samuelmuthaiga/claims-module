import 'dotenv/config';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { AppConfigModule } from './config/app-config.module';
import configuration from './config/configuration';
import { DB_ENABLED } from './config/database.config';
import { validationSchema } from './config/validation';
import { HealthModule } from './health/health.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { ClaimWorkflowModule } from './modules/claim-workflow/claim-workflow.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { ConfigsModule } from './modules/configs/configs.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { PartsPricingModule } from './modules/parts-pricing/parts-pricing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PublicScheduleModule } from './modules/public-schedule/public-schedule.module';
import { StoreModule } from './store/store.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    AppConfigModule,
    StoreModule,
    // The standalone claims database connects only when DB_ENABLED=true; until the
    // platform team provisions it, services run on the in-memory store.
    ...(DB_ENABLED
      ? [
          TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432', 10),
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'claims',
            ssl: process.env.DB_SSL === 'true',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
            synchronize: false,
            logging: process.env.NODE_ENV === 'development',
          }),
        ]
      : []),
    AuditLogsModule,
    ConfigsModule,
    AuthModule,
    ClaimWorkflowModule,
    HealthModule,
    LookupsModule,
    ClaimsModule,
    ApprovalsModule,
    PaymentsModule,
    PartsPricingModule,
    PublicScheduleModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
