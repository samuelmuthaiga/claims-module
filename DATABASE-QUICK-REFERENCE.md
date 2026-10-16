# Database Setup - Quick Reference Card

## 🚀 Quick Start (Docker - Recommended)

```bash
# 1. Start PostgreSQL with Docker
docker run --name claims-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=claims \
  -p 5432:5432 \
  -d postgres:16

# 2. Verify it's running
docker ps

# 3. Connect and create schema
docker exec -it claims-db psql -U postgres -d claims
CREATE SCHEMA claims;
\q

# 4. Update .env file
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=claims
DB_SSL=false

# 5. Enable TypeORM in app.module.ts (uncomment the TypeOrmModule.forRoot section)

# 6. Add entity to module (src/modules/claims/claims.module.ts)
imports: [TypeOrmModule.forFeature([Claim])]

# 7. Inject repository in service
constructor(
  @InjectRepository(Claim)
  private claimRepository: Repository<Claim>,
) {}

# 8. Build and run
npm run build
npm run start:dev
```

---

## 📋 Common Commands

### PostgreSQL
```bash
# Connect
docker exec -it claims-db psql -U postgres -d claims

# List databases
\l

# List tables
\dt

# Describe table
\d claims.claims

# Query
SELECT * FROM claims.claims LIMIT 10;

# Exit
\q
```

### Docker
```bash
# Start container
docker start claims-db

# Stop container
docker stop claims-db

# View logs
docker logs claims-db

# Remove container
docker rm -f claims-db
```

### TypeORM
```bash
# Generate migration
npm run migration:generate -- -n AddClaimTable

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

---

## 🔧 Configuration Checklist

- [ ] PostgreSQL installed and running
- [ ] Database 'claims' created
- [ ] Schema 'claims' created
- [ ] .env file configured
- [ ] TypeORM enabled in app.module.ts
- [ ] Entities created
- [ ] Entities registered in modules
- [ ] Repository injected in services
- [ ] Application builds successfully
- [ ] Application connects to database
- [ ] Endpoints tested

---

## 📁 File Locations

```
src/
├── app.module.ts                    # Enable TypeORM here
├── database/
│   └── entities/
│       └── base.entity.ts          # Base entity
├── modules/
│   └── claims/
│       ├── claims.module.ts        # Register entity here
│       ├── entities/
│       │   └── claim.entity.ts     # Entity definition
│       └── services/
│           └── claims.service.ts   # Inject repository here
.env                                # Database credentials
```

---

## ⚠️ Important Notes

1. **Never use `synchronize: true` in production**
2. **Always use migrations for production**
3. **Keep .env file out of git**
4. **Test database connection before proceeding**
5. **Backup database regularly in production**

---

## 🆘 Troubleshooting

| Error | Solution |
|-------|----------|
| Connection refused | Check PostgreSQL is running |
| Database does not exist | `CREATE DATABASE claims;` |
| Schema does not exist | `CREATE SCHEMA claims;` |
| Permission denied | Check .env credentials |
| Entity not found | Register in module with `forFeature` |
| Repository not injected | Import `@InjectRepository` |

---

## 📚 Documentation Links

- Full Guide: `DATABASE-SETUP-GUIDE.md`
- Database Schemas: `/home/muthaiga/Projects-Autochek/claims/claims/docs/DATABASE-SCHEMAS.md`
- TypeORM: https://typeorm.io/
- PostgreSQL: https://www.postgresql.org/docs/
