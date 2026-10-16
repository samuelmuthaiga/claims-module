# Database Setup Guide for Backend Claims Service

> **Beginner-Friendly Step-by-Step Guide**
> Last Updated: 2026-10-16

---

## Prerequisites

Before starting, ensure you have:
- PostgreSQL 16 installed on your machine
- Basic command line knowledge
- Access to the backend-claims project folder

---

## Step 1: Install PostgreSQL

### Option A: Using apt (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql-16 postgresql-contrib-16
```

### Option B: Using Homebrew (macOS)
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Option C: Using Docker (Recommended for Development)
```bash
docker run --name claims-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=claims \
  -p 5432:5432 \
  -d postgres:16
```

### Verify Installation
```bash
# Check PostgreSQL version
psql --version

# Should show: psql (PostgreSQL) 16.x
```

---

## Step 2: Create the Database

### 2.1 Start PostgreSQL Service
```bash
# Linux
sudo service postgresql start

# macOS with Homebrew
brew services start postgresql@16

# Docker (already running if you used Option C)
docker ps
```

### 2.2 Connect to PostgreSQL
```bash
# Connect as postgres user
sudo -u postgres psql

# Or if using Docker
docker exec -it claims-db psql -U postgres
```

### 2.3 Create the Database
```sql
-- Create the claims database
CREATE DATABASE claims;

-- Exit psql
\q
```

### 2.4 Verify Database Creation
```bash
# List all databases
sudo -u postgres psql -l

# Or with Docker
docker exec -it claims-db psql -U postgres -l
```

You should see `claims` in the list.

---

## Step 3: Set Up Environment Variables

### 3.1 Create .env File
```bash
cd /home/muthaiga/Projects-Autochek/backend-claims
cp .env.example .env
```

### 3.2 Edit .env File
Open `.env` in your editor and set these values:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=claims
DB_SSL=false

# Application
NODE_ENV=development
PORT=3000
```

**Note:** If you're using Docker, `DB_HOST` should be `localhost` (Docker maps the port).

---

## Step 4: Enable TypeORM in the Application

### 4.1 Open app.module.ts
```bash
nano src/app.module.ts
# or use your preferred editor
```

### 4.2 Uncomment TypeORM Configuration
Currently, TypeORM is commented out. Remove the comment markers (`//`) to enable it:

**Before:**
```typescript
// TypeOrmModule disabled until database is set up
// TypeOrmModule.forRoot({
//   type: 'postgres',
//   ...
// }),
```

**After:**
```typescript
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
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
}),
```

### 4.3 Add TypeOrmModule to Imports
Make sure `TypeOrmModule` is imported at the top:
```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
```

---

## Step 5: Create Database Entities

### 5.1 Understand What Entities Are
Entities are TypeScript classes that represent your database tables. Each entity maps to a table in PostgreSQL.

### 5.2 Create Base Entity
Create `src/database/entities/base.entity.ts`:

```typescript
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @Column({ default: 1 })
  version: number;
}
```

### 5.3 Create Claim Entity
Create `src/modules/claims/entities/claim.entity.ts`:

