# Merchant Realms — Economy Outline
*Draft for review — quantities TBD*

---

## The Six Sinks

Everything produced in the economy flows into one or more of these destinations:

| Sink | Description |
|---|---|
| **Consumables** | Worker upkeep per cycle — T1 through T3 (T4 TBD) |
| **Construction** | Building and upgrading Keeps, buildings, permits — tiered material sets |
| **Research** | Tiered items (T1–T3) spent to unlock specialisation levels |
| **Caravans** | Animals and cargo attachments built from crafted components |
| **Combat** | Weapons, armour, siege equipment, combat consumables for guild district battles |
| **Guild Projects** | Large cooperative builds — Guildhalls, Fortifications, Monuments, Trade Posts |

---

## Worker Tier Needs

Worker needs cycle every tick. Cross-specialty dependency is intentional — no single empire should be able to fully self-supply a worker tier.

### T1 — Labourer
| Need | Source | Type |
|---|---|---|
| Basic Ration | Food / Kitchen | Necessary |
| Drinking Water | Food / Pub | Necessary |
| Tools | Crafting / Workshop | Necessary |
| Ale | Food / Pub | Optional |
| Overalls | Crafting / Textile Mill | Optional |
| Pie | Food / Restaurant | Optional |

### T2 — Craftsman
| Need | Source | Type |
|---|---|---|
| Fine Rations | Food / Restaurant | Necessary |
| Filtered Water | Food / Restaurant | Necessary |
| Advanced Tools | Crafting / Workshop | Necessary |
| Overalls | Crafting / Textile Mill | Optional |
| Coffee | Food / Pub | Optional |
| Cheese | Food / Kitchen | Optional |

### T3 — Technician
| Need | Source | Type |
|---|---|---|
| Fine Rations | Food / Restaurant | Necessary |
| Spirits | Food / Distillery | Necessary |
| Advanced Tools | Crafting / Workshop | Necessary |
| Medicine | Alchemy / Apothecary | Necessary |
| Fine Cloth | Crafting / Textile Mill | Optional |
| Wine | Food / Distillery | Optional |
| Coffee | Food / Pub | Optional |

---

## Construction Material Sets

All buildings of a given tier use the same universal material pool.

| Building Tier | Required Materials |
|---|---|
| T1 | Construction Kit + Cobblestone + Amenities |
| T2 | Advanced Construction Kit + Stone Block + Advanced Amenities |
| T3 | Master Construction Kit + Steel Frame + Master Amenities |

---

## Extraction Tree

**Buildings:** Mining Camp · Quarry · Well / T2: Deep Mine · Dressed Quarry

All extraction outputs are **plot-locked** — a resource can only be extracted from a plot that has the matching trait.

### Mining Camp
| Item | Tier | Sinks |
|---|---|---|
| Iron Ore | T1 | Metallurgy |
| Copper Ore | T1 | Metallurgy |
| Aluminium Ore | T1 | Metallurgy |
| Raw Coal | T1 | Alchemy → Coal |

### Quarry
| Item | Tier | Sinks |
|---|---|---|
| Limestone | T1 | Alchemy (Flux, Fertilizer), Construction (Mortar) |
| Sand | T1 | Metallurgy (Glass), Construction (Mortar), Alchemy (Reagent) |
| Stone | T1 | Construction (Cobblestone) |
| Salt | T1 | Food (preservation, cooking), Alchemy |
| Crystal | T2 | Alchemy (Reagent), Research, Guild Projects |

### Well
| Item | Tier | Sinks |
|---|---|---|
| Water | T1 | Farming (irrigation), Food (all drink chains), Alchemy |

**Cross-specialty dependency:** Tools from Crafting → enhanced yield recipe variants

---

## Farming Tree

**Buildings:** Farm · Pasture · Ranch / T2: Hydroponics Lab

Farm outputs are **plot-locked by fertility/crop trait**.

### Farm
| Item | Tier | Sinks |
|---|---|---|
| Grain | T1 | Food (Rations, Ale, Flour, Spirits), Farming (Animal Feed) |
| Vegetables | T1 | Food (Rations, Fine Rations), Research (Basic input) |
| Cotton | T1 | Crafting (Cloth, Canvas, Rope) |
| Oak | T1 | Crafting (Planks, Furniture, Weapons), Construction (Kit) |
| Sugar Beets | T1 | Alchemy (Sugar → Food chain), Farming (Horse feed) |
| Fruit | T1 | Food (Pie, Wine), Alchemy (Dye) |

