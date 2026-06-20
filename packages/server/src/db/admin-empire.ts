import { db } from './client.js';

const ADMIN_EMAIL = 'admin@merchantrealms.dev';

// Empire ID never changes after seeding, so cache it permanently.
// goldBalance and other mutable fields are NOT cached here — queries
// that need them fetch the empire row directly using this cached id.
let cachedId: string | null = null;

export async function getAdminEmpireId(): Promise<string> {
  if (cachedId) return cachedId;
  const player = await db.player.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!player) throw new Error('Admin player not found — run pnpm db:seed first');
  const empire = await db.empire.findUnique({ where: { playerId: player.id } });
  if (!empire) throw new Error('Admin empire not found — run pnpm db:seed first');
  cachedId = empire.id;
  return cachedId;
}

// Bust the cache if the seed script recreates the empire (dev workflow).
export function clearAdminEmpireCache(): void {
  cachedId = null;
}
