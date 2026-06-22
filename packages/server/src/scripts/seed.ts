import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ResourceType, KEEP_DEFAULT_BUILDING_SLOTS, KEEP_BASE_STORAGE, MULE_CAPACITY_KG } from '@merchant-realms/shared';

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

// 6 fixed offsets in absolute map units from a district center
const PLOT_OFFSETS: [number, number][] = [
  [10, 0], [5, 9], [-5, 9], [-10, 0], [-5, -9], [5, -9],
];

// ── District name pools (sorted by region) ────────────────────────────────────
// Counts calibrated to actual district counts per region:
//   CENTRAL=18, NE(Reach)=68, NW(Wold)=68, SW(Vale)=64, SE(Mere)=64

const DISTRICT_NAMES: Record<string, string[]> = {
  // the Crown — -gate / -stow / -wick
  CENTRAL: [
    'Goldgate',     'Silvergate',   'Irongate',     'Coppergate',
    'Mintgate',     'Marketgate',   'Guildgate',    'Tollgate',
    'Courtgate',    'Bridgegate',   'Wardgate',     'Bellgate',
    'Marketstow',   'Tradestow',    'Charterstow',  'Weighstow',
    'Goldwick',     'Tradewick',
  ],

  // the Reach — -ford / -by / -reach
  NE: [
    // -ford (25)
    'Ashford',    'Ironford',   'Coalford',   'Stormford',  'Wolfford',
    'Hawkford',   'Reedford',   'Greyford',   'Millford',   'Coldford',
    'Stoneford',  'Ramford',    'Frostford',  'Dustford',   'Blastford',
    'Saltford',   'Thornford',  'Ridgeford',  'Shaleford',  'Scarford',
    'Cragford',   'Grimford',   'Brineford',  'Murkford',   'Rawford',
    // -by (25)
    'Ironby',     'Ashby',      'Coalby',     'Stormby',    'Wolfby',
    'Crowby',     'Ravenby',    'Coldby',     'Frostby',    'Dustby',
    'Galeby',     'Windby',     'Stagby',     'Bearby',     'Boarby',
    'Foxby',      'Hawkby',     'Boulderby',  'Gritby',     'Blastby',
    'Cragby',     'Grimby',     'Brineby',    'Murkby',     'Rawby',
    // -reach (18)
    'Ironreach',  'Coalreach',  'Ashreach',   'Stormreach', 'Coldreach',
    'Frostreach', 'Wolfreach',  'Ravenreach', 'Greyreach',  'Dustreach',
    'Galereach',  'Windreach',  'Scarreach',  'Cliffreach', 'Boulderreach',
    'Blastreach', 'Saltreach',  'Thornreach',
  ],

  // the Wold — -shaw / -hurst / -wold
  NW: [
    // -shaw (25)
    'Oakshaw',      'Elmshaw',      'Birchshaw',    'Yewshaw',      'Thornshaw',
    'Briarshaw',    'Ivyshaw',      'Fernshaw',     'Brackenshaw',  'Heathershaw',
    'Gorseshaw',    'Whinshaw',     'Brakeshaw',    'Gladeshaw',    'Clearshaw',
    'Tangleshaw',   'Ashshaw',      'Willowshaw',   'Holmshaw',     'Brambleshaw',
    'Aldershaw',    'Rowanshaw',    'Hazelshaw',    'Sloeshaw',     'Spinneyshaw',
    // -hurst (25)
    'Oakhurst',     'Elmhurst',     'Birchhurst',   'Yewhurst',     'Thornhurst',
    'Briarhurst',   'Ivyhurst',     'Fernhurst',    'Brackenhurst', 'Heatherhurst',
    'Gorsehurst',   'Whinhurst',    'Brakehurst',   'Clearhurst',   'Mosshurst',
    'Ashurst',      'Greenhurst',   'Craghurst',    'Bramblehurst', 'Gloomhurst',
    'Alderhurst',   'Rowanhurst',   'Hazelhurst',   'Sloehurst',    'Spineyhurst',
    // -wold (18)
    'Oakwold',      'Elmwold',      'Thornwold',    'Briarwold',    'Fernwold',
    'Greenwold',    'Ashwold',      'Mosswold',     'Heatherwold',  'Gorsewold',
    'Gladewold',    'Ivywold',      'Brackenwold',  'Holmwold',     'Clearwold',
    'Tanglewold',   'Whinwold',     'Brakewold',
  ],

  // the Vale — -ham / -thorpe / -dale
  SW: [
    // -ham (23)
    'Grainham',   'Wheatham',   'Barleyham',  'Ryeham',     'Oatham',
    'Meadowham',  'Fieldham',   'Harvestham', 'Hayham',     'Maltham',
    'Millham',    'Seedham',    'Plowham',    'Gleanham',   'Furrowham',
    'Limeham',    'Cloverham',  'Heronham',   'Swanham',    'Doveham',
    'Foldham',    'Yardham',    'Beanham',
    // -thorpe (20)
    'Grainthorpe','Wheatthorpe','Barleythorpe','Ryethorpe', 'Oatthorpe',
    'Meadowthorpe','Fieldthorpe','Harvestthorpe','Haythorpe','Maltthorpe',
    'Millthorpe', 'Seedthorpe', 'Plowthorpe', 'Gleanthorpe','Herdthorpe',
    'Hawthorpe',  'Lambthorpe', 'Croftthorpe','Swinethorpe','Catthorpe',
    // -dale (21)
    'Graindale',  'Wheatdale',  'Meadowdale', 'Fielddale',  'Harvestdale',
    'Haydale',    'Maltdale',   'Milldale',   'Seeddale',   'Plowdale',
    'Herddale',   'Lambdale',   'Stockdale',  'Cloverdale', 'Dovedale',
    'Swandale',   'Herondale',  'Crestdale',  'Flaxdale',   'Furrowdale',
    'Ryedale',
  ],

  // the Mere — -mere / -holm / -fen
  SE: [
    // -mere (23)
    'Reedmere',   'Rushmere',   'Tidemere',   'Bogmere',    'Fenmere',
    'Marshmere',  'Deepmere',   'Coldmere',   'Greymere',   'Mistmere',
    'Fogmere',    'Darkmere',   'Stillmere',  'Blackmere',  'Silvermere',
    'Glassmere',  'Shallowmere','Saltmere',   'Duskmere',   'Siltmere',
    'Cranmere',   'Plovermere', 'Snipemere',
    // -holm (23)
    'Reedholm',   'Rushholm',   'Tideholm',   'Bogholm',    'Fenholm',
    'Marshholm',  'Deepholm',   'Coldholm',   'Greyholm',   'Mistholm',
    'Fogholm',    'Darkholm',   'Stillholm',  'Blackholm',  'Saltholm',
    'Glassholm',  'Mireholm',   'Siltholm',   'Duckholm',   'Heronholm',
    'Craneholm',  'Ploverholm', 'Snipeholm',
    // -fen (18)
    'Reedfen',    'Rushfen',    'Tidefen',    'Bogfen',     'Marshfen',
    'Deepfen',    'Coldfen',    'Greyfen',    'Mistfen',    'Fogfen',
    'Darkfen',    'Stillfen',   'Blackfen',   'Saltfen',    'Glassfen',
    'Mirefen',    'Duskfen',    'Heronfen',
  ],
};

