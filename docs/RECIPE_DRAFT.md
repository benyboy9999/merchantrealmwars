# Merchant Realms — Recipe Draft
*Design review document — quantities are indicative, not final*

---

## Notes on This Draft

- **Times** are in minutes per cycle at a level-1 building. Speed bonuses scale output up, not time down.
- **Tech level** (`T0/T1/T2`) is the specialisation research level required to unlock the recipe.
- **Two existing recipe changes proposed:**
  - `DRINKING_WATER` — Glass removed (water doesn't need a bottle). New: `Water ×3 → Drinking Water ×4`
  - `ALE` — Glass added (ale is bottled). New: `Grain ×3 + Water ×2 + Glass ×1 → Ale ×4`
- Items marked **[NEW]** are not yet in `gamedata.json`

---

## New Resources Summary

| Resource | Tree | Tier | Purpose |
|---|---|---|---|
| IRON_CONCENTRATE [NEW] | Extraction | T2 | Premium Smelter input, better Steel yield |
| COPPER_CONCENTRATE [NEW] | Extraction | T2 | Premium Smelter input, better Brass yield |
| GOLD_ORE [NEW] | Extraction | T2 | → Gold Bar → Guild Projects, Permits |
| CRYSTAL [NEW] | Extraction | T2 | → Reagent → Research chain |
| CLAY [NEW] | Extraction | T2 | → Construction (Clay Bricks alt), Pottery |
| SALTPETER [NEW] | Extraction | T2 | → Advanced Fertilizer, Combat (Tar upgrade) |
| MARBLE [NEW] | Extraction | T3 | → Guild Projects (Monument, Guildhall) |
| GEM [NEW] | Extraction | T3 | → Cut Gem → Luxury Goods, Guild Projects |
| CUT_GEM [NEW] | Metallurgy | T3 | → Luxury Goods, Fine Instruments |
| OX [NEW] | Farming | T2 | → Caravans (Wagon pull, heaviest load) |
| HOPS [NEW] | Farming | T2 | → Hopped Ale (better yield ale recipe) |
| HEMP [NEW] | Farming | T2 | → Strong Rope, Canvas (higher yield than Cotton) |
| TALLOW [NEW] | Farming | T2 | → Soap (Alchemy), Fine Leather alt (Crafting) |
| FINE_HIDE [NEW] | Farming | T2 | → Fine Leather alt path (no Walnut Oil needed) |
| HONEY [NEW] | Farming | T2 | → Mead, Pie upgrade, Elixir |
| BEESWAX [NEW] | Farming | T2 | → Candles (Research boost), Seals (Permits) |
| SPICES [NEW] | Farming | T3 | → Fine Rations (boosted), Feast |
| EXOTIC_FRUIT [NEW] | Farming | T3 | → Elixir, T4 luxury food |
| WIRE [NEW] | Metallurgy | T1 | → Advanced Research, Guild Projects |
| BRASS_BAR [NEW] | Metallurgy | T2 | → Fine Instruments, Precision Fittings |
| CAST_IRON [NEW] | Metallurgy | T2 | → Steel Frame, Guild Fortifications |
| STEEL_PLATE [NEW] | Metallurgy | T2 | → Plate Armour, Fortifications |
| GOLD_BAR [NEW] | Metallurgy | T3 | → Permits T3/T4, Guild Projects |
| MASTERWORK_STEEL [NEW] | Metallurgy | T3 | → Masterwork Tools, Elite Weapons |
| COAL_COKE [NEW] | Alchemy | T2 | → Premium fuel for Smelter (Steel, Cast Iron) |
| TAR [NEW] | Alchemy | T2 | → Construction waterproofing, Combat |
| SOAP [NEW] | Alchemy | T2 | → T2 optional consumable, Advanced Amenities |
| MEDICINE [NEW] | Alchemy | T2 | → T3 necessary consumable, Combat healing |
| REAGENT [NEW] | Alchemy | T2 | → Expert Research input |
| ELIXIR [NEW] | Alchemy | T3 | → T4 necessary consumable |
| ADVANCED_REAGENT [NEW] | Alchemy | T3 | → Master Research input |
| FLOUR [NEW] | Food | T1 | → Pie, Spirits (intermediate) |
| CHEESE [NEW] | Food | T1 | → T2/T3 optional consumable, Feast |
| MEAD [NEW] | Food | T2 | → T2/T3 optional consumable (Honey drink) |
| WINE [NEW] | Food | T2 | → T3 optional consumable, Guild Projects |
| SPIRITS [NEW] | Food | T2 | → T3 necessary consumable |
| FEAST [NEW] | Food | T3 | → T4 necessary consumable, Guild Projects |
| FIELD_RATIONS [NEW] | Food | T3 | → Combat consumable |
| CANVAS [NEW] | Crafting | T1 | → Caravans (Wagon cover), Combat (Siege) |
| BANDAGE [NEW] | Crafting | T1 | → Combat consumable (cheap Medicine alt) |
| ROPE [NEW] | Crafting | T1 | → Construction Kit, Caravans, Combat (Bow) |
| WALNUT_PLANKS [NEW] | Crafting | T1 | → Fine Furniture, Fine Instruments |
| FINE_CLOTH [NEW] | Crafting | T2 | → T3 optional consumable, Advanced Amenities |
| FINE_LEATHER [NEW] | Crafting | T2 | → Fine Furniture, Plate Armour |
| FINE_FURNITURE [NEW] | Crafting | T2 | → Advanced Amenities |
| CART [NEW] | Crafting | T2 | → Caravans (Horse-pulled, medium cargo) |
| WAGON [NEW] | Crafting | T2 | → Caravans (Ox-pulled, heavy cargo) |
| FINE_INSTRUMENTS [NEW] | Crafting | T3 | → Expert/Master Research, Guild Projects |
| LUXURY_GOODS [NEW] | Crafting | T3 | → Master Amenities, Guild Projects, T4 consumable |
| MASTERWORK_TOOLS [NEW] | Crafting | T3 | → T3/T4 necessary consumable |
| PLATE_ARMOUR [NEW] | Crafting | T3 | → Combat (heavy armour) |
| ELITE_WEAPON [NEW] | Crafting | T3 | → Combat (guild champion gear) |
| SIEGE_EQUIPMENT [NEW] | Crafting | T3 | → Combat (district assault) |
| STEEL_FRAME [NEW] | Construction | T3 | → Master Construction Kit, T3 buildings |
| PRECISION_FITTINGS [NEW] | Construction | T3 | → Master Construction Kit |
| MASTER_CONSTRUCTION_KIT [NEW] | Construction | T3 | → T3 building construction |
| MASTER_AMENITIES [NEW] | Construction | T3 | → T3 building construction |
| T2_PERMIT [NEW] | Construction | T2 | → Right to build in T2 districts |
| T3_PERMIT [NEW] | Construction | T3 | → Right to build in T3 districts |
| T4_PERMIT [NEW] | Construction | T3 | → Right to build in T4 districts |
| ADVANCED_RESEARCH [NEW] | Research | T2 | → Tech unlock T2→T3, Scriptorium output |
| EXPERT_RESEARCH [NEW] | Research | T3 | → Tech unlock T3, University output |
| MASTER_RESEARCH [NEW] | Research | T3 | → Tech unlock T4, University output |
| SWORD [NEW] | Combat | T1 | → Combat melee |
| SPEAR [NEW] | Combat | T1 | → Combat melee |
| BOW [NEW] | Combat | T1 | → Combat ranged |
| LEATHER_ARMOUR [NEW] | Combat | T1 | → Combat light armour |
| CROSSBOW [NEW] | Combat | T2 | → Combat ranged T2 |
| STEEL_SWORD [NEW] | Combat | T2 | → Combat heavy melee |
| CHAIN_MAIL [NEW] | Combat | T2 | → Combat medium armour |
| SHIELD [NEW] | Combat | T2 | → Combat defence |
| BATTERING_RAM [NEW] | Combat | T2 | → Combat siege |
| BALLISTA [NEW] | Combat | T2 | → Combat siege ranged |

---

## Extraction Tree

### Mining Camp *(plot-locked — ore trait required)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| IRON_ORE | Iron Ore | 10 | 90m | T0 | — |
| IRON_ORE_TOOLS | Iron Ore | 15 | 90m | T0 | Tools ×1 |
| COPPER_ORE | Copper Ore | 10 | 90m | T0 | — |
| COPPER_ORE_TOOLS | Copper Ore | 15 | 90m | T0 | Tools ×1 |
| ALUMINIUM_ORE | Aluminium Ore | 10 | 90m | T0 | — |
| ALUMINIUM_ORE_TOOLS | Aluminium Ore | 15 | 90m | T0 | Tools ×1 |
| RAW_COAL | Raw Coal | 12 | 90m | T0 | — |
| RAW_COAL_TOOLS | Raw Coal | 18 | 90m | T0 | Tools ×1 |
| IRON_CONCENTRATE | Iron Concentrate | 6 | 120m | T1 | Iron Ore ×8 + Water ×2 |
| COPPER_CONCENTRATE | Copper Concentrate | 6 | 120m | T1 | Copper Ore ×8 + Water ×2 |
| GOLD_ORE | Gold Ore | 4 | 120m | T1 | Advanced Tools ×1 + Coal ×2 |
| GEM | Gem | 2 | 180m | T2 | Advanced Tools ×1 + Crystal ×1 |

> **Extraction progression:** T0 raw extraction → T1 adds concentrate processing (cross-link to Water/Alchemy Coal) and rare ore access → T2 unlocks gems (high-value, slow).

---

### Quarry *(plot-locked — stone/mineral trait required)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| LIMESTONE | Limestone | 10 | 90m | T0 | — |
| LIMESTONE_TOOLS | Limestone | 15 | 90m | T0 | Tools ×1 |
| SAND | Sand | 12 | 90m | T0 | — |
| SAND_TOOLS | Sand | 18 | 90m | T0 | Tools ×1 |
| STONE | Stone | 10 | 90m | T0 | — |
| STONE_TOOLS | Stone | 15 | 90m | T0 | Tools ×1 |
| SALT | Salt | 8 | 90m | T0 | — |
| CLAY | Clay | 8 | 105m | T1 | — |
| SALTPETER | Saltpeter | 6 | 120m | T1 | Limestone ×2 + Water ×2 |
| CRYSTAL | Crystal | 3 | 150m | T1 | Advanced Tools ×1 |
| MARBLE | Marble | 4 | 150m | T2 | Advanced Tools ×1 |

---

### Well

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| WATER | Water | 15 | 90m | T0 | — |

---

## Farming Tree

### Farm *(plot-locked — fertility/crop trait required)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| GRAIN | Grain | 8 | 105m | T0 | Water ×3 |
| GRAIN_FERT | Grain | 14 | 105m | T0 | Water ×3 + Fertilizer ×1 |
| VEGETABLES | Vegetables | 6 | 105m | T0 | Water ×2 |
| VEGETABLES_FERT | Vegetables | 10 | 105m | T0 | Water ×2 + Fertilizer ×1 |
| COTTON | Cotton | 5 | 105m | T0 | Water ×2 |
| COTTON_FERT | Cotton | 8 | 105m | T0 | Water ×2 + Fertilizer ×1 |
| OAK | Oak | 8 | 105m | T0 | Water ×3 |
| OAK_FERT | Oak | 14 | 105m | T0 | Water ×3 + Fertilizer ×1 |
| SUGAR_BEETS | Sugar Beets | 6 | 105m | T0 | Water ×2 |
| SUGAR_BEETS_FERT | Sugar Beets | 10 | 105m | T0 | Water ×2 + Fertilizer ×1 |
| FRUIT | Fruit | 5 | 105m | T0 | Water ×2 |
| FRUIT_FERT | Fruit | 8 | 105m | T0 | Water ×2 + Fertilizer ×1 |
| HOPS | Hops | 5 | 105m | T1 | Water ×2 + Fertilizer ×1 |
| HEMP | Hemp | 6 | 105m | T1 | Water ×2 |
| HEMP_FERT | Hemp | 10 | 105m | T1 | Water ×2 + Fertilizer ×1 |

> **Farming T1→T2 progression:** Hops and Hemp are new T1 gated crops that feed into the Crafting and Food trees, rewarding players who invest research into the Agriculture specialisation early.

---

### Hydroponics Lab *(T2 building)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| OAK_HYDRO | Oak | 18 | 105m | T1 | Water ×2 + Fertilizer ×1 |
| COFFEE_BEANS | Coffee Beans | 5 | 105m | T1 | Water ×2 |
| COFFEE_BEANS_FERT | Coffee Beans | 8 | 105m | T1 | Water ×2 + Fertilizer ×1 |
| WALNUT | Walnut | 4 | 105m | T1 | Water ×2 |
| WALNUT_FERT | Walnut | 7 | 105m | T1 | Water ×2 + Fertilizer ×1 |
| SPICES | Spices | 3 | 120m | T2 | Water ×3 + Fertilizer ×2 + Walnut Oil ×1 |
| EXOTIC_FRUIT | Exotic Fruit | 4 | 120m | T2 | Water ×3 + Fertilizer ×1 |

> **Spices and Exotic Fruit** are T2 gate crops — high value, slow, require Walnut Oil (Alchemy cross-link). Spices feed into the Fine Rations boosted recipe and Feast. Exotic Fruit feeds into Elixir.

---

### Pasture

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| MULE | Mule | 1 | 105m | T0 | Grain ×3 + Water ×2 + Basic Animal Feed ×1 |
| HORSE | Horse | 1 | 105m | T0 | Grain ×4 + Water ×2 + Sugar Beets ×2 + Basic Animal Feed ×1 |
| OX | Ox | 1 | 120m | T1 | Grain ×5 + Water ×3 + Basic Animal Feed ×2 |

---

### Ranch

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| COW | Cow | 1 | 105m | T0 | Water ×2 + Grain ×3 + Basic Animal Feed ×1 |
| CHICKEN | Chicken | 2 | 105m | T0 | Water ×1 + Grain ×2 + Basic Animal Feed ×1 |
| HIDE | Hide | 2 | 105m | T0 | Cow ×1 |
| MILK | Milk | 4 | 105m | T0 | Cow ×1 |
| EGG | Egg | 5 | 105m | T0 | Chicken ×1 |
| MEAT_COW | Meat | 5 | 105m | T0 | Cow ×1 |
| MEAT_CHICKEN | Meat | 2 | 105m | T0 | Chicken ×1 |
| TALLOW | Tallow | 3 | 105m | T1 | Cow ×1 |
| FINE_HIDE | Fine Hide | 2 | 120m | T1 | Cow ×1 + Salt ×1 |

> **Ranch T2 progression:** Tallow feeds Soap (Alchemy) and Fine Leather (alt path). Fine Hide gives ranchers a direct route to Fine Leather without needing Walnut Oil from Alchemy.

---

### Apiary *(T2 building — new)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| HONEY | Honey | 4 | 120m | T1 | Sugar Beets ×2 + Fruit ×1 + Water ×2 |
| BEESWAX | Beeswax | 3 | 90m | T1 | Honey ×2 + Water ×1 |

> Honey feeds into Mead (Pub), Elixir (Alchemist Lab), and the upgraded Pie recipe. Beeswax feeds into Candles (Research productivity boost) and wax-sealed Permits.

---

## Metallurgy Tree

### Blacksmith *(T1)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| IRON_BAR | Iron Bar | 4 | 105m | T0 | Iron Ore ×5 + Coal ×3 |
| IRON_BAR_FLUX | Iron Bar | 6 | 105m | T0 | Iron Ore ×5 + Coal ×2 + Flux ×1 |
| COPPER_BAR | Copper Bar | 4 | 105m | T0 | Copper Ore ×5 + Coal ×3 + Flux ×1 |
| ALUMINIUM_BAR | Aluminium Bar | 4 | 105m | T0 | Aluminium Ore ×5 + Coal ×3 + Flux ×1 |
| GLASS | Glass | 4 | 105m | T0 | Sand ×4 + Coal ×2 |
| PIPE | Pipe | 4 | 90m | T0 | Copper Bar ×2 |
| WIRE | Wire | 6 | 90m | T0 | Copper Bar ×2 |
| STEEL_BAR | Steel Bar | 2 | 120m | T1 | Iron Bar ×3 + Coal ×2 + Flux ×1 |
| STEEL_BAR_CONC | Steel Bar | 4 | 120m | T1 | Iron Concentrate ×4 + Coal Coke ×2 + Flux ×1 |

> `STEEL_BAR_CONC` rewards extraction specialists who process ore into concentrate — significantly better Steel yield for the same time investment.

---

### Smelter *(T2 building)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| STEEL_BAR_SMELT | Steel Bar | 3 | 120m | T1 | Iron Bar ×3 + Coal Coke ×2 + Flux ×1 |
| BRASS_BAR | Brass Bar | 3 | 120m | T1 | Copper Bar ×2 + Aluminium Bar ×1 |
| BRASS_BAR_CONC | Brass Bar | 5 | 120m | T1 | Copper Concentrate ×4 + Aluminium Bar ×1 + Flux ×1 |
| CAST_IRON | Cast Iron | 2 | 120m | T1 | Iron Bar ×2 + Coal Coke ×2 |
| STEEL_PLATE | Steel Plate | 2 | 120m | T1 | Steel Bar ×3 |
| GOLD_BAR | Gold Bar | 2 | 150m | T2 | Gold Ore ×4 + Coal Coke ×2 + Flux ×1 |
| CUT_GEM | Cut Gem | 2 | 150m | T2 | Gem ×1 + Advanced Tools ×1 |

---

### Forge *(T3 building)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| MASTERWORK_STEEL | Masterwork Steel | 2 | 150m | T2 | Steel Bar ×3 + Coal Coke ×3 + Flux ×2 |

---

## Alchemy Tree

### Alchemy Tent *(T1)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| COAL | Coal | 4 | 90m | T0 | Raw Coal ×3 |
| FLUX | Flux | 5 | 90m | T0 | Limestone ×3 |
| FERTILIZER | Fertilizer | 4 | 105m | T0 | Limestone ×3 + Water ×2 |
| FERTILIZER_SALTPETER | Fertilizer | 7 | 105m | T1 | Limestone ×2 + Saltpeter ×1 + Water ×2 |
| SUGAR | Sugar | 3 | 90m | T0 | Sugar Beets ×3 |
| DYE | Dye | 3 | 90m | T0 | Fruit ×3 |
| WALNUT_OIL | Walnut Oil | 2 | 90m | T0 | Walnut ×3 |
| TAR | Tar | 3 | 120m | T1 | Raw Coal ×4 + Limestone ×1 |
| COAL_COKE | Coal Coke | 3 | 120m | T1 | Raw Coal ×4 + Limestone ×1 |
| SOAP | Soap | 3 | 90m | T1 | Tallow ×2 + Salt ×1 + Water ×2 |

> `FERTILIZER_SALTPETER` is a higher-yield fertilizer recipe rewarding players who extract Saltpeter. `COAL_COKE` is the premium metallurgy fuel that feeds the Smelter's best recipes — creating a strong Alchemy → Metallurgy dependency.

---

### Apothecary *(T2 building)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| MEDICINE | Medicine | 2 | 120m | T1 | Walnut Oil ×2 + Limestone ×1 + Filtered Water ×1 |
| REAGENT | Reagent | 2 | 150m | T1 | Flux ×2 + Crystal ×1 + Filtered Water ×1 |

> `MEDICINE` requires Filtered Water (Food tree) — a direct Food → Alchemy cross-link. `REAGENT` requires Crystal (Extraction T2) — Extraction → Alchemy cross-link.

---

### Alchemist Lab *(T3 building)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| ELIXIR | Elixir | 2 | 150m | T2 | Medicine ×2 + Honey ×2 + Exotic Fruit ×1 + Walnut Oil ×1 |
| ADVANCED_REAGENT | Advanced Reagent | 2 | 180m | T2 | Reagent ×2 + Crystal ×1 + Gold Bar ×1 |

> `ELIXIR` pulls from Alchemy (Medicine, Walnut Oil), Farming (Honey, Exotic Fruit) — no single empire can self-supply this efficiently. `ADVANCED_REAGENT` requires Gold Bar — Metallurgy T3 cross-link.

---

## Food Tree

### Kitchen *(T1)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| BASIC_RATION | Basic Ration | 5 | 90m | T0 | Grain ×4 + Vegetables ×3 |
| BASIC_ANIMAL_FEED | Basic Animal Feed | 5 | 90m | T0 | Grain ×3 + Vegetables ×2 + Water ×2 |
| FLOUR | Flour | 6 | 90m | T0 | Grain ×4 |
| CHEESE | Cheese | 2 | 105m | T0 | Milk ×2 + Salt ×1 |

---

### Pub *(T1)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| DRINKING_WATER | Drinking Water | 4 | 60m | T0 | Water ×3 |
| ALE | Ale | 4 | 90m | T0 | Grain ×3 + Water ×2 + Glass ×1 |
| ALE_HOPPED | Ale | 6 | 90m | T1 | Grain ×3 + Water ×2 + Glass ×1 + Hops ×1 |
| COFFEE | Coffee | 3 | 90m | T1 | Coffee Beans ×2 + Water ×2 |
| MEAD | Mead | 3 | 105m | T1 | Honey ×2 + Water ×3 |

> `ALE_HOPPED` rewards Farming T1 research (Hops crop) with better Ale yield. `MEAD` is a premium drink alternative, pulling Honey from the Apiary (Farming T2 cross-link).

---

### Restaurant *(T2 building)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| FINE_RATIONS | Fine Rations | 3 | 105m | T1 | Meat ×2 + Egg ×2 + Vegetables ×2 + Salt ×1 |
| FINE_RATIONS_SPICED | Fine Rations | 5 | 120m | T2 | Meat ×2 + Egg ×2 + Vegetables ×2 + Salt ×1 + Spices ×1 |
| PIE | Pie | 3 | 105m | T1 | Flour ×2 + Egg ×2 + Milk ×2 + Fruit ×2 + Sugar ×1 |
| PIE_HONEY | Pie | 4 | 105m | T1 | Flour ×2 + Egg ×2 + Milk ×2 + Fruit ×2 + Honey ×1 |
| FILTERED_WATER | Filtered Water | 4 | 90m | T1 | Drinking Water ×3 + Filter ×1 |

> `FINE_RATIONS_SPICED` pulls Spices from Farming T2 Hydroponics — a meaningful reward for deep Agriculture specialisation. `PIE_HONEY` rewards Apiary investment.

---

### Distillery *(T2 building — new)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| WINE | Wine | 4 | 105m | T1 | Fruit ×3 + Sugar ×1 + Water ×2 |
| SPIRITS | Spirits | 3 | 120m | T1 | Grain ×4 + Flour ×2 + Sugar ×2 |

---

### Grand Kitchen *(T3 building — new)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| FEAST | Feast | 3 | 150m | T2 | Meat ×4 + Fine Rations ×2 + Wine ×2 + Cheese ×3 + Spices ×1 |
| FIELD_RATIONS | Field Rations | 5 | 90m | T1 | Basic Ration ×3 + Salt ×2 |

> `FEAST` is the most cross-specialty food item in the game — it requires Meat (Farming), Fine Rations (Food T2), Wine (Distillery), Cheese (Kitchen), and Spices (Hydroponics T3). No solo empire produces this efficiently.

---

## Crafting Tree

### Textile Mill *(T1/T2)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| LEATHER | Leather | 3 | 120m | T0 | Hide ×2 |
| CLOTH | Cloth | 4 | 120m | T0 | Cotton ×3 |
| CANVAS | Canvas | 3 | 105m | T0 | Cotton ×2 |
| PARCHMENT | Parchment | 3 | 120m | T0 | Leather ×2 |
| OVERALLS | Overalls | 2 | 120m | T0 | Leather ×2 + Cloth ×2 |
| BANDAGE | Bandage | 4 | 90m | T0 | Cloth ×2 |
| FINE_CLOTH | Fine Cloth | 2 | 120m | T1 | Cloth ×2 + Dye ×1 |
| FINE_LEATHER | Fine Leather | 3 | 120m | T1 | Leather ×2 + Walnut Oil ×1 |
| FINE_LEATHER_ALT | Fine Leather | 3 | 120m | T1 | Fine Hide ×2 |

> `FINE_LEATHER_ALT` gives Ranch specialists a direct Fine Leather path without needing Walnut Oil from Alchemy — two viable routes to the same T2 material.

---

### Workshop *(T1/T2)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| OAK_PLANKS | Oak Planks | 6 | 105m | T0 | Oak ×4 |
| WALNUT_PLANKS | Walnut Planks | 4 | 105m | T0 | Walnut ×3 |
| SCREWS | Screws | 8 | 105m | T0 | Iron Bar ×2 |
| TOOLS | Tools | 4 | 105m | T0 | Iron Bar ×3 + Oak Planks ×2 |
| WHEELS | Wheels | 2 | 105m | T0 | Iron Bar ×2 + Oak Planks ×3 |
| ROPE | Rope | 4 | 90m | T0 | Cotton ×2 |
| ROPE_HEMP | Rope | 7 | 90m | T1 | Hemp ×2 |
| FILTER | Filter | 2 | 105m | T0 | Sand ×2 + Coal ×1 + Pipe ×1 |
| FURNITURE | Furniture | 2 | 120m | T0 | Oak ×3 + Cloth ×2 + Leather ×1 |
| SADDLE | Saddle | 2 | 120m | T0 | Leather ×3 + Cloth ×1 + Iron Bar ×1 |
| PANNIER | Pannier | 3 | 120m | T0 | Leather ×2 + Cloth ×2 |
| ADVANCED_TOOLS | Advanced Tools | 2 | 105m | T1 | Steel Bar ×2 + Oak Planks ×2 |
| REBAR | Rebar | 4 | 90m | T1 | Steel Bar ×2 |
| TRUSS | Truss | 3 | 90m | T1 | Aluminium Bar ×3 |
| FINE_FURNITURE | Fine Furniture | 2 | 120m | T1 | Walnut Planks ×2 + Fine Cloth ×1 + Fine Leather ×1 |
| CART | Cart | 1 | 150m | T1 | Oak Planks ×4 + Wheels ×2 + Iron Bar ×2 + Rope ×2 |
| WAGON | Wagon | 1 | 180m | T1 | Oak Planks ×6 + Wheels ×4 + Steel Bar ×2 + Canvas ×2 |

> `ROPE_HEMP` rewards Farming T1 Hemp unlock with significantly better rope yield. `WAGON` is a major caravan milestone — requires Steel Bar (Metallurgy T1), Wood, and Canvas (Farming cross-links).

---

### Atelier *(T3 building — new)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| FINE_INSTRUMENTS | Fine Instruments | 2 | 150m | T2 | Brass Bar ×2 + Fine Leather ×1 + Walnut Planks ×2 |
| LUXURY_GOODS | Luxury Goods | 1 | 180m | T2 | Fine Cloth ×2 + Fine Furniture ×1 + Fine Instruments ×1 |
| MASTERWORK_TOOLS | Masterwork Tools | 2 | 150m | T2 | Masterwork Steel ×2 + Oak Planks ×2 + Fine Leather ×1 |
| PLATE_ARMOUR | Plate Armour | 1 | 180m | T2 | Steel Plate ×3 + Fine Leather ×2 + Screws ×4 |
| ELITE_WEAPON | Elite Weapon | 2 | 150m | T2 | Masterwork Steel ×2 + Walnut Planks ×1 + Fine Leather ×1 |
| SIEGE_EQUIPMENT | Siege Equipment | 1 | 240m | T2 | Oak Planks ×8 + Steel Bar ×4 + Rope ×6 + Wheels ×4 |

---

## Construction Tree

### Builder's Yard *(T1)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| MORTAR | Mortar | 4 | 105m | T0 | Sand ×3 + Limestone ×2 |
| COBBLESTONE | Cobblestone | 4 | 105m | T0 | Stone ×4 + Mortar ×2 |
| CONSTRUCTION_KIT | Construction Kit | 2 | 120m | T0 | Iron Bar ×2 + Screws ×4 + Oak Planks ×3 + Rope ×1 |
| AMENITIES | Amenities | 1 | 120m | T0 | Glass ×2 + Pipe ×1 + Oak Planks ×2 + Screws ×4 |

> `ROPE` added to Construction Kit — Crafting now has a direct T0 cross-link into Construction.

---

### Construction Workshop *(T2 building)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| REINFORCED_CONCRETE | Reinforced Concrete | 2 | 120m | T1 | Mortar ×4 + Rebar ×2 |
| STONE_BLOCK | Stone Block | 2 | 120m | T1 | Cobblestone ×4 + Reinforced Concrete ×2 |
| ADVANCED_CONSTRUCTION_KIT | Advanced Construction Kit | 1 | 150m | T1 | Aluminium Bar ×2 + Truss ×2 + Screws ×6 + Oak Planks ×3 |
| ADVANCED_AMENITIES | Advanced Amenities | 1 | 150m | T1 | Fine Furniture ×2 + Glass ×2 + Pipe ×2 |
| CLAY_BRICK | Clay Brick | 6 | 105m | T1 | Clay ×4 + Coal ×1 |

> `CLAY_BRICK` is an alternative T2 construction material — cheaper than Stone Block but weaker. Gives Extraction specialists a direct Construction output route.

---

### Master Builder's Yard *(T3 building — new)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| STEEL_FRAME | Steel Frame | 2 | 150m | T2 | Cast Iron ×3 + Rebar ×4 |
| PRECISION_FITTINGS | Precision Fittings | 2 | 120m | T2 | Brass Bar ×2 + Wire ×3 |
| MASTER_CONSTRUCTION_KIT | Master Construction Kit | 1 | 180m | T2 | Steel Frame ×2 + Advanced Tools ×2 + Precision Fittings ×2 |
| MASTER_AMENITIES | Master Amenities | 1 | 180m | T2 | Luxury Goods ×1 + Fine Instruments ×1 + Brass Bar ×2 |

> `MASTER_AMENITIES` requires Luxury Goods and Fine Instruments — Construction T3 has a hard dependency on Crafting T3 (Atelier).

---

### Permit Office

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| BASIC_PERMIT | Basic Permit | 1 | 120m | T0 | Parchment ×3 + Copper Bar ×1 + Ale ×2 |
| T2_PERMIT | T2 Permit | 1 | 150m | T1 | Basic Permit ×2 + Parchment ×3 + Beeswax ×2 + Advanced Research ×1 |
| T3_PERMIT | T3 Permit | 1 | 180m | T2 | T2 Permit ×2 + Parchment ×4 + Expert Research ×1 + Gold Bar ×1 |
| T4_PERMIT | T4 Permit | 1 | 180m | T2 | T3 Permit ×2 + Parchment ×4 + Expert Research ×2 + Gold Bar ×2 |

> `BEESWAX` added to T2 Permit — Farming T2 (Apiary) now feeds into the permit chain. Higher permits require Research items — Research specialists become critical suppliers.

---

## Research Tree

### Study *(T1)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| BASIC_RESEARCH | Basic Research | 2 | 150m | T0 | Parchment ×3 + Ale ×2 + Vegetables ×1 |

---

### Scriptorium *(T2 building — new)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| ADVANCED_RESEARCH | Advanced Research | 1 | 180m | T1 | Basic Research ×2 + Parchment ×3 + Wire ×1 + Advanced Tools ×1 |

> `WIRE` (Metallurgy T1) and `ADVANCED_TOOLS` (Crafting T2) make Advanced Research a genuine cross-specialty product — Research specialists must trade with or buy from Metallurgy and Crafting.

---

### University *(T3 building — new)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| EXPERT_RESEARCH | Expert Research | 1 | 210m | T2 | Advanced Research ×2 + Parchment ×3 + Fine Instruments ×1 + Reagent ×1 |
| MASTER_RESEARCH | Master Research | 1 | 240m | T2 | Expert Research ×2 + Fine Instruments ×2 + Advanced Reagent ×1 + Luxury Goods ×1 |

> `MASTER_RESEARCH` requires inputs from Crafting T3 (Fine Instruments, Luxury Goods) and Alchemy T3 (Advanced Reagent) — the most cross-specialty item in the game.

---

## Combat

Combat items are assembled at the Armoury and Siege Works from components produced across multiple trees.

### Armoury *(T1 building — new)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| SWORD | Sword | 2 | 105m | T0 | Iron Bar ×2 + Oak Planks ×1 |
| SPEAR | Spear | 2 | 90m | T0 | Iron Bar ×1 + Oak Planks ×2 + Rope ×1 |
| BOW | Bow | 2 | 90m | T0 | Oak Planks ×2 + Rope ×2 |
| LEATHER_ARMOUR | Leather Armour | 1 | 120m | T0 | Leather ×3 + Cloth ×2 + Iron Bar ×1 |
| STEEL_SWORD | Steel Sword | 2 | 120m | T1 | Steel Bar ×2 + Oak Planks ×1 |
| CROSSBOW | Crossbow | 1 | 120m | T1 | Oak Planks ×2 + Iron Bar ×2 + Rope ×1 + Steel Bar ×1 |
| CHAIN_MAIL | Chain Mail | 1 | 150m | T1 | Iron Bar ×4 + Screws ×4 |
| SHIELD | Shield | 2 | 120m | T1 | Steel Bar ×2 + Oak Planks ×2 + Leather ×1 |

---

### Siege Works *(T2 building — new)*

| Recipe | Output | Qty | Time | Tech | Inputs |
|---|---|---|---|---|---|
| BATTERING_RAM | Battering Ram | 1 | 180m | T1 | Oak ×5 + Iron Bar ×3 + Rope ×3 |
| BALLISTA | Ballista | 1 | 240m | T1 | Oak Planks ×6 + Iron Bar ×4 + Rope ×4 + Wheels ×2 |

---

### Elite Combat *(Atelier, see Crafting T3)*
- `PLATE_ARMOUR` — Steel Plate ×3 + Fine Leather ×2 + Screws ×4
- `ELITE_WEAPON` — Masterwork Steel ×2 + Walnut Planks ×1 + Fine Leather ×1
- `SIEGE_EQUIPMENT` — Oak Planks ×8 + Steel Bar ×4 + Rope ×6 + Wheels ×4

### Combat Consumables

| Item | Source | Inputs |
|---|---|---|
| Field Rations | Grand Kitchen | Basic Ration ×3 + Salt ×2 |
| Medicine | Apothecary | Walnut Oil ×2 + Limestone ×1 + Filtered Water ×1 |
| Bandage | Textile Mill | Cloth ×2 |
| Tar | Alchemy Tent | Raw Coal ×4 + Limestone ×1 |

---

## Cross-Specialty Dependency Matrix

Each cell shows what the **row tree** needs from the **column tree**.

|  | Extraction | Farming | Metallurgy | Alchemy | Food | Crafting | Construction | Research |
|---|---|---|---|---|---|---|---|---|
| **Extraction** | — | — | *Tools (yield boost)* | — | — | Tools | — | — |
| **Farming** | Water, Salt | — | — | Fertilizer, Walnut Oil | Animal Feed | — | — | — |
| **Metallurgy** | Ores, Coal | — | — | Coal, Coal Coke, Flux | — | Oak Planks | — | — |
| **Alchemy** | Limestone, Sand, Raw Coal, Crystal, Saltpeter, Gold Bar | Sugar Beets, Walnut, Fruit, Honey, Exotic Fruit | — | — | Filtered Water | — | — | — |
| **Food** | Water, Salt | Grain, Veg, Milk, Egg, Meat, Fruit, Coffee Beans, Honey | Glass, Pipe | Sugar, Dye | — | Filter | — | — |
| **Crafting** | Sand (Filter) | Oak, Cotton, Hide, Walnut, Hemp | Iron/Steel/Copper/Aluminium Bars | Walnut Oil, Dye, Coal | — | — | — | — |
| **Construction** | Stone, Sand, Limestone, Clay | — | Iron/Aluminium Bars, Glass, Pipe, Brass, Cast Iron | Tar | Ale | Planks, Screws, Rope, Rebar, Truss, Fine Furniture, Luxury Goods | — | — |
| **Research** | — | Vegetables | Wire | — | Ale | Parchment, Advanced Tools, Fine Instruments | — | — |
| **Combat** | — | Oak | Iron/Steel Bars, Steel Plate, Masterwork Steel | Medicine, Tar | Field Rations | Leather, Cloth, Planks, Rope, Wheels, Bandage | — | — |
| **Permits** | — | — | Copper Bar, Gold Bar | — | Ale | Parchment | Basic Permit | Advanced/Expert Research |

---

## Tier Coverage Summary

| Specialty | T0 Items | T1 Items | T2 Items | T3 Items |
|---|---|---|---|---|
| Extraction | 9 raw materials | 7 (concentrates, gold, crystal, saltpeter) | 2 (marble, gem) | — |
| Farming | 14 (crops + animals + products) | 5 (hops, hemp, ox, tallow, fine hide) | 2 (spices, exotic fruit) + 2 apiary | — |
| Metallurgy | 7 (bars, glass, pipe, wire) | 5 (steel, brass, cast iron, steel plate, chain mail) | 3 (gold bar, masterwork steel, cut gem) | — |
| Alchemy | 6 (coal, flux, fertilizer, sugar, dye, walnut oil) | 4 (tar, coal coke, soap, fertilizer alt) | 2 (medicine, reagent) | 2 (elixir, advanced reagent) |
| Food | 4 (ration, feed, flour, cheese) + 2 drinks | 5 (ale hopped, coffee, mead, fine rations, pie, filtered water, wine, spirits) | 2 (feast, field rations) | — |
| Crafting | 13 (textiles, wood goods, tools, rope, caravan) | 8 (fine cloth, fine leather, adv tools, rebar, truss, fine furniture, cart, wagon) | 6 (instruments, luxury, masterwork tools, plate armour, elite weapon, siege) | — |
| Construction | 5 (mortar, cobblestone, kit, amenities, permit) | 6 (concrete, stone block, adv kit, adv amenities, clay brick, T2 permit) | 4 (steel frame, fittings, master kit, master amenities) + 2 permits | — |
| Research | 1 (basic research) | 1 (advanced research) | 2 (expert, master research) | — |
| Combat | 4 weapons + 1 armour (armoury) | 4 weapons + 3 armour + 2 siege (armoury T2/siege works) | 2 elite + siege equip (atelier) | — |
