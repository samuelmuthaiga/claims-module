# Backend-Claims-Service

Backend API service for the Claims Portal, handling vehicle repair, warranty, and insurance claims with Repair QA workflow.

## Tech Stack
- NestJS 10.x
- TypeScript 5.x
- TypeORM 0.3.x
- PostgreSQL 16
- @autochek-africa/pubsub 4.4.0
- @io-orkes/conductor-javascript 2.4.1

## Getting Started

### Prerequisites
- Node.js 24+ (development can use 22.x with warnings)
- PostgreSQL 16
- Redis 7

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Update .env with your local database credentials

4. Build the project:
```bash
npm run build
```

5. Start development server:
```bash
npm run start:dev
```

### Docker Setup

Build and start with Docker Compose:
```bash
docker-compose build
docker-compose up -d
```

View logs:
```bash
docker-compose logs -f backend-claims
```

Stop services:
```bash
docker-compose down
```

## Available Scripts

- `npm run build` - Build the project
- `npm run start` - Start the application
- `npm run start:dev` - Start in development mode with watch
- `npm run start:debug` - Start in debug mode
- `npm run start:prod` - Start in production mode
- `npm run lint` - Run ESLint
- `npm run test` - Run unit tests
- `npm run test:cov` - Run tests with coverage
- `npm run test:watch` - Run tests in watch mode

## Documentation

- [API Specification](docs/BACKEND-API-SPEC.md) - Complete API endpoints specification
- [Open Questions](docs/OPEN-QUESTIONS.md) - Unresolved architectural decisions
- [Performance Analysis](docs/PERFORMANCE-SCALABILITY-ANALYSIS.md) - Performance and scalability analysis
- [Performance Enhancements](docs/PERFORMANCE-ENHANCEMENTS-SUMMARY.md) - Summary of performance improvements
- [Quick Reference Commands](docs/QUICK-REFERENCE-COMMANDS.txt) - Command reference for setup

## Architecture

This service follows the micro-fleetzen-service architecture patterns with:
- Modular NestJS structure
- TypeORM for database operations
- Pub/Sub for event-driven architecture
- JWT authentication (V2)
- Comprehensive observability
- Performance engineering patterns

## Status

**Scaffolding Complete**

- ✅ Project structure created
- ✅ Configuration files set up
- ✅ TypeScript configuration
- ✅ NestJS modules scaffolded
- ✅ Docker configuration
- ✅ Documentation copied
- ⏳ Dependencies to be installed
- ⏳ Feature modules to be implemented
- ⏳ Database entities to be created
- ⏳ Tests to be written

## Next Steps

1. Install dependencies: `npm install`
2. Create database entities per spec section 5.2
3. Implement feature modules (claims, QA, quotes, payments, etc.)
4. Create database migrations
5. Implement authentication guards
6. Write tests to achieve 97% coverage
7. Set up observability (metrics, logging, tracing)

## License

ISC
