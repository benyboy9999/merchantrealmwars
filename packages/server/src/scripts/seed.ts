import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ResourceType } from '@artemis/shared';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding dev database...');

  // ── Regions ──────────────────────────────────────────────────────────────
  await db.region.upsert({ where: { id: 'CENTRAL' },    create: { id: 'CENTRAL',    name: 'Central Region',    bonusType: 'NONE',       guildControllable: false }, update: {} });
  await db.region.upsert({ where: { id: 'EXTRACTION' }, create: { id: 'EXTRACTION', name: 'Extraction Region', bonusType: 'EXTRACTION', guildControllable: true  }, update: {} });
  await db.region.upsert({ where: { id: 'FARMING' },    create: { id: 'FARMING',    name: 'Farming Region',    bonusType: 'FARMING',    guildControllable: true  }, update: {} });
  await db.region.upsert({ where: { id: 'CRAFTING' },   create: { id: 'CRAFTING',   name: 'Crafting Region',   bonusType: 'CRAFTING',   guildControllable: true  }, update: {} });
  console.log('  ✓ Regions');

  // ── 5 Central Region plots ────────────────────────────────────────────────
  const plotDefs = [
    { id: 'plot-central-a', name: 'Plot A', x: 0, y: 0 },
    { id: 'plot-central-b', name: 'Plot B', x: 1, y: 0 },
    { id: 'plot-central-c', name: 'Plot C', x: 2, y: 0 },
    { id: 'plot-central-d', name: 'Plot D', x: 0, y: 1 },
    { id: 'plot-central-e', name: 'Plot E', x: 1, y: 1 },
  ];
  for (const p of plotDefs) {
    await db.plot.upsert({
      where:  { id: p.id },
      create: { ...p, regionId: 'CENTRAL', bonusDescription: 'No special bonus' },
      update: {},
    });
  }
  console.log('  ✓ 5 plots (Central Region)');

  // ── Admin player + empire ─────────────────────────────────────────────────
  const hash = await bcrypt.hash('admin', 12);
  const admin = await db.player.upsert({
    where:  { email: 'admin@artemis.dev' },
    create: { username: 'Admin', email: 'admin@artemis.dev', passwordHash: hash },
    update: {},
  });
  await db.empire.upsert({
    where:  { playerId: admin.id },
    create: { playerId: admin.id, name: 'Admin Empire', goldBalance: 999999 },
    update: {},
  });
  console.log('  ✓ Admin player + empire (admin@artemis.dev)');

  // ── NPC Exchange sell orders — unlimited T1 at 1 gold ───────────────────
  await db.marketOrder.deleteMany({ where: { empireId: null, regionId: 'CENTRAL' } });
  await db.marketOrder.createMany({
    data: Object.values(ResourceType).map((resourceType) => ({
      empireId:     null,
      regionId:     'CENTRAL',
      orderType:    'SELL' as const,
      resourceType,
      quantity:     999999,
      pricePerUnit: 1,
      fulfilledQty: 0,
      status:       'OPEN' as const,
    })),
  });
  console.log(`  ✓ NPC sell orders (${Object.values(ResourceType).length} T1 resources @ 1 gold)`);

  console.log('\n✅ Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
