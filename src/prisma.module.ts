/**
 * NestJS module to register the Prisma adapter with JacpolModule.
 */

import { DynamicModule, Module } from '@nestjs/common';
import { JACPOL_ADAPTER } from '@rubiklabs/nestjs-jacpol';
import { PrismaAdapter } from './prisma.adapter';
import type { JacpolPrismaClient } from './prisma.types';

export interface JacpolPrismaModuleOptions {
  /** PrismaClient instance (schema must include PolicySet and Policy). */
  client: JacpolPrismaClient;
}

/**
 * Import after JacpolModule.forRoot() to use the Prisma adapter as the policy store.
 */
@Module({})
export class JacpolPrismaModule {
  static forRoot(options: JacpolPrismaModuleOptions): DynamicModule {
    const adapter = new PrismaAdapter({ client: options.client });
    return {
      module: JacpolPrismaModule,
      global: true,
      providers: [{ provide: JACPOL_ADAPTER, useValue: adapter }],
      exports: [JACPOL_ADAPTER],
    };
  }

  static forRootAsync(options: {
    imports?: any[];
    useFactory: (...args: any[]) => JacpolPrismaModuleOptions | Promise<JacpolPrismaModuleOptions>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: JacpolPrismaModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: JACPOL_ADAPTER,
          useFactory: async (...args: any[]) => {
            const opts = await options.useFactory(...args);
            return new PrismaAdapter({ client: opts.client });
          },
          inject: options.inject ?? [],
        },
      ],
      exports: [JACPOL_ADAPTER],
    };
  }
}
