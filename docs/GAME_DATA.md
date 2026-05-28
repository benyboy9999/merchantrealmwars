# Artemis — Game Data
*Source of truth for all game mechanics. Update this before implementing any new system.*
*Quantities marked (TBD) are structural decisions — values to be set during balancing.*

---

## Building Slots

Each Keep has a fixed number of Building Slots (expandable via upgrades). **Any slot can hold any building** — there are no slot type restrictions. The building placed in a slot determines what that slot does.

| Building category | What it does |
|---|---|
| Production buildings | Run recipes to produce resources |
| Housing buildings | House Workers of a given tier |
| Warehouse | Increases Keep resource storage capacity (weight-based) |

---

## Building Levels

Every building has its own level. **Buildings in the same Keep can be at different levels.** Level multiplies both inputs, outputs, and worker requirements by the level number.

| Level | Inputs | Outputs | Workers required |
|---|---|---|---|
| 1 | 1× | 1× | 1× base |
| 2 | 2× | 2× | 2× base |
| 3 | 3× | 3× | 3× base |

**Because worker requirements scale with level, Housing must also be leveled up** to provide enough workers. A Level 2 Smith needs twice the workers — those workers need to be housed.

- Level multiplies Housing capacity by the same factor
- A player who levels a production building without leveling their housing will find they don't have enough workers to staff it

---

## Production Queue

Each **building type per Keep** has a single shared queue. All buildings of that type work from the same queue simultaneously.

**Order types:**
- **Infinite** — runs continuously while resources are available. Never removed from queue.
- **Numerical** — runs until the target quantity is produced, then removed from queue.

**Scheduling rules:**
1. **Numerical orders execute first**, regardless of queue position
2. Once all numerical orders are complete, infinite orders run
3. When multiple infinite orders are active, production time is divided **equally** across all of them (round-robin)

**Example — Ranch queue:** Numerical: 50 Cows → Infinite: Hide, Fertilizer
→ All Ranch buildings produce Cows until 50 are made, then split equally between Hide and Fertilizer indefinitely.

**Order splitting:**
All buildings of the same type in a Keep work on the same active recipe simultaneously. Three Smiths all produce Iron Bars at the same time, then all three switch together.

---

## Storage

Each Keep has a base resource storage capacity. **Warehouse buildings** add capacity. Storage is **weight-based** — each resource has a weight value, and the Keep's total stored weight cannot exceed its capacity.

- Keep storage capacity = base capacity + (sum of all Warehouse levels × base warehouse capacity)
- Current weight used = sum of (resource quantity × resource weight) across all resources in the Keep
- When a Keep is at capacity, production stops for that Keep until resources are moved or sold

---

## Modifiers

| Modifier | Applied To | Effect |
|---|---|---|
| Abundance | Extraction buildings, Well | Plot-level bonus to output quantity |
| Fertility | Farm | Plot-level bonus to crop output |

---

## Buildings

### T1 — Resource Extraction

#### Mining Camp
| Output | Inputs | Modifier | Notes |
|---|---|---|---|
| Iron Ore | — | Abundance | |
| Copper Ore | — | Abundance | |
| Tin Ore | — | Abundance | |
| Coal | — | Abundance | |

*One recipe active at a time per building.*

#### Quarry
| Output | Inputs | Modifier | Notes |
|---|---|---|---|
| Limestone | — | Abundance | |
| Sand | — | Abundance | |

#### Logging Camp
| Output | Inputs | Modifier | Notes |
|---|---|---|---|
| Wood | — | Abundance | |

#### Well
| Output | Inputs | Modifier | Notes |
|---|---|---|---|
| Water | — | Abundance | Industrial and agricultural use. Not drinkable — see Pub. |

---

### T1 — Agriculture

#### Farm
| Output | Inputs | Modifier | Notes |
|---|---|---|---|
| Grain | Water | Fertility | Alt recipe: + Fertilizer → bonus output |
| Vegetables | Water | Fertility | Alt recipe: + Fertilizer → bonus output |
| Cotton | Water | Fertility | Alt recipe: + Fertilizer → bonus output |

