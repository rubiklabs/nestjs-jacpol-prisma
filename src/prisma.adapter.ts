/**
 * Prisma-backed policy adapter. Implements IPolicyAdapter.
 * PolicySet and Policy models; rules stored as JSON in policy.rules.
 */

import type { IPolicyAdapter } from '@rubiklabs/nestjs-jacpol';
import type { Policy, PolicySet } from '@rubiklabs/nestjs-jacpol';
import type { JacpolPrismaClient } from './prisma.types';

function toJson(val: unknown): object | null {
  if (val == null) return null;
  if (typeof val === 'object') return val as object;
  return null;
}

function fromJson<T>(val: unknown): T | undefined {
  if (val == null) return undefined;
  if (typeof val === 'object') return val as T;
  return undefined;
}

export interface PrismaAdapterOptions {
  /** PrismaClient instance (schema must include PolicySet and Policy models). */
  client: JacpolPrismaClient;
}

/**
 * Adapter that stores PolicySet and Policy via Prisma (PostgreSQL, MySQL, SQLite).
 * Add the models from prisma/schema.prisma to your schema and run prisma generate.
 */
export class PrismaAdapter implements IPolicyAdapter {
  constructor(private readonly options: PrismaAdapterOptions) {}

  private get client(): JacpolPrismaClient {
    return this.options.client;
  }

  /** @inheritdoc */
  async getPolicySet(id: string): Promise<PolicySet | null> {
    const row = await this.client.policySet.findUnique({
      where: { id },
      include: { policies: true },
    });
    if (!row) return null;
    return this.rowToPolicySet(row);
  }

  /** @inheritdoc */
  async getPolicy(id: string): Promise<Policy | null> {
    const row = await this.client.policy.findUnique({ where: { id } });
    if (!row) return null;
    return this.rowToPolicy(row);
  }

  /** @inheritdoc */
  async getAllPolicySets(): Promise<PolicySet[]> {
    const rows = await this.client.policySet.findMany({
      include: { policies: true },
    });
    return rows.map((r) => this.rowToPolicySet(r));
  }

  /** @inheritdoc */
  async getPoliciesByIds(ids: string[]): Promise<Policy[]> {
    if (ids.length === 0) return [];
    const rows = await this.client.policy.findMany({
      where: { id: { in: ids } },
    });
    return rows.map((r) => this.rowToPolicy(r));
  }

  /** @inheritdoc */
  async savePolicySet(policySet: PolicySet): Promise<void> {
    await this.client.policySet.create({
      data: {
        id: policySet.id,
        target: toJson(policySet.target),
        algorithm: policySet.algorithm ?? null,
        priority: policySet.priority ?? null,
        obligation: toJson(policySet.obligation),
        policies: {
          create: (policySet.policies ?? []).map((p) => this.policyToCreate(p)),
        },
      },
    });
  }

  /** @inheritdoc */
  async savePolicy(policy: Policy): Promise<void> {
    const existing = await this.client.policy.findUnique({
      where: { id: policy.id },
      select: { policySetId: true },
    });
    if (!existing) throw new Error(`Policy ${policy.id} not found in any PolicySet`);
    await this.client.policy.update({
      where: { id: policy.id },
      data: this.policyToUpdate(policy),
    });
  }

  /** @inheritdoc */
  async upsertPolicySet(policySet: PolicySet): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.policySet.upsert({
        where: { id: policySet.id },
        create: {
          id: policySet.id,
          target: toJson(policySet.target),
          algorithm: policySet.algorithm ?? null,
          priority: policySet.priority ?? null,
          obligation: toJson(policySet.obligation),
        },
        update: {
          target: toJson(policySet.target),
          algorithm: policySet.algorithm ?? null,
          priority: policySet.priority ?? null,
          obligation: toJson(policySet.obligation),
        },
      });
      await tx.policy.deleteMany({ where: { policySetId: policySet.id } });
      for (const p of policySet.policies ?? []) {
        await tx.policy.create({
          data: {
            ...this.policyToCreate(p),
            policySetId: policySet.id,
          },
        });
      }
    });
  }

  /** @inheritdoc */
  async upsertPolicy(policy: Policy): Promise<void> {
    const existing = await this.client.policy.findUnique({
      where: { id: policy.id },
      select: { policySetId: true },
    });
    if (!existing) return;
    const upsert = this.client.policy.upsert;
    if (upsert) {
      await (upsert as any)({
        where: { id: policy.id },
        create: { ...this.policyToCreate(policy), policySetId: existing.policySetId },
        update: this.policyToUpdate(policy),
      });
    } else {
      await this.client.policy.update({
        where: { id: policy.id },
        data: this.policyToUpdate(policy),
      });
    }
  }

  /** @inheritdoc */
  async deletePolicySet(id: string): Promise<void> {
    await this.client.policy.deleteMany({ where: { policySetId: id } });
    await this.client.policySet.delete({ where: { id } });
  }

  /** @inheritdoc */
  async deletePolicy(id: string): Promise<void> {
    await this.client.policy.delete({ where: { id } });
  }

  /** @inheritdoc */
  async healthCheck(): Promise<boolean> {
    try {
      const findFirst = this.client.policySet.findFirst;
      if (findFirst) {
        await findFirst({ select: { id: true } });
      } else {
        await this.client.policySet.findMany({ take: 1 });
      }
      return true;
    } catch {
      return false;
    }
  }

  private rowToPolicySet(row: any): PolicySet {
    const policies = (row.policies ?? []).map((p: any) => this.rowToPolicy(p));
    return {
      id: row.id,
      target: fromJson(row.target),
      algorithm: row.algorithm ?? undefined,
      priority: row.priority ?? undefined,
      obligation: fromJson(row.obligation),
      policies,
    };
  }

  private rowToPolicy(row: any): Policy {
    return {
      id: row.id,
      target: fromJson(row.target),
      rules: Array.isArray(row.rules) ? row.rules : fromJson(row.rules) ?? [],
      algorithm: row.algorithm ?? undefined,
      priority: row.priority ?? undefined,
      obligation: fromJson(row.obligation),
    };
  }

  private policyToCreate(policy: Policy): Record<string, unknown> {
    return {
      id: policy.id,
      target: toJson(policy.target),
      rules: (policy.rules ?? []) as unknown as object,
      algorithm: policy.algorithm ?? null,
      priority: policy.priority ?? null,
      obligation: toJson(policy.obligation),
    };
  }

  private policyToUpdate(policy: Policy): Record<string, unknown> {
    return {
      target: toJson(policy.target),
      rules: (policy.rules ?? []) as unknown as object,
      algorithm: policy.algorithm ?? null,
      priority: policy.priority ?? null,
      obligation: toJson(policy.obligation),
    };
  }
}
