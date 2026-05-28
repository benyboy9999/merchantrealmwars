# Design Notes — Working Document
*Informal notes on design decisions, open questions, and reasoning.*
*Not a source of truth — see GAME_DATA.md for that.*

---

## Status

T1 is structurally defined. Quantities not yet set (balancing phase later).
T2, T3 not yet designed.
Arcane specialisation tree deferred to higher tiers.

---

## T1 Design Decisions (locked)

**Ranch splits capacity intentionally.**
The same Ranch building raises Cows AND processes them (Hide, Fertilizer). This means players must choose how much capacity goes to each recipe. A player who sells Cows on the Exchange creates a market for ranching inputs vs outputs — good trade depth.

**Scaffolding gates all construction.**
Every building construction, upgrade, and maintenance event requires Scaffolding. This means the Builders Yard is never idle in a healthy empire — it's always feeding the construction pipeline. Creates constant demand for Limestone, Sand, Iron Bars, Planks, Nails.

**Water is industrial, Drinking Water is potable.**
Raw Water (Well) is an agricultural and construction input — not drinkable.
Drinking Water (Pub, consumes Water) is the worker consumable.
This split means Wells serve double duty: they feed Farms/Ranches AND the pub chain. High-abundance water plots are strategically valuable.

**Charcoal as alternate smelting fuel.**
Players without Coal access can still smelt using Charcoal (Wood → Smith). Coal gives better output. This prevents early-game bottlenecks where a player can't smelt at all, while still rewarding Coal investment. Same mechanic as Fertilizer on Farm — optional upgrade that boosts efficiency.

**Bronze requires two ores.**
Bronze Bars = Copper Ore + Tin Ore + Coal. More complex than Iron (one ore). Bronze use case TBD for T2 but the complexity is intentional — it should unlock something Iron cannot.

**Research chain is deliberately deep at T1.**
Path to Basic Research: Hide → Leather → Parchment → Basic Research.
Four steps means Research feels like a real investment, not free. Players who specialise in the Research tree will have an advantage here.

**Tools as a worker necessity (not just upkeep).**
T1 Labourers require Tools every tick. This creates the strongest economic sink in T1 — Tool demand scales with every single worker in the game. Players who corner the Iron Bars + Planks supply chain are in a strong position early.

---

## Production System (decided)

**Any building slot can hold any building.** No slot type restrictions. The building itself determines what the slot does. Simpler than a typed-slot system.

**Level is per individual building, not per building type.** Two Smiths in the same Keep can be at different levels. Each building is upgraded independently.

**Level multiplies inputs, outputs, AND worker requirements.** Level 2 Smith = 2× coal in, 2× bars out, 2× workers needed. Housing must be leveled too to staff leveled buildings — creates a natural progression gate.

**Queue is per building type per keep.** All Smiths in a Keep share one queue. Building more copies of the same type scales throughput without adding queue management overhead.

**Queue priority: numerical first, then infinite.** Specific orders are always completed before open-ended production runs. Within each group, round-robin for multiples.

**Equal time-share for multiple infinite orders.** A Ranch running infinite Cows + Hide + Fertilizer divides its cycle evenly. System self-balances.

**Storage is weight-based.** Each resource has a weight. Warehouse buildings add weight capacity. Heavy resources (Iron Bars, Stone) are more expensive to stockpile than light ones (Parchment, Cloth). Creates strategic differentiation between resource types beyond just gold value.

---

## Open Questions

**~~Workers + levels~~** ✓ Workers scale with level. Level 2 building requires 2× workers. Housing must be leveled to match.

**~~Individual vs type-wide levels~~** ✓ Individual. Each building has its own level.

**~~Queue priority~~** ✓ Numerical first, then infinite.

**~~Storage unit~~** ✓ Weight-based. Each resource has a weight value.

**~~Charcoal/Coal mechanic~~** ✓ Two separate recipe rows. Smith has e.g. "Iron Bars (Iron Ore + Coal)" and "Iron Bars (Iron Ore + Charcoal)" as distinct recipes. Player chooses which one to queue.

**~~Mule caravan fuel~~** ✓ Feed (Vegetables + Water), produced at the Pasture. Each animal in the Caravan consumes Feed per trip.

**Scaffolding — per tick or per event?**
- Per tick: buildings constantly consume Scaffolding to stay maintained. Creates ongoing demand. Higher upkeep pressure.
- Per event: Scaffolding only consumed when constructing, upgrading, or repairing a building. Capital cost only.
Per tick is a stronger economic sink and more interesting ongoing logistics. Per event is simpler and less punishing.
*→ Decision needed before implementing building upkeep.*

**What does Basic Research unlock?**
The Study produces Basic Research from Parchment. But there's no defined spend mechanic yet.
Options:
- Research is spent to unlock nodes in Specialisation trees (most likely)
- Research accumulates in a pool and gates tier progression
- Research is donated to a regional pool that all players benefit from (interesting co-op angle)
*→ Decision needed before designing Specialisation trees further.*

**Permit Office recipe?**
Basic Permits gate access to higher-tier or high-abundance plots. What do they cost?
Options: Gold only, Gold + resources, Resources only (e.g. Bricks + Mortar + Scaffolding)
A resource cost makes permits a supply chain challenge, not just a gold purchase. More interesting.
*→ Decision needed before implementing plot access system.*

