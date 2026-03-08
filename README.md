# @rubiklabs/nestjs-jacpol-prisma

Prisma adapter for [@rubiklabs/nestjs-jacpol](https://www.npmjs.com/package/@rubiklabs/nestjs-jacpol). Stores JACPoL PolicySet and Policy in your database via Prisma.

## Installation

```bash
npm install @rubiklabs/nestjs-jacpol-prisma @rubiklabs/nestjs-jacpol @prisma/client
```

## Schema

Add the following models to your Prisma schema (e.g. `prisma/schema.prisma`). The file `prisma/schema.prisma` in this package is a reference you can copy from.

```prisma
model PolicySet {
  id        String   @id
  target    Json?
  algorithm String?
  priority  Int?
  obligation Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  policies  Policy[]
}

model Policy {
  id           String   @id
  policySetId String
  policySet   PolicySet @relation(fields: [policySetId], references: [id], onDelete: Cascade)
  target      Json?
  rules       Json      // Rule[] as JSON
  algorithm   String?
  priority    Int?
  obligation  Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([policySetId])
}
```

Then run:

```bash
npx prisma generate
```

## Usage

### With JacpolModule

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { JacpolModule } from '@rubiklabs/nestjs-jacpol';
import { JacpolPrismaModule } from '@rubiklabs/nestjs-jacpol-prisma';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    JacpolModule.forRoot({
      redis: { host: 'localhost', port: 6379 }, // optional PRP cache
    }),
    JacpolPrismaModule.forRoot({
      client: new PrismaService(), // or inject
    }),
  ],
})
export class AppModule {}
```

### Async (inject PrismaService)

```typescript
JacpolPrismaModule.forRootAsync({
  imports: [YourPrismaModule],
  inject: [PrismaService],
  useFactory: (prisma: PrismaService) => ({
    client: prisma,
  }),
}),
```

When `JacpolPrismaModule` is imported after `JacpolModule`, the Prisma adapter becomes the policy store (Redis, if configured, remains the PRP cache).

## API

- **PrismaAdapter** – Implements `IPolicyAdapter`; accepts `{ client: JacpolPrismaClient }`.
- **JacpolPrismaModule** – `forRoot({ client })` / `forRootAsync({ useFactory, inject })`.

Your `PrismaClient` must have been generated from a schema that includes the `PolicySet` and `Policy` models above.
