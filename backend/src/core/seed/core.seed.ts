import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Core's seed (E9e5): the owner bootstrap and the demo accounts. Core models
// only — a module seeds its own models from its own seed, composed by
// src/seed.ts. Nothing here runs on import.

/** What every seed receives from the composition root. */
export interface SeedContext {
  /** The environment the seed reads (OWNER_EMAIL, OWNER_PASSWORD, …). */
  env: NodeJS.ProcessEnv;
  /** SEED_DEMO_DATA === 'true': development fixtures are wanted. */
  demo: boolean;
}

/** A module's seed, registered in src/seed.ts under the module's id. */
export type ModuleSeed = (prisma: PrismaClient, ctx: SeedContext) => Promise<void>;

// Minimum length for a bootstrapped owner password. The owner account holds every
// capability in the system, so a weak one is refused rather than silently accepted.
const MIN_OWNER_PASSWORD_LENGTH = 12;

// Settings are not seeded. Every setting's default lives in its definition
// (Settings Registry, docs/SETTINGS-REGISTRY.md) and SettingsService applies
// it whenever no row exists; a row is written only when the owner saves the
// admin form. Rows that exist are never touched here, so customised values
// survive every seed run.

/**
 * Creates the store's first owner from OWNER_EMAIL / OWNER_PASSWORD.
 *
 * With demo data gated off, this is the only way a production store gets an
 * account that can sign into the admin panel. It is idempotent and safe to run on
 * every container boot: once any ADMIN exists it does nothing, so it can never
 * resurrect a deleted account or reset a live owner's password.
 */
export async function seedOwner(prisma: PrismaClient, env: NodeJS.ProcessEnv) {
  const email = env.OWNER_EMAIL?.trim().toLowerCase();
  const password = env.OWNER_PASSWORD;

  if (!email || !password) {
    const owners = await prisma.user.count({ where: { role: 'admin' } });
    if (owners === 0) {
      console.warn(
        'No owner account exists and OWNER_EMAIL / OWNER_PASSWORD are not set. ' +
        'Nobody can sign into the admin panel. Set both and restart to bootstrap one.',
      );
    }
    return;
  }

  if (password.length < MIN_OWNER_PASSWORD_LENGTH) {
    throw new Error(
      `OWNER_PASSWORD must be at least ${MIN_OWNER_PASSWORD_LENGTH} characters.`,
    );
  }

  const owners = await prisma.user.count({ where: { role: 'admin' } });
  if (owners > 0) {
    console.log('Owner account already exists — leaving it untouched.');
    return;
  }

  // An account may already exist as a CUSTOMER (e.g. the operator shopped first).
  // Promote it rather than failing on the unique email constraint.
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { role: 'admin', passwordHash },
    create: { email, passwordHash, fullName: 'Owner', provider: 'local', role: 'admin' },
  });
  console.log(`Owner account bootstrapped: ${email}`);
  console.warn(
    [
      '',
      '  ┌────────────────────────────────────────────────────────────────┐',
      '  │  ACTION REQUIRED                                               │',
      '  │                                                                │',
      '  │  Remove OWNER_PASSWORD from .env now, then restart.            │',
      '  │                                                                │',
      '  │  The owner account exists, so this bootstrap will not run      │',
      '  │  again. The password is now dead weight in a plaintext file    │',
      '  │  readable by anything with filesystem access to this host.     │',
      '  │                                                                │',
      '  │  Leaving OWNER_EMAIL set is harmless.                          │',
      '  └────────────────────────────────────────────────────────────────┘',
      '',
    ].join('\n'),
  );
}

/** Demo accounts — development only; the caller gates them on SEED_DEMO_DATA. */
export async function seedDemoUsers(prisma: PrismaClient) {
  const [adminHash, userHash] = await Promise.all([
    bcrypt.hash('admin', 12),
    bcrypt.hash('user', 12),
  ]);
  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      passwordHash: adminHash,
      fullName: 'Demo Admin',
      provider: 'local',
      role: 'admin',
    },
  });
  await prisma.user.upsert({
    where: { email: 'user@demo.com' },
    update: {},
    create: {
      email: 'user@demo.com',
      passwordHash: userHash,
      fullName: 'Demo User',
      provider: 'local',
      role: 'customer',
    },
  });
  console.log('Demo data seeded: 2 demo users.');
}
