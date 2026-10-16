import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DB_ENABLED } from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClaimsModule } from './modules/claims/claims.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ConfigsModule } from './modules/configs/configs.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // TypeORM connects only when DB_ENABLED=true — while the platform team's
    // database is unavailable the service runs on mock data instead.
    ...(DB_ENABLED
      ? [
          TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            username: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'claims',
            ssl: process.env.DB_SSL === 'true',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            migrations: [__dirname + '/database/migrations/*.ts'],
            synchronize: false, // Set to true ONLY for development to auto-create tables
            logging: process.env.NODE_ENV === 'development',
          }),
        ]
      : []),
    ClaimsModule,
    LookupsModule,
    ApprovalsModule,
    PaymentsModule,
    ConfigsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