### Hydroponics Lab *(T2)*
| Item | Tier | Sinks |
|---|---|---|
| Coffee Beans | T2 | Food (Coffee) → T2/T3 optional consumable |
| Walnut | T2 | Alchemy (Walnut Oil), Crafting (Walnut Planks → Fine Furniture) |

### Pasture
| Item | Tier | Sinks |
|---|---|---|
| Mule | T1 | Caravans — light cargo, Pannier only |
| Horse | T1 | Caravans — medium cargo, pulls Cart |
| Ox | T2 | Caravans — heavy cargo, pulls Wagon |

### Ranch
| Item | Tier | Sinks |
|---|---|---|
| Cow | T1 | → Milk, Hide, Meat |
| Chicken | T1 | → Egg, Meat |
| Milk | T1 | Food (Cheese, Pie) |
| Egg | T1 | Food (Pie, Fine Rations) |
| Hide | T1 | Crafting (Leather → Armour, Tools, Saddle, Pannier) |
| Meat | T1 | Food (Fine Rations, Feast) |

**Cross-specialty dependencies:** Fertilizer from Alchemy · Basic Animal Feed from Food

---

## Metallurgy Tree

**Buildings:** Blacksmith / T2: Smelter / T3: Forge

### Blacksmith *(T1)*
| Item | Tier | Sinks |
|---|---|---|
| Iron Bar | T1 | Crafting (Tools, Screws, Wheels, Weapons), Construction (Kit) |
| Copper Bar | T1 | Crafting (Pipe, Wire), Permits, Research |
| Aluminium Bar | T1 | Construction (Truss, Advanced Kit) |
| Glass | T1 | Food (Ale bottles), Construction (Amenities windows) |
| Pipe | T1 | Construction (Amenities, Filtered Water chain), Crafting (Filter) |
| Wire | T1 | Research (Advanced input), Guild Projects (fittings) |

### Smelter *(T2)*
| Item | Tier | Sinks |
|---|---|---|
| Steel Bar | T2 | Crafting (Advanced Tools, Rebar, Wagon), Combat (weapons) |
| Brass Bar | T2 | Crafting (Fine Instruments), Construction (Precision Fittings) |
| Steel Plate | T2 | Guild Fortifications |
| Cast Iron | T2 | Construction (Steel Frame → T3 Kit), Guild Fortifications |

### Forge *(T3)*
| Item | Tier | Sinks |
|---|---|---|
| Masterwork Steel | T3 | Crafting (Masterwork Tools → T3 consumable), Combat (elite weapons) |

**Cross-specialty dependencies:** Coal + Flux from Alchemy (fuel for all smelting) · Crystal from Extraction

---

## Alchemy Tree

**Buildings:** Alchemy Tent / T2: Apothecary / T3: Alchemist Lab

### Alchemy Tent *(T1)*
| Item | Tier | Sinks |
|---|---|---|
| Coal | T1 | Metallurgy (smelting fuel across all recipes) |
| Flux | T1 | Metallurgy (smelting efficiency) |
| Fertilizer | T1 | Farming (yield-boosted recipe variants) |
| Sugar | T1 | Food (Pie, Wine, Spirits) |
| Dye | T1 | Crafting (Fine Cloth) |
| Walnut Oil | T1 | Crafting (Fine Leather), Food (cooking oil in Pie, Feast) |
| Tar | T2 | Construction (waterproofing T2/T3 buildings), Combat (Siege Works input) |

### Apothecary *(T2)*
| Item | Tier | Sinks |
|---|---|---|
| Medicine | T2 | T3 Consumable (necessary) |
| Reagent | T2 | Research (Expert Research input) |

### Alchemist Lab *(T3)*
| Item | Tier | Sinks |
|---|---|---|
| Elixir | T3 | T4 Consumable — necessary (TBD) |
| Advanced Reagent | T3 | Research (Master Research input) |

**Cross-specialty dependencies:** Filtered Water from Food → Medicine · Crystal from Extraction → Reagent · Walnut + Fruit from Farming

---

## Food Tree

**Buildings:** Kitchen · Pub / T2: Restaurant · Distillery / T3: Grand Kitchen