#### Pasture
| Output | Inputs | Notes |
|---|---|---|
| Mules | Grain + Water | T1 Caravan animal |
| Horses | Grain + Water | T2 Caravan animal. May require Research unlock. |
| Oxen | TBD | Caravan animal — slow, high carry weight. Tier and inputs TBD. |
| Feed | Vegetables + Water | Caravan fuel. Consumed per animal per trip. |

#### Ranch
| Output | Inputs | Notes |
|---|---|---|
| Cows | Water + Grain | Tradeable intermediate resource |
| Hide | Cows | Slaughter recipe |
| Fertilizer | Cows | Byproduct recipe |

*Splitting capacity between raising and processing is intentional.*

---

### T1 — Metallurgy

#### Smith
| Output | Inputs | Notes |
|---|---|---|
| Iron Bars | Iron Ore + Coal | Coal gives better output than Charcoal |
| Iron Bars | Iron Ore + Charcoal | Alternate — lower output rate |
| Copper Bars | Copper Ore + Coal | Coal gives better output than Charcoal |
| Copper Bars | Copper Ore + Charcoal | Alternate — lower output rate |
| Bronze Bars | Copper Ore + Tin Ore + Coal | Use case to be defined in T2+ |
| Bronze Bars | Copper Ore + Tin Ore + Charcoal | Alternate — lower output rate |
| Charcoal | Wood | Alternate smelting fuel; Coal is superior |

*Charcoal/Coal mechanic: TBD whether these are separate recipe rows or a substitutable fuel slot in the engine.*

---

### T1 — Construction

#### Builders Yard
| Output | Inputs | Notes |
|---|---|---|
| Bricks | Limestone + Water | |
| Mortar | Sand + Limestone + Water | |
| Timber Frame | Planks + Nails | Structural building component |
| Scaffolding | Iron Bars + Nails + Planks | Required to construct / upgrade / maintain buildings |

*Scaffolding consumption timing (per tick vs. per construction event) — TBD.*

#### Permit Office
| Output | Inputs | Notes |
|---|---|---|
| Basic Permit | TBD | Required to build/maintain on higher-tier or high-abundance plots |

*Higher-tier permits for T2+ land access to be defined.*

---

### T1 — Food Production

#### Kitchen
| Output | Inputs | Notes |
|---|---|---|
| Rations | Grain + Vegetables | T1 Labourer necessary food |

#### Pub
| Output | Inputs | Notes |
|---|---|---|
| Drinking Water | Water | Potable water. Distinct from raw Well Water. |
| Ale | Water + Grain | T1 Labourer optional / T2 necessary |

---

### T1 — Textiles

#### Textile Mill
| Output | Inputs | Notes |
|---|---|---|
| Leather | Hide | |
| Cloth | Cotton | |
| Parchment | Leather | Input for Research chain |
| Overalls | Leather + Cloth | T1 Labourer optional consumable |

---

### T1 — Manufacturing

#### Workshop
| Output | Inputs | Notes |
|---|---|---|
| Planks | Wood | |
| Nails | Iron Bars | |
| Tools | Iron Bars + Planks | T1 Labourer necessary consumable; building upkeep |
| Wheels | Iron Bars + Planks | Caravan component (Cart construction) |

---

### T1 — Research

#### Study
| Output | Inputs | Notes |
|---|---|---|
| Basic Research | Parchment | Feeds T1 specialisation unlocks |

*Research unlock mechanic TBD — what Basic Research unlocks and how it is spent.*

---

## Materials

### Raw Resources
| Material | Source Building | Notes |
|---|---|---|
| Iron Ore | Mining Camp | |
| Copper Ore | Mining Camp | |
| Tin Ore | Mining Camp | |
| Coal | Mining Camp | Superior smelting fuel |
| Limestone | Quarry | |
| Sand | Quarry | |
| Wood | Logging Camp | |
| Water | Well | Industrial / agricultural use only |

### Agricultural
| Material | Source Building | Notes |
|---|---|---|
| Grain | Farm | |
| Vegetables | Farm | |
| Cotton | Farm | |
| Cows | Ranch | Tradeable intermediate |
| Hide | Ranch | |
| Fertilizer | Ranch | Farm input bonus |
| Mules | Pasture | T1 Caravan vehicle |
| Horses | Pasture | T2 Caravan vehicle |

