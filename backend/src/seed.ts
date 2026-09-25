import { PrismaClient } from '@prisma/client';
import { enabledModuleIds } from './modules.enabled';
import { seedDemoUsers, seedOwner, type ModuleSeed, type SeedContext } from './core/seed/core.seed';
import { seedEcommerce } from './modules/ecommerce/prisma/ecommerce.seed';

// Seed composition root (E9e5). Core's seed always runs; each ENABLED module's
// seed runs after it, in registry order — the same generated ids that compose
// the Nest application (modules.enabled.ts, E9a). Like MODULE_CLASSES in
// modules.composition.ts, this map is code and the registry stays data: a
// registered but disabled module's seed is compiled and never run, and a
// removed module leaves this map together with its directory. A module
// without a seed simply has no entry.
//
// start.sh runs the compiled entry (dist/seed.js) on every container boot:
// demo users and the sample catalogue are NEVER seeded unless SEED_DEMO_DATA is
// explicitly 'true', so an ungated demo admin cannot be recreated after every
// deploy.
const MODULE_SEEDS: Record<string, ModuleSeed> = {
  ecommerce: seedEcommerce,
};

export async function runSeed(
  prisma: PrismaClient,
  { env = process.env, modules = enabledModuleIds }: { env?: NodeJS.ProcessEnv; modules?: readonly string[] } = {},
) {
  const ctx: SeedContext = { env, demo: env.SEED_DEMO_DATA === 'true' };

  await seedOwner(prisma, env);

  if (!ctx.demo) {
    console.log('SEED_DEMO_DATA is not "true" — skipping demo users and sample catalogue.');
  } else {
    console.warn('SEED_DEMO_DATA=true — seeding demo accounts with well-known passwords. Never enable this in production.');
    await seedDemoUsers(prisma);
  }

  for (const id of modules) {
    const seed = MODULE_SEEDS[id];
    if (seed) await seed(prisma, ctx);
  }
}

// Only when executed directly (npm run seed, start.sh) — importing this file
// creates no client and seeds nothing.
if (require.main === module) {
  const prisma = new PrismaClient();
  runSeed(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
