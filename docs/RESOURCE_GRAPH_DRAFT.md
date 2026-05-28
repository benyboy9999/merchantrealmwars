# Resource Graph — Working Draft
*Adapted from Galactic Tycoons game data as a starting point.*
*Delete rows, rename, change tiers, add new rows as needed.*
*This document is yours to edit — nothing here is final.*

---

## How to use this document

Each section is a category of resources. For each resource you want to keep, you'll eventually need to tell me:
- What **building** produces it
- What **inputs** it consumes (if any)
- What **tier** building and workers are required
- Whether it's a **regional bonus** resource (Extraction / Farming / Crafting)
- Whether it's used for **worker consumption** (necessary / optional) or **building upkeep**

For now, just edit the names and delete what you don't want.

---

## RAW MATERIALS — Extraction Region Bonus

*Mined or gathered directly. No inputs required.*

| Resource | Notes |
|---|---|
| Iron Ore | |
| Copper Ore | Rename or replace? |
| Limestone | |
| Stone / Silica | Rename as needed — Sandstone, Granite, etc. |
| Coal | |
| Gold Ore | Not in GT — add if wanted |
| Silver Ore | Not in GT — add if wanted |
| Gemstones | Not in GT — add if wanted (luxury chain) |
| Salt | Not in GT — add if wanted (food preservation) |

---

## AGRICULTURAL GOODS — Farming Region Bonus

*Grown or raised. No inputs required (other than land).*

### Crops
| Resource | Notes |
|---|---|
| Grain | Core food chain starter |
| Vegetables | |
| Fruits | |
| Cotton | Rename to Flax / Hemp if preferred |
| Herbs | Medicinal chain |
| Sugar Cane | → Sugar |
| Honeycaps (Mushrooms) | Rename or remove |

### Livestock — Multi-product buildings
| Building | Produces | Notes |
|---|---|---|
| Cattle Ranch | Meat, Leather, Tallow, Milk | Tallow → Candles |
| Sheep Pasture | Wool, Meat | Wool → Cloth |
| Chicken Coop | Eggs, Meat | Unlocked later? |
| Pig Farm | Meat | Not in GT — add if wanted |
| Beehives | Honey, Beeswax | Not in GT — add if wanted |

---

## METALS & ALLOYS

*Processed from ores. Crafting Region bonus for smelting efficiency.*

| Resource | Inputs | Tier | Notes |
|---|---|---|---|
| Iron | Iron Ore + Coal | 1 | Core metal |
| Copper | Copper Ore | 1 | Wiring, decorative? |
| Steel | Iron + Coal | 1 | Stronger than iron |
| Gold | Gold Ore | — | Currency / luxury — add if wanted |
| Silver | Silver Ore | — | Jewellery chain — add if wanted |

---

## BUILDING MATERIALS

*Used to construct and upgrade Keeps and Buildings.*

| Resource | Inputs | Notes |
|---|---|---|
| Lumber | Logs (Timber Camp) | Core construction material |
| Bricks | Stone + Coal (Brick Kiln) | Upgrade material |
| Mortar | Limestone + Water | Mix with Bricks for construction |
| Glass | Silica + Coal | Windows, decorative |
| Reinforced Glass | Glass + Iron | Advanced buildings |
| Truss / Beams | Lumber + Iron | Structural element — rename as preferred |
| Rope | Cloth / Hemp (Rope Maker) | Construction + Caravans |
| Flux | Limestone + Coal | Smelting aid |

---

## TEXTILES & LEATHER

| Resource | Inputs | Notes |
|---|---|---|
| Wool | Sheep Pasture | |
| Cloth | Wool / Cotton (Spinning Mill) | Core textile |
| Fine Cloth | Cloth (Weaving Hall) | Luxury / T3 worker need |
| Leather | Cattle Ranch | |
| Tanned Leather | Leather (Tannery) | Equipment, clothing |
| Clothing / Workwear | Cloth + Leather | Worker consumable |

---

## FOOD & DRINK

*Worker consumption items. Necessary = penalty if missing. Optional = bonus if supplied.*

| Resource | Inputs | Worker Need | Notes |
|---|---|---|---|
| Flour | Grain (Mill) | — | Intermediate only |
| Bread | Flour (Bakery) | T1 Necessary | Core food |
| Meat | Cattle / Sheep / Chicken | T2 Optional | Better food |
| Vegetables | Farm | T1 Optional | |
| Milk | Cattle Ranch | — | Cheese chain? |
| Cheese | Milk (Dairy) | T2 Optional | — add if wanted |
| Eggs | Chicken Coop | — | Cooking ingredient |
| Sugar | Sugar Cane (Mill) | — | Confectionery chain |
| Pie / Pastry | Flour + Fruit + Sugar | T2/T3 Optional | Luxury food |
| Ale | Grain + Water (Brewery) | T1 Optional / T2 Necessary | |
| Wine | Grapes / Fruit (Winery) | T3 Optional | — add if wanted |
| Spices | Exotic Spices (imported?) | T3 Optional | High value trade good |
| Preserved Meat | Meat + Salt | Long-distance trade good | — add if wanted |
| Fine Rations | Multiple ingredients | T3 Necessary | Late-game food |