### Processed — Metals
| Material | Source Building | Notes |
|---|---|---|
| Iron Bars | Smith | |
| Copper Bars | Smith | |
| Bronze Bars | Smith | Use case TBD (T2+) |
| Charcoal | Smith | Alternate smelting fuel |

### Processed — Construction
| Material | Source Building | Notes |
|---|---|---|
| Bricks | Builders Yard | |
| Mortar | Builders Yard | |
| Timber Frame | Builders Yard | |
| Scaffolding | Builders Yard | Required for all building construction / upgrade / maintenance |
| Planks | Workshop | |
| Nails | Workshop | |
| Basic Permit | Permit Office | Land access token |

### Processed — Textiles & Leather
| Material | Source Building | Notes |
|---|---|---|
| Leather | Textile Mill | |
| Cloth | Textile Mill | |
| Parchment | Textile Mill | Research input |
| Overalls | Textile Mill | Worker consumable |

### Food & Drink
| Material | Source Building | Worker Use | Notes |
|---|---|---|---|
| Rations | Kitchen | T1 Necessary | |
| Drinking Water | Pub | T1 Necessary | Distinct from raw Water |
| Ale | Pub | T1 Optional / T2 Necessary | |
| Pie | TBD (T2 building) | T1 Optional | Won't be made in T1 buildings |

### Tools & Equipment
| Material | Source Building | Notes |
|---|---|---|
| Tools | Workshop | T1 Labourer necessary; building upkeep |
| Wheels | Workshop | Caravan component |

### Research
| Material | Source Building | Notes |
|---|---|---|
| Basic Research | Study | T1 specialisation fuel |

---

## Workers

### T1 — Labourers
| Property | Value |
|---|---|
| Housing name | TBD |
| Necessary | Rations, Drinking Water, Tools |
| Optional | Overalls, Ale, Pie |

### T2 — Tradesmen
| Property | Value |
|---|---|
| Housing name | TBD |
| Necessary | TBD |
| Optional | TBD |

### T3 — Technicians
| Property | Value |
|---|---|
| Housing name | TBD |
| Necessary | TBD |
| Optional | TBD |

---

## Caravans

### Composition

A Caravan is assembled from a combination of **animals** and **attachments**. Multiple animals can be added to a single Caravan. Each animal and attachment affects speed, capacity, and fuel consumption.

**Fuel:** Feed (Vegetables + Water, produced at Pasture). Each animal in the Caravan consumes Feed per trip. More animals = more Feed consumed.

### Animals

| Animal | Tier | Speed | Carry Weight | Notes |
|---|---|---|---|---|
| Mule | T1 | Medium | Medium | Baseline caravan animal |
| Horse | T2 | Fast | Light | Faster but lower capacity |
| Ox | TBD | Slow | Heavy | Highest carry weight |

*Multiple animals of the same or mixed types can be added to one Caravan.*
*Each additional animal adds capacity but increases Feed consumption and may affect speed.*

### Attachments

Storage attachments can be added to a Caravan to increase cargo capacity. Each attachment:
- Increases storage capacity
- Increases Feed consumption
- Reduces travel speed

| Attachment | Notes |
|---|---|
| Storage Pack | Light attachment, small capacity increase |
| Wagon | Larger capacity, significant speed reduction |
| *Others TBD* | |

### Building Costs (construction)

All buildings have a one-time resource cost to construct. Specific costs TBD per building type during balancing. Construction materials will include some combination of Bricks, Mortar, Timber Frame, Scaffolding, and tier-appropriate materials.

---

## Building Construction & Decay

### Construction Cost
All buildings require resources to construct. T1 buildings use T1 construction materials (Bricks, Mortar, Timber Frame, Scaffolding — ratios differ per building type). T2 buildings will use T2 construction materials. Specific costs TBD per building type during balancing.

**Level scaling:** A Level N building costs N× the base construction materials to build.

### Decay Model
Each building has a **health value** equal to its total construction cost (conceptually treated as 100%). Health decays slowly over time.