### Kitchen *(T1)*
| Item | Tier | Sinks |
|---|---|---|
| Basic Ration | T1 | T1 Consumable (necessary), Combat (Field Rations input) |
| Basic Animal Feed | T1 | Farming (Pasture/Ranch upkeep) |
| Flour | T1 | Food intermediate — Pie, Fine Rations, Spirits |
| Cheese | T2 | T2/T3 optional consumable, Feast input |

### Pub *(T1)*
| Item | Tier | Sinks |
|---|---|---|
| Drinking Water | T1 | T1 Consumable (necessary) |
| Ale | T1 | T1 Consumable (optional), Research (Basic input), Permits |
| Coffee | T2 | T2/T3 optional consumable |

### Restaurant *(T2)*
| Item | Tier | Sinks |
|---|---|---|
| Fine Rations | T2 | T2 Consumable (necessary), T3 Consumable (necessary) |
| Pie | T2 | T1 optional consumable, T2 optional consumable |
| Filtered Water | T2 | T2 Consumable (necessary), Alchemy (Medicine input) |

### Distillery *(T2)*
| Item | Tier | Sinks |
|---|---|---|
| Wine | T2 | T3 optional consumable, Guild Projects |
| Spirits | T3 | T3 Consumable (necessary) |

### Grand Kitchen *(T3)*
| Item | Tier | Sinks |
|---|---|---|
| Feast | T3 | T4 Consumable — necessary (TBD), Guild Projects |
| Field Rations | T1 | Combat consumable — troops sustained during campaigns |

**Cross-specialty dependencies:** Glass from Metallurgy (Ale) · Sugar from Alchemy (Pie, Wine, Spirits) · Filter from Crafting (Filtered Water) · Salt from Extraction (Cheese, Fine Rations)

---

## Crafting Tree

**Buildings:** Textile Mill · Workshop / T3: Atelier

### Textile Mill *(T1/T2)*
| Item | Tier | Sinks |
|---|---|---|
| Leather | T1 | Tools, Saddle, Pannier, Armour, Parchment intermediate |
| Cloth | T1 | Overalls, Furniture, Canvas, Pannier |
| Parchment | T1 | Research (all tiers input), Permits (all tiers) |
| Overalls | T1 | T1/T2 optional consumable |
| Canvas | T1 | Caravans (Wagon cover), Combat (Siege Works input) |
| Fine Cloth | T2 | T3 optional consumable, Advanced Amenities, Atelier inputs |
| Fine Leather | T2 | Fine Furniture, Atelier inputs |

### Workshop *(T1/T2)*
| Item | Tier | Sinks |
|---|---|---|
| Oak Planks | T1 | Construction Kit, Furniture, Weapon shafts, Caravans |
| Walnut Planks | T1 | Fine Furniture, Research instruments |
| Screws | T1 | Construction Kit, Amenities |
| Tools | T1 | T1 Consumable (necessary), Extraction (yield variant input) |
| Wheels | T1 | Caravans (Cart, Wagon) |
| Rope | T1 | Construction (Kit component), Caravans, Combat (Armoury/Siege Works input) |
| Furniture | T1 | Amenities (T1) |
| Saddle | T1 | Caravans (Horse) |
| Pannier | T1 | Caravans (Mule attachment) |
| Filter | T1 | Food (Filtered Water) |
| Advanced Tools | T2 | T2/T3 Consumable (necessary), Research input |
| Rebar | T2 | Construction (Reinforced Concrete) |
| Truss | T2 | Construction (Advanced Kit) |
| Fine Furniture | T2 | Advanced Amenities |
| Cart | T2 | Caravans — Horse-pulled, medium cargo |
| Wagon | T2 | Caravans — Ox-pulled, heavy cargo |

### Atelier *(T3)*
| Item | Tier | Sinks |
|---|---|---|
| Fine Instruments | T3 | Research (Expert/Master input), Guild Projects (Monument) |
| Luxury Goods | T3 | Guild Projects, Master Amenities, T4 consumable (TBD) |
| Masterwork Tools | T3 | T3/T4 Consumable — necessary (TBD) |

**Cross-specialty dependencies:** Iron/Steel/Copper/Aluminium Bars from Metallurgy · Hide/Cotton/Oak/Walnut from Farming · Dye + Walnut Oil from Alchemy · Coal from Alchemy (Filter)

---

## Construction Tree

**Buildings:** Builder's Yard · Permit Office / T2: Construction Workshop / T3: Master Builder's Yard