**Bronze use case in T2.**
Bronze Bars have no defined purpose yet. Before T2 design, decide: what does Bronze unlock that Iron cannot?
Ideas: decorative/luxury goods, specific instrument types for Research chain, higher-quality caravan fittings.

**Nails input — confirm Iron Bars.**
The workshop sheet says `Nails (Iron)`. Presumed to mean Iron Bars (not raw ore). Confirm.

---

## Supply Chain Map (T1)

```
Well ──────────────────────────────────────────────────────► Water
                                                               │
Mining Camp ──► Iron Ore ──────────────────────────────────► Smith ──► Iron Bars ──► Workshop ──► Tools
             ──► Copper Ore ──────────────────────────────► Smith ──► Copper Bars
             ──► Tin Ore ────────────────────────────────┐
             ──► Coal ───────────────────────────────────┴► Smith ──► Bronze Bars
                                                                    ──► Charcoal (from Wood)

Quarry ──► Limestone ──────────────────────────────────────► Builders Yard ──► Bricks
        ──► Sand ──────────────────────────────────────────► Builders Yard ──► Mortar
                                                                             ──► Scaffolding

Logging Camp ──► Wood ──────────────────────────────────────► Workshop ──► Planks ──► Nails (+ Iron Bars)
                                                                                    ──► Tools (+ Iron Bars)
                                                                                    ──► Wheels (+ Iron Bars)
                                                                        ──► Timber Frame (+ Nails)
                                   └──────────────────────────────────► Smith ──► Charcoal

Farm ──► Grain ─────────────────────────────────────────────► Kitchen ──► Rations
      ──► Vegetables ──────────────────────────────────────► Kitchen ──► Rations
      ──► Cotton ─────────────────────────────────────────── Textile Mill ──► Cloth ──► Overalls (+ Leather)

Pasture ──► Mules (Grain + Water)  → T1 Caravan
         ──► Horses (Grain + Water) → T2 Caravan

Ranch ──► Cows (Grain + Water) ──► Hide ──► Textile Mill ──► Leather ──► Parchment ──► Study ──► Basic Research
                                                                        ──► Overalls (+ Cloth)
                               ──► Fertilizer → Farm bonus

Pub ──► Drinking Water (Water)   → T1 Labourer (necessary)
     ──► Ale (Water + Grain)     → T1 optional / T2 necessary

Workshop ──► Tools → T1 Labourer (necessary) + building upkeep
```

---

## Caravan System (decided)

**Caravans are composed, not fixed.** A Caravan is a combination of animals + attachments. Players add animals (Mule, Horse, Ox) and storage attachments (Storage Pack, Wagon) to a single Caravan. Each addition affects the three-way trade-off: speed, capacity, Feed consumption.

**Feed = Vegetables + Water (Pasture recipe).** Separates caravan fuel from livestock food. Pasture now serves two purposes: raising animals and producing Feed. This creates interesting resource allocation — a heavily used Pasture might struggle to do both.

**Mixed animal types may be allowed** in one Caravan. Not yet confirmed. Worth deciding — mixing Horses and Oxen would create weird speed averaging. Probably cleaner to restrict to one animal type per Caravan.

**Building decay is a persistent sink.** All buildings decay slowly. Production buildings lose efficiency when too decayed; Housing and Warehouses decay silently (only affects demolition recovery). This means construction materials (Bricks, Mortar, Timber Frame, Scaffolding) have permanent ongoing demand — not just a one-time build cost. Strong economic sink.

**Demolition recovery** creates a secondary reason to maintain buildings — well-maintained buildings return more on demolition, giving players flexibility to reconfigure Keeps without losing all their investment.

---

## Open Questions — Caravans & Buildings

**Oxen — tier and source building?**
Mentioned as a Caravan animal alongside Horses and Mules. Is it T1 or T2+? Raised at the Pasture or a different building (Cattle building? Ranch already exists)?

**Mixed animal types per Caravan?**
Can a single Caravan have 2 Mules + 1 Horse? Or restricted to one animal type per Caravan? Mixed types would need a speed-averaging rule. Probably simpler to restrict.

**What happens when Feed runs out mid-journey?**
If a Caravan dispatched and runs out of Feed before arriving — does it stop mid-route? Return to origin? Arrive but at reduced speed? This affects how players plan supply.

**Repair materials — universal or per building type?**
Do all buildings use the same repair materials (e.g., always Bricks + Mortar + Scaffolding), or does each building type require specific repair inputs (a Smith might need Iron Bars in addition to construction materials)?

**Can a building be demolished at any decay level?**
Or must it be repaired to a minimum state before demolition? And what's the recovery percentage curve (e.g., 100% health → 90% recovery, 50% health → 50% recovery, 0% → 10%)?

## Things That Will Come Later

- **T2 buildings** — not yet designed
- **T3 buildings** — not yet designed
- **Arcane specialisation** — T2+ only
- **Pie** — T2 food item, T1 optional worker bonus
- **Horses → T2 Caravan** — may require Research unlock
- **Leather caravan upgrades** (Mule storage)
- **Wheel use in Cart construction** — T2 caravan or upgrade?
- **Higher-tier Permits** — for T2/T3 land access
- **Bronze use case** — T2 products
- **Worker housing names** — T1/T2/T3
- **All quantities** — production rates, consumption rates (balancing phase)
