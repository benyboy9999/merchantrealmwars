// Dev database seed script.
// Run with: pnpm db:seed (from packages/server) or pnpm --filter server db:seed

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding dev database...');

  // Seed the 4 Regions (world data — always present)
  const regions = await Promise.all([
    db.region.upsert({
      where: { id: 'CENTRAL' },
      create: { id: 'CENTRAL', name: 'Central Region', bonusType: 'NONE', guildControllable: false },
      update: {},
    }),
    db.region.upsert({
      where: { id: 'EXTRACTION' },
      create: { id: 'EXTRACTION', name: 'Extraction Region', bonusType: 'EXTRACTION', guildControllable: true },
      update: {},
    }),
    db.region.upsert({
      where: { id: 'FARMING' },
      create: { id: 'FARMING', name: 'Farming Region', bonusType: 'FARMING', guildControllable: true },
      update: {},
    }),
    db.region.upsert({
      where: { id: 'CRAFTING' },
      create: { id: 'CRAFTING', name: 'Crafting Region', bonusType: 'CRAFTING', guildControllable: true },
      update: {},
    }),
  ]);
  console.log(`  ✓ ${regions.length} regions seeded`);

  // Seed plots for Central Region
  const plots = await Promise.all(
    [
      { name: 'Market District', bonusDescription: 'Reduced Exchange fees', x: 0, y: 0 },
      { name: 'Trade Quarter', bonusDescription: 'Faster caravan turnaround', x: 1, y: 0 },
      { name: 'Craftsman Row', bonusDescription: 'Slight production bonus', x: 0, y: 1 },
    ].map((p) =>
      db.plot.upsert({
        where: { id: `plot-central-${p.name.toLowerCase().replace(/\s/g, '-')}` },
        create: { id: `plot-central-${p.name.toLowerCase().replace(/\s/g, '-')}`, regionId: 'CENTRAL', ...p },
        update: {},
      }),
    ),
  );
  console.log(`  ✓ ${plots.length} plots seeded`);

  // Seed a test player + empire + keep
  const passwordHash = await bcrypt.hash('password123', 12);
  const player = await db.player.upsert({
    where: { email: 'test@artemis.dev' },
    create: { username: 'TestPlayer', email: 'test@artemis.dev', passwordHash },
    update: {},
  });

  const empire = await db.empire.upsert({
    where: { playerId: player.id },
    create: { playerId: player.id, name: "Test Player's Empire", goldBalance: 1000 },
    update: {},
  });

  const keep = await db.keep.create({
    data: {
      empireId: empire.id,
      plotId: plots[0]!.id,
      name: 'Starter Keep',
      buildingSlotCount: 4,
    },
  }).catch(() => null); // Ignore if already exists

  console.log(`  ✓ Test player: test@artemis.dev / password123`);
  console.log(`  ✓ Empire: "${empire.name}" (1000 gold)`);
  if (keep) console.log(`  ✓ Keep: "${keep.name}"`);

  // Seed NPC buy orders for basic resources (economy stimulus)
  // Placeholder until resource graph is finalised
  console.log('  ⚠  NPC orders: skipped (resource graph TBD)');

  console.log('\n✅ Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