// ── Seed ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding dev database...');

  // ── Regions ──────────────────────────────────────────────────────────────
  await db.region.upsert({ where: { id: 'CENTRAL' }, create: { id: 'CENTRAL', name: 'the Crown', guildControllable: false }, update: { name: 'the Crown' } });
  await db.region.upsert({ where: { id: 'NE' },      create: { id: 'NE',      name: 'the Reach', guildControllable: true  }, update: { name: 'the Reach' } });
  await db.region.upsert({ where: { id: 'NW' },      create: { id: 'NW',      name: 'the Wold',  guildControllable: true  }, update: { name: 'the Wold'  } });
  await db.region.upsert({ where: { id: 'SW' },      create: { id: 'SW',      name: 'the Vale',  guildControllable: true  }, update: { name: 'the Vale'  } });
  await db.region.upsert({ where: { id: 'SE' },      create: { id: 'SE',      name: 'the Mere',  guildControllable: true  }, update: { name: 'the Mere'  } });
  console.log('  ✓ Regions (the Crown / Reach / Wold / Vale / Mere)');

  // ── Clean slate ───────────────────────────────────────────────────────────
  await db.caravan.deleteMany({});
  await db.keep.deleteMany({});
  await db.warehouseItem.deleteMany({});
  await db.warehouse.deleteMany({});
  await db.plot.deleteMany({});
  await db.district.deleteMany({});

  // ── Build raw districts (q/r/region — no names yet) ───────────────────────
  const rawDistricts = hexesInMap()
    .filter(([q, r]) => !EXCHANGE_HEXES.has(`${q},${r}`))
    .map(([q, r]) => {
      const [x, y] = hexToAbsolute(q, r);
      return { q, r, regionId: getRegionId(q, r), x, y };
    });

  // ── Assign district names (sort by q then r within each region) ───────────
  const byRegion: Record<string, typeof rawDistricts> = {};
  for (const d of rawDistricts) {
    (byRegion[d.regionId] ??= []).push(d);
  }
  for (const list of Object.values(byRegion)) {
    list.sort((a, b) => a.q - b.q || a.r - b.r);
  }
  const nameMap = new Map<string, string>();
  for (const [rid, list] of Object.entries(byRegion)) {
    const pool = DISTRICT_NAMES[rid] ?? [];
    list.forEach((d, i) => {
      nameMap.set(`${d.q},${d.r}`, pool[i] ?? `${rid} District ${i + 1}`);
    });
  }

  // ── Create districts ──────────────────────────────────────────────────────
  const districtRows = rawDistricts.map((d) => ({
    id:               `district-${d.q}-${d.r}`,
    regionId:         d.regionId,
    name:             nameMap.get(`${d.q},${d.r}`)!,
    bonusDescription: 'No special bonus',
    q: d.q, r: d.r, x: d.x, y: d.y,
  }));

  await db.district.createMany({ data: districtRows });

  // ── Create plots (center + ring) ──────────────────────────────────────────
  type PlotRow = {
    id: string; districtId: string; name: string;
    bonusDescription: string; isCenter: boolean; x: number; y: number;
  };
  const plotRows: PlotRow[] = [];

  for (const d of districtRows) {
    // District center — sits at hex center, visually distinct later
    plotRows.push({
      id:               `plot-${d.id}-center`,
      districtId:       d.id,
      name:             `${d.name} District`,
      bonusDescription: 'District center',
      isCenter:         true,
      x:                d.x,
      y:                d.y,
    });

    // Ring plots — offset from center
    const num = plotCount(d.q, d.r);
    for (let i = 0; i < num; i++) {
      const [ox, oy] = PLOT_OFFSETS[i]!;
      plotRows.push({
        id:               `plot-${d.id}-${i + 1}`,
        districtId:       d.id,
        name:             `${d.name} ${i + 1}`,
        bonusDescription: 'No special bonus',
        isCenter:         false,
        x:                Math.round((d.x + ox) * 100) / 100,
        y:                Math.round((d.y + oy) * 100) / 100,
      });
    }
  }

  await db.plot.createMany({ data: plotRows });
  const centerCount  = plotRows.filter((p) => p.isCenter).length;
  const regularCount = plotRows.filter((p) => !p.isCenter).length;
  console.log(`  ✓ ${districtRows.length} districts, ${centerCount} district centers, ${regularCount} ring plots`);

  // ── Admin player + empire ─────────────────────────────────────────────────
  const hash = await bcrypt.hash('admin', 12);
  const admin = await db.player.upsert({
    where:  { email: 'admin@merchantrealms.dev' },
    create: { username: 'Admin', email: 'admin@merchantrealms.dev', passwordHash: hash, isAdmin: true },
    update: { isAdmin: true },
  });
  const adminEmpire = await db.empire.upsert({
    where:  { playerId: admin.id },
    create: { playerId: admin.id, name: 'Admin Empire', goldBalance: 0 },
    update: {},
  });
  console.log('  ✓ Admin player + empire (admin@merchantrealms.dev)');

  // ── Admin starting Keep ───────────────────────────────────────────────────
  const startingPlotId = 'plot-district-1-0-1';
  const adminKeep = await db.$transaction(async (tx) => {
    const wh = await tx.warehouse.create({
      data: { type: 'KEEP', empireId: adminEmpire.id, cap: KEEP_BASE_STORAGE },
    });
    const k = await tx.keep.create({
      data: { empireId: adminEmpire.id, plotId: startingPlotId, name: 'Highwatch Keep', buildingSlotCount: KEEP_DEFAULT_BUILDING_SLOTS, warehouseId: wh.id },
    });
    await tx.warehouseItem.createMany({
      data: [
        { warehouseId: wh.id, resourceType: 'OAK',      quantity: 15 },
        { warehouseId: wh.id, resourceType: 'LIMESTONE', quantity: 15 },
      ],
    });
    return k;
  });
  console.log('  ✓ Admin starting Keep (Highwatch Keep) + 15 OAK + 15 LIMESTONE');

  // ── Starting caravan ──────────────────────────────────────────────────────
  await db.$transaction(async (tx) => {
    const wh = await tx.warehouse.create({
      data: { type: 'CARAVAN', empireId: adminEmpire.id, cap: MULE_CAPACITY_KG },
    });
    await tx.caravan.create({
      data: {
        empireId:     adminEmpire.id,
        name:         'Caravan',
        animalType:   'MULE',
        animalCount:  1,
        locationType: 'KEEP',
        locationId:   adminKeep.id,
        status:       'IDLE',
        warehouseId:  wh.id,
      },
    });
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
  console.log(`  ✓ NPC sell orders (${Object.values(ResourceType).length} resources @ 1 gold)`);

  console.log('\n✅ Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
