/**
 * Minimal Prisma client shape required by PrismaAdapter.
 * Use with PrismaClient after adding PolicySet and Policy models to your schema.
 */

export interface JacpolPrismaDelegate {
  findMany(args?: any): Promise<any[]>;
  findFirst?(args?: any): Promise<any | null>;
  findUnique(args: any): Promise<any | null>;
  create(args: { data: any }): Promise<any>;
  update(args: { where: { id: string }; data: any }): Promise<any>;
  delete(args: { where: { id: string } }): Promise<any>;
  deleteMany(args?: any): Promise<any>;
  upsert?(args: { where: { id: string }; create: any; update: any }): Promise<any>;
}

export interface JacpolPrismaClient {
  policySet: JacpolPrismaDelegate & {
    upsert(args: { where: { id: string }; create: any; update: any }): Promise<any>;
  };
  policy: JacpolPrismaDelegate;
  $transaction<R>(fn: (tx: JacpolPrismaClient) => Promise<R>): Promise<R>;
}