```typescript
import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';

@Entity('claims', { schema: 'claims' })
@Index(['country', 'status', 'createdAt'])
export class Claim extends BaseEntity {
  @Column({ name: 'reference', unique: true, length: 24 })
  reference: string;

  @Column({ name: 'job_order_number', unique: true, length: 24 })
  jobOrderNumber: string;

  @Column({ name: 'claim_type', length: 12 })
  claimType: string;

  @Column({ name: 'warranty_type', length: 16, nullable: true })
  warrantyType: string;

  @Column({ name: 'status', length: 40 })
  status: string;

  @Column({ name: 'workflow_config_id' })
  workflowConfigId: number;

  @Column({ name: 'workflow_version' })
  workflowVersion: number;

  @Column({ length: 2 })
  country: string;

  @Column({ length: 3 })
  currency: string;

  @Column({ name: 'customer_id', length: 64 })
  customerId: string;

  @Column({ name: 'car_id', length: 64 })
  carId: string;

  @Column({ name: 'loan_id', length: 64, nullable: true })
  loanId: string;

  @Column({ name: 'warranty_id', length: 64, nullable: true })
  warrantyId: string;

  @Column({ name: 'vendor_id', length: 64, nullable: true })
  vendorId: string;

  @Column({ name: 'customer_snapshot', type: 'jsonb' })
  customerSnapshot: Record<string, any>;

  @Column({ name: 'car_snapshot', type: 'jsonb' })
  carSnapshot: Record<string, any>;

  @Column({ name: 'vendor_snapshot', type: 'jsonb', nullable: true })
  vendorSnapshot: Record<string, any>;

  @Column({ name: 'snapshot_at', type: 'timestamptz' })
  snapshotAt: Date;

  @Column({ name: 'request_channel', length: 16 })
  requestChannel: string;

  @Column({ name: 'initial_details', type: 'text' })
  initialDetails: string;

  @Column({ name: 'issue_sub_type', length: 64, nullable: true })
  issueSubType: string;

  @Column({ name: 'issue_types', type: 'simple-array', nullable: true })
  issueTypes: string[];

  @Column({ nullable: true })
  odometer: number;

  @Column({ name: 'repair_financed', default: false })
  repairFinanced: boolean;

  @Column({ name: 'upfront_amount', type: 'numeric', precision: 18, scale: 4, nullable: true })
  upfrontAmount: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 18, scale: 4, nullable: true })
  totalAmount: number;

  @Column({ name: 'warranty_cap_used', type: 'numeric', precision: 18, scale: 4, default: 0 })
  warrantyCapUsed: number;

  @Column({ name: 'repair_authorized_at', type: 'timestamptz', nullable: true })
  repairAuthorizedAt: Date;

  @Column({ name: 'qa_state', length: 32, nullable: true })
  qaState: string;

  @Column({ name: 'decline_count', default: 0 })
  declineCount: number;

  @Column({ name: 'legacy_status', length: 40, nullable: true })
  legacyStatus: string;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason: string;

  @Column({ name: 'cancelled_by', length: 64, nullable: true })
  cancelledBy: string;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;
}
```

### 5.4 Register Entity in Module
Update `src/modules/claims/claims.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaimsController } from './controllers/claims.controller';
import { ClaimsService } from './services/claims.service';
import { Claim } from './entities/claim.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Claim])],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
```

---

## Step 6: Create Database Schema

### 6.1 Create the Schema
Connect to PostgreSQL and create the schema:

```bash
sudo -u postgres psql -d claims
```

```sql
-- Create the claims schema
CREATE SCHEMA IF NOT EXISTS claims;

-- Exit
\q
```

### 6.2 Alternative: Use Synchronization (Development Only)
For quick setup in development, you can temporarily enable synchronization:

In `src/app.module.ts`, change:
```typescript
synchronize: false,
```
to:
```typescript
synchronize: true,
```

**⚠️ Warning:** Synchronization automatically creates tables from entities. It's great for development but **never use in production**.

---

## Step 7: Test the Database Connection

### 7.1 Build the Application
```bash
cd /home/muthaiga/Projects-Autochek/backend-claims
npm run build
```

### 7.2 Start the Application
```bash
npm run start:dev
```

### 7.3 Check for Connection Logs
You should see logs like:
```
[Nest] INFO [TypeOrmModule] Successfully connected to the database.
```

If you see connection errors, check:
- PostgreSQL is running
- .env file has correct credentials
- Database `claims` exists

---

## Step 8: Update Service to Use Database

