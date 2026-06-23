import { PrismaClient } from '@prisma/client';
import { ResourceType, MULE_CAPACITY_KG, REGION_IDS } from '@merchant-realms/shared';

type MapRegionCode = 'CENTRAL' | 'NE' | 'NW' | 'SW' | 'SE';

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

const REGION_OVERRIDES: Record<string, MapRegionCode> = {
  '0,-3': 'NW', '0,-5': 'NW',
  '0,4':  'SW', '0,6':  'SW',
};

function getRegionCode(q: number, r: number): MapRegionCode {
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

const DISTRICT_NAMES: Record<MapRegionCode, string[]> = {
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

  // ── Regions — manually assigned integer IDs per REGION_IDS ───────────────
  await db.region.upsert({ where: { id: REGION_IDS.CENTRAL }, create: { id: REGION_IDS.CENTRAL, name: 'the Crown', guildControllable: false }, update: { name: 'the Crown' } });
  await db.region.upsert({ where: { id: REGION_IDS.NE },      create: { id: REGION_IDS.NE,      name: 'the Reach', guildControllable: true  }, update: { name: 'the Reach' } });
  await db.region.upsert({ where: { id: REGION_IDS.NW },      create: { id: REGION_IDS.NW,      name: 'the Wold',  guildControllable: true  }, update: { name: 'the Wold'  } });
  await db.region.upsert({ where: { id: REGION_IDS.SW },      create: { id: REGION_IDS.SW,      name: 'the Vale',  guildControllable: true  }, update: { name: 'the Vale'  } });
  await db.region.upsert({ where: { id: REGION_IDS.SE },      create: { id: REGION_IDS.SE,      name: 'the Mere',  guildControllable: true  }, update: { name: 'the Mere'  } });
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
      const regionCode = getRegionCode(q, r);
      return { q, r, regionCode, regionId: REGION_IDS[regionCode], x, y };
    });

  // ── Assign district names (sort by q then r within each region) ───────────
  const byRegion: Record<MapRegionCode, typeof rawDistricts> = { CENTRAL: [], NE: [], NW: [], SW: [], SE: [] };
  for (const d of rawDistricts) {
    byRegion[d.regionCode].push(d);
  }
  for (const list of Object.values(byRegion)) {
    list.sort((a, b) => a.q - b.q || a.r - b.r);
  }
  const nameMap = new Map<string, string>();
  for (const [code, list] of Object.entries(byRegion) as [MapRegionCode, typeof rawDistricts][]) {
    const pool = DISTRICT_NAMES[code] ?? [];
    list.forEach((d, i) => {
      nameMap.set(`${d.q},${d.r}`, pool[i] ?? `${code} District ${i + 1}`);
    });
  }

  // ── Create districts (IDs auto-assigned by DB) ────────────────────────────
  await db.district.createMany({
    data: rawDistricts.map((d) => ({
      regionId:         d.regionId,
      name:             nameMap.get(`${d.q},${d.r}`)!,
      bonusDescription: 'No special bonus',
      q: d.q, r: d.r, x: d.x, y: d.y,
    })),
  });

  // Fetch back with auto-generated IDs, indexed by q,r for plot creation
  const createdDistricts = await db.district.findMany({ select: { id: true, q: true, r: true, name: true } });
  const districtByQR = new Map(createdDistricts.map((d) => [`${d.q},${d.r}`, d]));

  // ── Create plots (center + ring) ──────────────────────────────────────────
  type PlotRow = {
    districtId: number; name: string;
    bonusDescription: string; isCenter: boolean; x: number; y: number;
  };
  const plotRows: PlotRow[] = [];

  for (const d of rawDistricts) {
    const district = districtByQR.get(`${d.q},${d.r}`)!;
    const districtName = district.name;

    // District center
    plotRows.push({
      districtId:       district.id,
      name:             `${districtName} District`,
      bonusDescription: 'District center',
      isCenter:         true,
      x:                d.x,
      y:                d.y,
    });

    // Ring plots
    const num = plotCount(d.q, d.r);
    for (let i = 0; i < num; i++) {
      const [ox, oy] = PLOT_OFFSETS[i]!;
      plotRows.push({
        districtId:       district.id,
        name:             `${districtName} ${i + 1}`,
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
  console.log(`  ✓ ${createdDistricts.length} districts, ${centerCount} district centers, ${regularCount} ring plots`);

  // ── Kieran — admin player + starter empire (Google login) ────────────────
  const kieran = await db.player.upsert({
    where:  { email: 'kieran.benson10@gmail.com' },
    create: { username: 'Kieran', email: 'kieran.benson10@gmail.com', isAdmin: true },
    update: { isAdmin: true },
  });
  const kieranEmpire = await db.empire.upsert({
    where:  { playerId: kieran.id },
    create: { playerId: kieran.id, name: 'Kieran\'s Empire', goldBalance: 1000 },
    update: {},
  });
  await db.$transaction(async (tx) => {
    for (const name of ['Caravan 1', 'Caravan 2']) {
      const wh = await tx.warehouse.create({
        data: { type: 'CARAVAN', empireId: kieranEmpire.id, cap: MULE_CAPACITY_KG },
      });
      await tx.caravan.create({
        data: {
          empireId:     kieranEmpire.id,
          name,
          animalType:   'MULE',
          animalCount:  1,
          locationType: 'EXCHANGE',
          locationId:   REGION_IDS.CENTRAL,
          status:       'IDLE',
          warehouseId:  wh.id,
        },
      });
    }
  });
  console.log('  ✓ Kieran (kieran.benson10@gmail.com) — admin, 1000 gold, 2 caravans at Central Exchange');

  // ── NPC Exchange sell orders — unlimited T1 at 1 gold ────────────────────
  const npcOrders = await db.marketOrder.findMany({ where: { empireId: null, regionId: REGION_IDS.CENTRAL }, select: { id: true } });
  await db.marketTrade.deleteMany({ where: { listingId: { in: npcOrders.map((o) => o.id) } } });
  await db.marketOrder.deleteMany({ where: { empireId: null, regionId: REGION_IDS.CENTRAL } });
  await db.marketOrder.createMany({
    data: Object.values(ResourceType).map((resourceType) => ({
      empireId:     null,
      regionId:     REGION_IDS.CENTRAL,
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