| Health | State | Effect |
|---|---|---|
| 100% → 90% | Healthy | Full efficiency. Repair not yet available. |
| 90% | Repair threshold | Player can now repair the building |
| 90% → 80% | Worn | Full efficiency. Repair available but not urgent. |
| 80% → 50% | Degrading | Efficiency penalty begins and increases as health drops |
| 50% | Floor | Decay stops here. Production capped at floor efficiency. |

*Floor efficiency value (what % output at 50% health): TBD during balancing.*

### Repair
- Repair materials are the **same materials used to construct the building** — T1 buildings repaired with T1 construction materials, T2 with T2 materials
- Repair cost restores the building to 100% health
- Partial repair is possible (spend less, gain proportional health back)
- **Level scaling:** Repair cost scales with building level (Level 2 building costs 2× to repair)

### Housing & Warehouse Decay
Decay **silently** — no efficiency or capacity penalty while operating. Decay only affects **demolition recovery**: a well-maintained building returns a higher percentage of its construction materials on demolition. A building at the 50% floor returns significantly less.

---

## Caravans

### What a Caravan Is
A Caravan is a persistent entity that players own and manage. Players configure it before each trip:
- Set the **animal type and count** (one animal type only per Caravan)
- Add or remove **storage attachments**
- Load **cargo** (the resources being transported)
- Load **Feed** (fuel for the animals)

### Departure Rule
**Feed cannot run out mid-journey.** If insufficient Feed is loaded for the planned route, the Caravan cannot depart. Players must load enough Feed before departure. The UI should show the required Feed for the selected route and animal count before confirming dispatch.

### Composition

**Animals** — one type per Caravan, multiple individuals allowed:

| Animal | Tier | Speed | Carry Weight | Notes |
|---|---|---|---|---|
| Mule | T1 | Medium | Medium | Default T1 animal |
| Horse | T2 | Fast | Light | Speed specialist |
| Ox | TBD | Slow | Heavy | Capacity specialist. Revisit later. |

Each additional animal added to a Caravan:
- Increases total cargo capacity
- Increases Feed consumed per trip
- May affect speed (more animals pulling = TBD)

**Storage Attachments** — added on top of animals:

| Attachment | Effect | Notes |
|---|---|---|
| Storage Pack | Small capacity increase | Light, minimal speed impact |
| Wagon | Large capacity increase | Significant speed reduction, high Feed cost |
| *Others TBD* | | |

Each attachment increases capacity, increases Feed consumption, reduces speed.

### Feed Calculation
Total Feed required per trip = (base Feed per animal × number of animals × distance) + (attachment Feed modifier × distance)

*Specific values TBD during balancing.*

---

## Specialisation Trees

*Trees are named. Bonuses and node structure TBD.*

| Tree | Notes |
|---|---|
| Resource Extraction | Bonuses to mining, quarrying, logging output |
| Refined Goods | Bonuses to smelting, processing efficiency |
| Agriculture | Bonuses to farming, ranching output |
| Food Production | Bonuses to kitchen, pub output and variety |
| Textiles | Bonuses to textile mill output |
| Construction | Bonuses to building speed, upkeep costs |
| Manufacturing | Bonuses to workshop output |
| Research | Bonuses to research speed, unlock cost reduction |
| Workers | Bonuses to worker capacity, consumption reduction |
| Arcane | T2+ only. Details TBD. |

---

## TBD — Must resolve before implementation

| Item | Blocker |
|---|---|
| Charcoal fuel mechanic | Two separate recipe rows vs substitutable fuel slot |
| Mule caravan fuel | Grain directly, or Grain → Feed (processed)? |
| Scaffolding consumption | Per tick (upkeep) or per construction/upgrade event? |
| Basic Permit recipe | What does it cost to produce? |
| Research unlock mechanic | How is Basic Research spent? What does it unlock? |
| Bronze use case | T2 products that specifically require Bronze |
| Housing names | T1/T2/T3 housing names |
| All quantities | Production rates, consumption rates — balancing phase |
| Nails input | Confirm Iron Bars (not raw Iron Ore) |