### Builder's Yard *(T1)*
| Item | Tier | Sinks |
|---|---|---|
| Mortar | T1 | Cobblestone recipe, T1 buildings |
| Cobblestone | T1 | T1 buildings, Stone Block input |
| Construction Kit | T1 | T1 building construction, building slot unlock |
| Amenities | T1 | T1 building construction, housing |

### Construction Workshop *(T2)*
| Item | Tier | Sinks |
|---|---|---|
| Reinforced Concrete | T2 | Stone Block input, T2 buildings, Guild Fortifications |
| Stone Block | T2 | T2 building construction, Guild Projects |
| Advanced Construction Kit | T2 | T2 building construction, building slot unlock |
| Advanced Amenities | T2 | T2 building construction |

### Master Builder's Yard *(T3)*
| Item | Tier | Sinks |
|---|---|---|
| Steel Frame | T3 | Master Construction Kit input, T3 buildings, Guild Fortifications |
| Precision Fittings | T3 | Master Construction Kit input |
| Master Construction Kit | T3 | T3 building construction |
| Master Amenities | T3 | T3 building construction |

### Permit Office
| Item | Tier | Sinks |
|---|---|---|
| Basic Permit | T1 | Right to establish Keep / build in T1 districts |
| T2 Permit | T2 | Right to build in T2 districts |
| T3 Permit | T3 | Right to build in T3 districts — costs Crystal + Advanced Research |
| T4 Permit | T3 | Right to build in T4 districts — costs Crystal x2 + Expert Research |

**Cross-specialty dependencies:** Iron/Aluminium Bars from Metallurgy · Planks/Screws/Rope/Rebar/Truss from Crafting · Glass/Pipe from Metallurgy · Fine Furniture from Crafting · Ale + Parchment from Food/Crafting (Permits) · Crystal from Extraction (T3/T4 Permits) · Luxury Goods from Crafting (Master Amenities)

---

## Research Tree

**Buildings:** Study / T2: Scriptorium / T3: University

Research items are the only sink spent at **empire level** — not consumed in recipes but in a dedicated tech-unlock action. Higher tier research also requires lower tier research as a recipe input, creating a continuous demand cycle.

### Study *(T1)*
| Item | Recipe Inputs | Sinks |
|---|---|---|
| Basic Research | Parchment + Ale + Vegetables | Tech unlock T1→T2 in any tree; ingredient in Advanced Research |

### Scriptorium *(T2)*
| Item | Recipe Inputs | Sinks |
|---|---|---|
| Advanced Research | Basic Research x2 + Parchment + Wire + Advanced Tools | Tech unlock T2→T3; ingredient in Expert Research; T3 Permits |

### University *(T3)*
| Item | Recipe Inputs | Sinks |
|---|---|---|
| Expert Research | Advanced Research x2 + Parchment + Fine Instruments + Reagent | Tech unlock T3 deepest levels; ingredient in Master Research; T4 Permits |
| Master Research | Expert Research x2 + Fine Instruments + Advanced Reagent + Luxury Goods | Tech unlock T4 (TBD); Guild Projects (Monument, Grand Guildhall) |

Research specialists are critical Exchange suppliers — every empire needs research to progress but few will prioritise producing it.

**Cross-specialty dependencies (intentionally demanding):** Parchment from Crafting (all tiers) · Ale from Food (Basic) · Wire from Metallurgy (Advanced) · Advanced Tools from Crafting (Advanced) · Fine Instruments from Crafting/Atelier (Expert/Master) · Reagent from Alchemy (Expert) · Advanced Reagent from Alchemy (Master) · Luxury Goods from Crafting (Master)

---

## Combat Tree

Combat is a dedicated specialisation — it draws raw inputs from Metallurgy, Crafting, Alchemy, and Food, and assembles them into finished military units. All committed units are **consumed per engagement**, win or lose.

**Buildings:** Armoury *(T1)* · Siege Works *(T2)* · War Forge *(T3)*

### Armoury *(T1)*
| Item | Tier | Inputs | Unit Role |
|---|---|---|---|
| Spear | T1 | Oak Planks + Iron Bar | T1 Footsoldier |
| Bow | T1 | Oak Planks + Rope | T1 Ranged |
| Battering Ram | T1 | Oak Planks x3 + Iron Bar + Rope | T1 Siege |
| Siege Writ | — | Parchment + Advanced Research + Field Rations | Declaration item — consumed on use |

