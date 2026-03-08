import { PrismaAdapter } from '../src/prisma.adapter';
import type { JacpolPrismaClient } from '../src/prisma.types';

function createMinimalMock(): JacpolPrismaClient {
  const policySets = new Map<string, any>();
  const policies = new Map<string, any>();
  const client: JacpolPrismaClient = {
    policySet: {
      findUnique: async ({ where }: any) => {
        const ps = policySets.get(where.id);
        if (!ps) return null;
        return { ...ps, policies: Array.from(policies.values()).filter((p: any) => p.policySetId === ps.id) };
      },
      findMany: async () =>
        Array.from(policySets.values()).map((ps) => ({
          ...ps,
          policies: Array.from(policies.values()).filter((p: any) => p.policySetId === ps.id),
        })),
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const { policies: pRef, ...ps } = data;
        const pList = pRef?.create ?? (Array.isArray(pRef) ? pRef : []);
        policySets.set(ps.id, { ...ps });
        for (const p of pList) {
          policies.set(p.id, { ...p, policySetId: ps.id });
        }
        return { ...ps, policies: pList };
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = policySets.get(where.id);
        const row = existing ? { ...existing, ...update } : { ...create };
        policySets.set(where.id, row);
        return row;
      },
      update: async () => ({}),
      delete: async ({ where }: any) => {
        policySets.delete(where.id);
      },
      deleteMany: async ({ where }: any) => {
        if (where?.policySetId) {
          for (const [k, v] of policies.entries()) if (v.policySetId === where.policySetId) policies.delete(k);
        }
      },
    },
    policy: {
      findUnique: async ({ where }: any) => policies.get(where.id) ?? null,
      findMany: async ({ where }: any) =>
        where?.id?.in ? where.id.in.map((id: string) => policies.get(id)).filter(Boolean) : [],
      create: async ({ data }: any) => {
        policies.set(data.id, data);
        return data;
      },
      update: async ({ where, data }: any) => {
        const p = policies.get(where.id);
        if (p) policies.set(where.id, { ...p, ...data });
        return policies.get(where.id);
      },
      delete: async ({ where }: any) => {
        policies.delete(where.id);
      },
      deleteMany: async ({ where }: any) => {
        if (where?.policySetId) {
          for (const [k, v] of policies.entries()) if (v.policySetId === where.policySetId) policies.delete(k);
        }
      },
      upsert: async () => ({}),
    },
    $transaction: async (fn) => fn(client),
  };
  return client as unknown as JacpolPrismaClient;
}

describe('PrismaAdapter', () => {
  let adapter: PrismaAdapter;
  let client: JacpolPrismaClient;

  const samplePolicySet: import('@rubiklabs/nestjs-jacpol').PolicySet = {
    id: 'prisma-ps1',
    target: { 'resource.type': { equalsTo: 'document' } },
    algorithm: 'denyOverrides',
    policies: [
      { id: 'prisma-p1', rules: [{ id: 'r1', effect: 'permit' }] },
    ],
  };

  beforeEach(() => {
    client = createMinimalMock();
    adapter = new PrismaAdapter({ client });
  });

  it('instantiates with client', () => {
    expect(adapter).toBeDefined();
  });

  it('saves and retrieves policy set', async () => {
    await adapter.savePolicySet(samplePolicySet);
    const got = await adapter.getPolicySet('prisma-ps1');
    expect(got?.id).toBe('prisma-ps1');
    expect(got?.policies).toHaveLength(1);
    expect(got?.policies?.[0].rules?.[0].effect).toBe('permit');
  });

  it('getPolicySet returns null for missing id', async () => {
    expect(await adapter.getPolicySet('missing')).toBeNull();
  });

  it('getAllPolicySets returns sets with policies', async () => {
    await adapter.savePolicySet(samplePolicySet);
    const all = await adapter.getAllPolicySets();
    expect(all.length).toBeGreaterThanOrEqual(1);
    const ps = all.find((p) => p.id === 'prisma-ps1');
    expect(ps?.policies?.length).toBeGreaterThanOrEqual(1);
  });

  it('getPolicy returns policy by id', async () => {
    await adapter.savePolicySet(samplePolicySet);
    const p = await adapter.getPolicy('prisma-p1');
    expect(p?.id).toBe('prisma-p1');
  });

  it('upsertPolicySet overwrites policies', async () => {
    await adapter.savePolicySet(samplePolicySet);
    await adapter.upsertPolicySet({
      id: 'prisma-ps1',
      policies: [{ id: 'prisma-p2', rules: [{ id: 'r2', effect: 'deny' }] }],
    });
    const got = await adapter.getPolicySet('prisma-ps1');
    expect(got?.policies).toHaveLength(1);
    expect(got?.policies?.[0].id).toBe('prisma-p2');
  });

  it('deletePolicySet removes set and policies', async () => {
    await adapter.savePolicySet(samplePolicySet);
    await adapter.deletePolicySet('prisma-ps1');
    expect(await adapter.getPolicySet('prisma-ps1')).toBeNull();
  });

  it('healthCheck returns true when client responds', async () => {
    expect(await adapter.healthCheck()).toBe(true);
  });
});
