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

**Caravans are persistent player-owned entities.** Configured before each trip: animal type + count, storage attachments, cargo, Feed. Not a one-shot dispatch — the same Caravan entity is reused, refuelled, and reconfigured.

**Feed must be loaded before departure.** Cannot run out mid-journey. If the route requires more Feed than is loaded, departure is blocked. Simple and clean — no mid-journey edge cases.

**Single animal type per Caravan.** No mixing Horses and Mules. Avoids speed-averaging complexity. Players choose their strategy (speed vs capacity) when configuring the Caravan.

**Oxen deferred.** Will revisit in a later design session.

**Building decay uses a health percentage model.**
- 100%→90%: healthy, repair not yet available
- 90%: repair becomes available
- 80%: efficiency penalty begins
- 50%: floor — decay stops, production capped

This gives players a clear warning window (90–80%) before penalties kick in. The floor at 50% means neglected buildings remain usable (at reduced output) rather than becoming dead weight.

**Repair materials = construction materials.** A building is repaired with exactly what it was built with. T1 buildings repaired with T1 construction materials. T2 with T2. No special repair-only resources to track. Level scales both build and repair costs equally.

**Demolition recovery is health-dependent.** Well-maintained buildings return more of their construction materials. A building at the 50% floor returns significantly less. Creates ongoing incentive to maintain even buildings you might demolish later.

---

## Open Questions — Caravans & Buildings

**Floor efficiency value.** At 50% health, production is capped — but at what output %? e.g. 50% efficiency, 60%, 70%? TBD balancing.

**Demolition recovery curve.** What % of construction materials are returned at each health level? e.g. 100% health → 95% returned, 50% health → 30% returned? TBD balancing.

**Multiple animals and speed.** Adding more animals to a Caravan increases capacity and Feed cost. Does it also increase speed (more pulling power), decrease it (more weight), or have no effect on speed? 

**Partial repair.** The system allows partial repair (spend less, gain proportional health back). Does the player manually choose how much to repair, or does repair always restore to 100%?

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