### Siege Works *(T2)*
| Item | Tier | Inputs | Unit Role |
|---|---|---|---|
| Steel Sword | T2 | Steel Bar x2 + Oak Planks | T2 Footsoldier |
| Crossbow | T2 | Oak Planks + Iron Bar + Rope | T2 Ranged |
| Ballista | T2 | Oak Planks + Steel Bar + Rope + Wheels | T2 Siege |

### War Forge *(T3)*
| Item | Tier | Inputs | Unit Role |
|---|---|---|---|
| Elite Weapon | T3 | Masterwork Steel + Walnut Planks | T3 Footsoldier |
| *(T3 Ranged — TBD)* | T3 | TBD | T3 Ranged |
| Siege Equipment | T3 | Oak Planks + Steel Bar + Rope + Wheels | T3 Siege |

### Combat Consumables
| Item | Produced At | Notes |
|---|---|---|
| Field Rations | Grand Kitchen | Troops sustained during campaigns; Siege Writ input |
| Tar | Alchemy Tent | Siege Works input; Guild Fortifications |

**Cross-specialty dependencies:** Iron/Steel Bars + Masterwork Steel from Metallurgy · Oak/Walnut Planks, Rope, Wheels, Canvas, Parchment from Crafting · Tar from Alchemy · Field Rations from Food

---

## Guild Projects

The top of the economy — requiring coordinated production across multiple empires. Quantities TBD.

| Project | Key Inputs |
|---|---|
| **Guildhall** | Stone Block + Advanced Construction Kit + Advanced Amenities + Fine Furniture + Advanced Research |
| **Fortification Wall** | Stone Block + Reinforced Concrete + Steel Frame + Cast Iron + Tar |
| **Trade Post** | Advanced Construction Kit + Brass Bar x2 + Fine Instruments |
| **Monument** | Stone Block + Crystal + Fine Instruments + Master Research + Luxury Goods |
| **Aqueduct** | Pipe (large qty) + Stone Block + Reinforced Concrete + Rope |

---

## Building Index

| Building | Tree | Tier |
|---|---|---|
| Mining Camp | Extraction | T1 |
| Quarry | Extraction | T1 |
| Well | Extraction | T1 |
| Deep Mine | Extraction | T2 |
| Dressed Quarry | Extraction | T2 |
| Farm | Farming | T1 |
| Pasture | Farming | T1 |
| Ranch | Farming | T1 |
| Hydroponics Lab | Farming | T2 |
| Blacksmith | Metallurgy | T1 |
| Smelter | Metallurgy | T2 |
| Forge | Metallurgy | T3 |
| Alchemy Tent | Alchemy | T1 |
| Apothecary | Alchemy | T2 |
| Alchemist Lab | Alchemy | T3 |
| Kitchen | Food | T1 |
| Pub | Food | T1 |
| Restaurant | Food | T2 |
| Distillery | Food | T2 |
| Grand Kitchen | Food | T3 |
| Textile Mill | Crafting | T1 |
| Workshop | Crafting | T1 |
| Atelier | Crafting | T3 |
| Builder's Yard | Construction | T1 |
| Permit Office | Construction | T1 |
| Construction Workshop | Construction | T2 |
| Master Builder's Yard | Construction | T3 |
| Study | Research | T1 |
| Scriptorium | Research | T2 |
| University | Research | T3 |
| Armoury | Combat | T1 |
| Siege Works | Combat | T2 |
| War Forge | Combat | T3 |
| Warehouse | — | T1 |
| Housing | — | T1 |

---

## Open Questions

1. **Caravans — durability model:** Are Saddle, Pannier, Cart, Wagon one-time builds (permanent) or consumables that degrade with use?
2. **Gold as currency:** ~~Resolved~~ — Gold is a pure in-game currency earned through trade, tax, and regional income. It is not mined or refined. Crystal (Quarry T2) has absorbed the rare-material role in high-tier recipes.
3. **Combat — equipment persistence:** ~~Resolved~~ — All committed combat units are consumed per engagement, win or lose (per combat design).
4. **T4 worker tier:** Ready to define needs, or leave TBD?
5. **Permits — permanent vs. ongoing:** A permanent right (pay once, build forever in that tier district) or an ongoing licence (pay per building constructed)?
6. **Region names:** NW, SW, NE, SE outer regions still need in-world names.
