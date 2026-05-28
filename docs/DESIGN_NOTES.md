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

## Open Questions

**Charcoal/Coal mechanic — how does the engine handle it?**
Two options:
- Option A: Two separate recipe rows per metal (e.g. Iron Bars w/ Coal, Iron Bars w/ Charcoal). Player chooses which recipe the building runs.
- Option B: Recipes have a "fuel" slot that accepts either Coal or Charcoal, with a Coal bonus modifier.
Option A is simpler to implement. Option B is more elegant but requires engine support for substitutable inputs.
*→ Decision needed before implementing Smith.*

**Mule caravan fuel — Grain or processed Feed?**
Mule caravans need something to run on. Options:
- Grain directly (simpler — Pasture and caravans compete for the same Grain supply)
- Grain → Feed (processed, separate resource) — adds a step but separates caravan fuel from livestock food
The current codebase has "FEED" as a placeholder resource. 
*→ Decision needed before implementing Caravans.*

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
