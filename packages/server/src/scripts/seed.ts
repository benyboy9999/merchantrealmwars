import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ResourceType, KEEP_DEFAULT_BUILDING_SLOTS } from '@merchant-realms/shared';

const db = new PrismaClient();

// ── Hex helpers ───────────────────────────────────────────────────────────────

const MAP_UNIT       = 20;
const SQRT3          = Math.sqrt(3);
const MAP_Q_MAX      = 11;
const MAP_Y_HALF     = 420;
const CENTRAL_RADIUS = 2;
const EXCHANGE_HEXES = new Set(['0,0', '6,-6', '-6,0', '-6,6', '6,0']);

function hexDist(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

function hexToAbsolute(q: number, r: number): [number, number] {
  const x = 500 + MAP_UNIT * 1.5 * q;
  const y = 500 + MAP_UNIT * SQRT3 * (r + 0.5 * q);
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

function hexesInMap(): [number, number][] {
  const results: [number, number][] = [];
  const rRange = MAP_Y_HALF / (40 * SQRT3);
  for (let q = -MAP_Q_MAX; q <= MAP_Q_MAX; q++) {
    const rMin = Math.ceil(-rRange - q / 2);
    const rMax = Math.floor(rRange - q / 2);
    for (let r = rMin; r <= rMax; r++) results.push([q, r]);
  }
  return results;
}

const REGION_OVERRIDES: Record<string, string> = {
  '0,-3': 'NW', '0,-5': 'NW',
  '0,4':  'SW', '0,6':  'SW',
};

function getRegionId(q: number, r: number): string {
  if (hexDist(q, r) <= CENTRAL_RADIUS) return 'CENTRAL';
  const key = `${q},${r}`;
  if (REGION_OVERRIDES[key]) return REGION_OVERRIDES[key]!;
  const wx = 1.5 * q;
  const wy = SQRT3 * (r + 0.5 * q);
  if (wx >= 0 && wy <= 0) return 'NE';
  if (wx <  0 && wy <= 0) return 'NW';
  if (wx <  0 && wy >  0) return 'SW';
  return 'SE';
}

// Deterministic plot count per district (4–6)
function plotCount(q: number, r: number): number {
  return 4 + Math.abs(q * 7 + r * 11) % 3;
}

// 6 fixed offsets in absolute map units from a district center (no center plot).
// At MAP_SCALE=2 → world px: [20,0],[10,18],[-10,18],[-20,0],[-10,-18],[10,-18]
const PLOT_OFFSETS: [number, number][] = [
  [10, 0], [5, 9], [-5, 9], [-10, 0], [-5, -9], [5, -9],
];

// Cardinal/positional names for the 6 ring-1 districts
const RING1_NAMES = ['East', 'Northeast', 'Northwest', 'West', 'Southwest', 'Southeast'];

function districtName(q: number, r: number): string {
  const d = hexDist(q, r);
  if (d === 1) {
    const ring1 = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]] as [number,number][];
    const idx = ring1.findIndex(([hq, hr]) => hq === q && hr === r);
    return idx >= 0 ? `${RING1_NAMES[idx]!} Quarter` : `District ${q},${r}`;
  }
  return `District ${q},${r}`;
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding dev database...');

  // ── Regions ──────────────────────────────────────────────────────────────
  await db.region.upsert({ where: { id: 'CENTRAL' }, create: { id: 'CENTRAL', name: 'Central',   guildControllable: false }, update: {} });
  await db.region.upsert({ where: { id: 'NE' },      create: { id: 'NE',      name: 'Northeast', guildControllable: true  }, update: {} });
  await db.region.upsert({ where: { id: 'NW' },      create: { id: 'NW',      name: 'Northwest', guildControllable: true  }, update: {} });
  await db.region.upsert({ where: { id: 'SW' },      create: { id: 'SW',      name: 'Southwest', guildControllable: true  }, update: {} });
  await db.region.upsert({ where: { id: 'SE' },      create: { id: 'SE',      name: 'Southeast', guildControllable: true  }, update: {} });
  console.log('  ✓ Regions (CENTRAL + NE/NW/SW/SE)');

  // ── Clean slate: remove all existing game data so we can rebuild with
  //    coordinate-based IDs and correct region assignments across the full map.
  await db.caravan.deleteMany({});
  await db.resourceLedger.deleteMany({});
  await db.keep.deleteMany({});
  await db.plot.deleteMany({});
  await db.district.deleteMany({});

  // ── Districts + Plots — every non-exchange hex in the full map grid ────────
  const districtRows = hexesInMap()
    .filter(([q, r]) => !EXCHANGE_HEXES.has(`${q},${r}`))
    .map(([q, r]) => {
      const [dx, dy] = hexToAbsolute(q, r);
      return {
        id: `district-${q}-${r}`,
        regionId: getRegionId(q, r),
        name: districtName(q, r),
        bonusDescription: 'No special bonus',
        q, r, x: dx, y: dy,
      };
    });

  await db.district.createMany({ data: districtRows });

  type PlotRow = { id: string; districtId: string; name: string; bonusDescription: string; x: number; y: number };
  const plotRows: PlotRow[] = [];
  for (const d of districtRows) {
    const num = plotCount(d.q, d.r);
    for (let i = 0; i < num; i++) {
      const [ox, oy] = PLOT_OFFSETS[i]!;
      plotRows.push({
        id:               `plot-${d.id}-${i + 1}`,
        districtId:       d.id,
        name:             `${d.name} [${i + 1}]`,
        bonusDescription: 'No special bonus',
        x:                Math.round((d.x + ox) * 100) / 100,
        y:                Math.round((d.y + oy) * 100) / 100,
      });
    }
  }

  await db.plot.createMany({ data: plotRows });
  console.log(`  ✓ ${districtRows.length} districts, ${plotRows.length} plots (all regions)`);

  // ── Admin player + empire ─────────────────────────────────────────────────
  const hash = await bcrypt.hash('admin', 12);
  const admin = await db.player.upsert({
    where:  { email: 'admin@merchantrealms.dev' },
    create: { username: 'Admin', email: 'admin@merchantrealms.dev', passwordHash: hash },
    update: {},
  });
  const adminEmpire = await db.empire.upsert({
    where:  { playerId: admin.id },
    create: { playerId: admin.id, name: 'Admin Empire', goldBalance: 0 },
    update: {},
  });
  console.log('  ✓ Admin player + empire (admin@merchantrealms.dev)');

  // ── Admin starting Keep — first plot of East Quarter (hex 1,0) ────────────
  const startingPlotId = 'plot-district-1-0-1';
  const adminKeep = await db.keep.create({
    data: { empireId: adminEmpire.id, plotId: startingPlotId, name: 'Highwatch Keep', buildingSlotCount: KEEP_DEFAULT_BUILDING_SLOTS },
  });
  for (const [resourceType, quantity] of [['OAK', 15], ['LIMESTONE', 15]] as const) {
    await db.resourceLedger.create({
      data: { keepId: adminKeep.id, resourceType, quantity },
    });
  }
  console.log('  ✓ Admin starting Keep (Highwatch Keep, East Quarter [1]) + 15 WOOD + 15 LIMESTONE');

  // ── Starting caravan ──────────────────────────────────────────────────────
  await db.caravan.create({
    data: {
      empireId:     adminEmpire.id,
      name:         'Caravan',
      animalType:   'MULE',
      animalCount:  1,
      locationType: 'KEEP',
      locationId:   adminKeep.id,
      status:       'IDLE',
    },
  });
  console.log('  ✓ Starting caravan (1 mule, idle at Highwatch Keep)');

  // ── NPC Exchange sell orders — unlimited T1 at 1 gold ────────────────────
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