---

## TOOLS & EQUIPMENT

*Used as building upkeep and potentially worker consumables.*

| Resource | Inputs | Notes |
|---|---|---|
| Tools | Iron + Coal (Forge) | T1 building upkeep |
| Advanced Tools | Steel + Coal | T2/T3 building upkeep |
| Drill / Mining Pick | Steel + Tools | Extraction building component |
| Weapons | Steel + Tools (Armoury) | High-value trade good |
| Armour | Steel + Tanned Leather | High-value trade good |
| Welding Kit | Iron + Coal | — rename or remove for medieval |

---

## CHEMICALS & INDUSTRIAL SUPPLIES

*Intermediate processing ingredients. Rename for medieval theme as needed.*

| Resource | Inputs | Medieval Equivalent | Notes |
|---|---|---|---|
| Flux | Limestone + Coal | Flux | Smelting aid |
| Fertilizer | — | Manure / Compost | Farming bonus input |
| Lubricant | Tallow / Plant oil | Animal Grease | Machine upkeep |
| Dye / Colour Compound | Herbs + Water | Natural Dye | Textile processing |
| Ethanol | Grain (Distillery) | Spirits | Optional trade good |
| Candles | Tallow (Chandlery) | Candles | T2 worker necessary |

---

## LUXURIES & HIGH-VALUE TRADE GOODS

*High-tier items with complex chains. Drive the leaderboard economy.*

| Resource | Possible Inputs | Notes |
|---|---|---|
| Fine Weapons | Steel + Fine Cloth + Tools | Master-tier crafting |
| Fine Armour | Steel + Tanned Leather + Tools | |
| Jewellery | Gold/Silver + Gemstones | Very high value |
| Furniture | Lumber + Tools | |
| Fine Cloth | Cloth (Weaving Hall) | Input for luxury goods |
| Medicine | Herbs + Cloth | T3 worker necessary |
| Pottery | Clay + Coal | Trade good |
| Candles | Tallow | T2 necessity, also trade good |
| Perfume | Herbs + Ethanol | Not in GT — luxury trade good |
| Books | Lumber (Paper) + Dye | Not in GT — specialist good? |

---

## VEHICLE FUEL

| Resource | Inputs | Notes |
|---|---|---|
| Feed | Grain (Feed Yard) | Caravan fuel — already in codebase |
| Horseshoes | Iron (Blacksmith) | Vehicle repair component? — add if wanted |

---

## CONSTRUCTION KITS (Building & Upgrading Keeps)

*Used to build and upgrade Keeps and Buildings, not traded in bulk.*

| Resource | Inputs | Notes |
|---|---|---|
| Building Kit (Basic) | Lumber + Stone + Tools | Replaces GT's Construction Kit |
| Building Kit (Advanced) | Lumber + Bricks + Advanced Tools | Replaces GT's Advanced Construction Kit |
| Amenities (Basic) | Cloth + Wood + Pottery | Worker comfort / housing upgrade |
| Amenities (Advanced) | Fine Cloth + Furniture + Glass | Higher tier housing |

---

## REMOVED — SCI-FI ITEMS
*These exist in GT but have no medieval equivalent. Listed here so you can decide if you want fantasy analogues.*

| GT Item | Possible Fantasy Analogue |
|---|---|
| Electronic Circuit / Chip | Runic Tablet? Arcane Circuit? |
| Research Data | Arcane Knowledge / Scholarly Texts? |
| Robot | Golem? |
| Advanced Processing Unit | Arcane Engine? |
| Fission Fuel / Reactor | Magic Crystal / Mana Core? |
| Ship components (Hull Plate, Bridge, etc.) | Not applicable |
| Nanites | Fairy Dust / Arcane Reagent? |
| Oxygen, Hydrogen, Argon, Nitrogen (gases) | Not applicable unless fantasy elements |
| Coffee, Lobster, Exotic Spices | Keep as luxury trade goods if wanted |
| Gourmet Rations | Feast Food / Banquet Goods |

---

## WORKER TIER SUMMARY (to fill in)

*Fill in once you've decided the food/goods chains above.*

| Tier | Housing Name | Necessary Goods | Optional Goods |
|---|---|---|---|
| T1 — Labourer | (name TBD) | | |
| T2 — Craftsman | (name TBD) | | |
| T3 — Master | (name TBD) | | |

---

## BUILDINGS SUMMARY (to fill in)

*One row per building, once chains are decided.*

| Building | Region Bonus | Worker Tier | Produces | Consumes | Upkeep |
|---|---|---|---|---|---|
| Timber Camp | Extraction | T1 | Logs | — | — |
| Iron Mine | Extraction | T1 | Iron Ore | — | Tools |
| ... | | | | | |