### 8.1 Inject Repository into Service
Update `src/modules/claims/services/claims.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaimResponseDto, ClaimSummaryResponseDto, ClaimDetailResponseDto } from '../dto/claim-response.dto';
import { ClaimSummaryResponseDto as ClaimSummaryDto } from '../dto/claim-summary-response.dto';
import { ClaimDetailResponseDto as ClaimDetailDto } from '../dto/claim-detail-response.dto';
import { CreateClaimDto } from '../dto/create-claim.dto';
import { Claim } from '../entities/claim.entity';

@Injectable()
export class ClaimsService {
  constructor(
    @InjectRepository(Claim)
    private claimRepository: Repository<Claim>,
  ) {}

  async findAll(page: number = 1, limit: number = 10) {
    const [data, total] = await this.claimRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: data.map(claim => this.mapToDto(claim)),
      meta: { total, page, limit },
    };
  }

  async getSummary(): Promise<ClaimSummaryResponseDto> {
    const [vehiclesInWorkshop] = await this.claimRepository
      .createQueryBuilder('claim')
      .where('claim.status NOT IN (:...statuses)', {
        statuses: ['VEHICLE_DELIVERED', 'CANCELLED'],
      })
      .getCountAndCount();

    const repair = await this.claimRepository.count({
      where: { claimType: 'REPAIRS' },
    });

    const warranty = await this.claimRepository.count({
      where: { claimType: 'WARRANTY' },
    });

    const insurance = await this.claimRepository.count({
      where: { claimType: 'INSURANCE' },
    });

    return { vehiclesInWorkshop, repair, warranty, insurance };
  }

  async findOne(id: number) {
    const claim = await this.claimRepository.findOne({
      where: { id },
    });

    if (!claim) {
      throw new Error('Claim not found');
    }

    return this.mapToDetailDto(claim);
  }

  async create(createClaimDto: CreateClaimDto) {
    const claim = this.claimRepository.create({
      ...createClaimDto,
      reference: this.generateReference(),
      jobOrderNumber: this.generateJobOrderNumber(),
      status: 'JOB_ORDER_CREATED',
      country: 'NG',
      currency: 'NGN',
      snapshotAt: new Date(),
    });

    const saved = await this.claimRepository.save(claim);
    return this.mapToDto(saved);
  }

  private mapToDto(claim: Claim): ClaimResponseDto {
    // Map entity to DTO
    return {
      id: claim.id,
      reference: claim.reference,
      jobOrderNumber: claim.jobOrderNumber,
      claimType: claim.claimType,
      // ... map all fields
    } as any;
  }

  private mapToDetailDto(claim: Claim): ClaimDetailResponseDto {
    // Map entity to detail DTO
    return {
      id: claim.id,
      reference: claim.reference,
      // ... map all fields
    } as any;
  }

  private generateReference(): string {
    // Generate unique reference
    return `CLM-NG-2026-${String(Math.floor(Math.random() * 10000)).padStart(6, '0')}`;
  }

  private generateJobOrderNumber(): string {
    // Generate unique job order number
    return `JO-NG-2026-${String(Math.floor(Math.random() * 10000)).padStart(6, '0')}`;
  }
}
```

---

## Step 9: Test the Endpoints

### 9.1 Test with curl
```bash
# Test claims list
curl http://localhost:3000/api/v1/claims

# Test claims summary
curl http://localhost:3000/api/v1/claims/summary

# Test create claim
curl -X POST http://localhost:3000/api/v1/claims \
  -H "Content-Type: application/json" \
  -d '{
    "claimType": "WARRANTY",
    "warrantyType": "LOAN_WARRANTY",
    "carId": "car-991",
    "customerPhone": "+2348012345678",
    "requestChannel": "PHONE_CALL",
    "initialDetails": "Test claim"
  }'
```

### 9.2 Check Database
```bash
sudo -u postgres psql -d claims

-- List tables
\dt claims.*

-- Query claims table
SELECT * FROM claims.claims;

-- Exit
\q
```

---

## Step 10: Create Additional Entities (Optional)

Follow the same pattern for other entities:
- Approval entity → `src/modules/approvals/entities/approval.entity.ts`
- Payment entity → `src/modules/payments/entities/payment.entity.ts`
- ClaimStatusHistory entity → `src/modules/claims/entities/claim-status-history.entity.ts`

Reference the full schema in:
`/home/muthaiga/Projects-Autochek/claims/claims/docs/DATABASE-SCHEMAS.md`

---

## Troubleshooting

### Issue: "Connection refused"
**Solution:** Ensure PostgreSQL is running
```bash
sudo service postgresql status
# or
brew services list
```

### Issue: "Database does not exist"
**Solution:** Create the database
```bash
sudo -u postgres psql
CREATE DATABASE claims;
\q
```

### Issue: "Permission denied"
**Solution:** Check your .env credentials match PostgreSQL user

### Issue: "Schema does not exist"
**Solution:** Create the schema
```bash
sudo -u postgres psql -d claims
CREATE SCHEMA claims;
\q
```

---

## Next Steps After Database Setup

1. **Create Migrations** (for production)
   - Learn TypeORM migrations
   - Use `typeorm migration:generate`

2. **Add More Entities**
   - Approval, Payment, etc.
   - Follow the same pattern

3. **Add Relationships**
   - One-to-many, many-to-one
   - Use TypeORM decorators

4. **Disable Synchronization**
   - Set `synchronize: false` in production
   - Use migrations instead

5. **Add Validation**
   - Ensure data integrity
   - Add database constraints

---

## Quick Reference

### Useful PostgreSQL Commands
```bash
# Connect to database
sudo -u postgres psql -d claims

# List databases
\l

# List tables
\dt

# Describe table
\d claims.claims

# Exit
\q
```

### TypeORM Commands
```bash
# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

---

## Need Help?

- Database Schemas: `/home/muthaiga/Projects-Autochek/claims/claims/docs/DATABASE-SCHEMAS.md`
- TypeORM Docs: https://typeorm.io/
- PostgreSQL Docs: https://www.postgresql.org/docs/
