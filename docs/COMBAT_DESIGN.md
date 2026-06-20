# Merchant Realms — Guild Combat System
*Design draft — ready for implementation scoping*

---

## Overview

Combat is the mechanism through which guilds contest control of outer-region districts. It is entirely event-driven with no real-time interaction. Players prepare during the day; the game resolves automatically at a fixed daily timer.

Control of a district grants the controlling guild:
- Speed bonus to member keeps within the district (T3 district: +1 level, T4 district: +2 levels)
- A share of the outer-region exchange tax pool proportional to districts controlled

---

## 1. The Declaration

Any guild can declare intent to contest a district by spending a **Siege Writ** — a craftable item representing the administrative and logistical cost of organising a military campaign.

- One Siege Writ is consumed per declaration
- Multiple guilds can declare on the same district in the same day
- The current controlling guild does **not** need to declare — they defend by default
- If no guild declares on a district, nothing happens and control is unchanged
- A neutral district requires a Siege Writ declaration like any other — it does not auto-claim
- If only one guild declares on a neutral district and no one else contests, they win by default at the timer
- If multiple guilds declare on a neutral district, Stage 1 is skipped (no defender) and resolution goes straight to round-robin among all declarers; tiebreaker is highest surviving power from the round-robin matchups

**Siege Writ recipe** *(TBD exact cost)*: Parchment + Advanced Research + Field Rations — medium cost, requires Research and Food tree investment, cannot be mass-produced trivially.

---

## 2. The Siege Phase

Once a district is declared upon, it enters **Siege** state until the daily resolution timer.

During the Siege phase, all participating guilds (attackers + defending controller) must send military units to the **district center** via caravans from their keeps. Standard caravan mechanics apply — units are physical cargo, subject to caravan capacity and travel time.

- Units must arrive at the district center **before** the resolution timer to count
- Neither side can see what others have committed — this is fully blind
- Any guild can commit as many or as few units as they choose
- The defending guild commits from keeps within or near the district; attacking guilds from wherever their keeps are

---

## 3. Auto-Resolution

At the daily resolution timer (fixed server time), all committed forces are revealed simultaneously and the battle resolves automatically in three stages.

**Tier weights:**
| Unit Tier | Power per unit |
|---|---|
| T1 | 1 |
| T2 | 5 |
| T3 | 20 |

**Stage 1 — Attackers vs Defender**

Every attacking guild is matched against the defending guild simultaneously. All matchups are calculated using **starting values** — no units are actually removed until the end of the event.

For any 1v1 matchup between Guild X and Guild Y, surviving power is:
```
X surviving = max(0, X_Foot − Y_Ranged)
            + max(0, X_Ranged − Y_Siege)
            + max(0, X_Siege − Y_Foot)
```
(all values converted to power using tier weights before subtracting)

The guild with higher surviving power wins the matchup. Attackers who lose to the defender are eliminated.

**Stage 2 — Attacker vs Attacker**

If multiple attackers beat the defender, they face each other in a round-robin using the same formula. Each pairing is calculated independently. The attacker that wins the most matchups takes control.

**Stage 3 — Tiebreaker**

If attackers tie on round-robin wins, the tiebreaker is **surviving power from their Stage 1 matchup against the defender**. The attacker who beat the defender most decisively wins.

**Outcomes:**
- All attackers lose to defender → defender retains control
- One attacker beats defender (and all others) → attacker takes control
- Multiple attackers beat defender, one wins round-robin → that attacker takes control
- Round-robin tie → highest Stage 1 score wins

**All committed units are consumed regardless of outcome** — win or lose, the military resources are gone.

---

## 4. Composition System

Units belong to one of three categories. Each category counters one other and is countered by one other.

| Category | T1 Unit | T2 Unit | T3 Unit | Beats | Loses to |
|---|---|---|---|---|---|
| **Footsoldier** | Sword / Spear | Steel Sword | Elite Weapon | Siege | Ranged |
| **Ranged** | Bow | Crossbow | *(T3 TBD)* | Footsoldier | Siege |
| **Siege** | Battering Ram | Ballista | Siege Equipment | Ranged | Footsoldier |

Composition interacts with the cancellation model directly — there are no multipliers. A unit type cancels its counter type's power by subtraction. Whatever survives after all cancellations determines the matchup winner.

**Worked example — Guild A vs Guild B:**
- A: Foot 10, Ranged 25, Siege 40 (all in power units)
- B: Foot 20, Ranged 20, Siege 15

```
A surviving = max(0, 10−20) + max(0, 25−15) + max(0, 40−20) = 0 + 10 + 20 = 30
B surviving = max(0, 20−25) + max(0, 20−40) + max(0, 15−10) = 0 +  0 +  5 =  5
```

A wins. A's heavy Siege investment (40) wiped B's Ranged entirely (20) and A's Ranged (25) cancelled B's Foot (20) with power to spare.

**Why tier scaling matters:**
The subtraction model makes tier gaps decisive without eliminating composition strategy. A large T3 Siege investment can dominate an entire engagement by cancelling Ranged completely and leaving surplus power. Composition still matters within the same tier range — a guild that brings all Siege against a Foot-heavy opponent bleeds power for nothing.

---

## 5. District Control & Maintenance

Holding a district is not free. Each cycle, the controlling guild pays a **maintenance cost** drawn from guild storage. Maintenance scales with the number of districts controlled to create natural pressure against over-extension.

**Maintenance formula (indicative):**
```
Total maintenance = districts_owned × base_cost × (1 + 0.1 × districts_owned)
```

| Districts held | Cost multiplier |
|---|---|
| 1 | 1.1× base |
| 3 | 1.3× base |
| 5 | 1.5× base |
| 10 | 2.0× base |
| 15 | 2.5× base |

**Maintenance resource** *(TBD)*: Field Rations + Gold per cycle is the likely combination — Field Rations keeps Food specialists economically relevant to guilds, Gold is a constant drain.

**If maintenance is not paid:**
- Cycle 1 missed: district becomes **Restless** (speed bonus suspended, reduced tax share)
- Cycle 2 missed: district reverts to **Neutral** (no controller, open to claim)

This creates a hard ceiling on territory — a guild can only hold as many districts as their economy can sustain. Aggressive expansion without economic backing collapses.

---

## 6. The Information Metagame

Because there is no cap on how many units a guild can commit to a siege, and because commitment is blind, the information layer is inherent to the system:

- Guilds develop reputations — "they always over-commit to farming districts"
- A guild can commit a large force as a deterrent even if they expect no contest
- A guild can bluff a small force hoping opponents under-invest
- Scouts and spies (possible future mechanic) could reveal partial information

The decision each siege is never just "how many units" — it's "how many units given what we think they're committing." This creates genuine strategic depth without any real-time action.

---

## 7. Resolution Summary (Happy Path)

```
Day N, any time:
  → Guild spends Siege Writ
  → District enters Siege state

Day N, until timer:
  → All guilds route caravans carrying military units to district center
  → No visibility into opponent commitments

Day N, resolution timer (e.g. 20:00 UTC):
  → All committed forces revealed simultaneously
  → Stage 1: Every attacker calculated vs defender (theoretical, using starting values)
    → Attackers who lose to the defender are eliminated
  → If all attackers eliminated: defender retains control
  → Stage 2: Surviving attackers run round-robin vs each other
    → Guild with most wins takes control
  → Stage 3 (if tied): Highest surviving power vs defender breaks the tie
  → All units consumed (all guilds, all stages)
  → Maintenance clock begins for new controller
```

---

## 8. Open / TBD

| Item | Status |
|---|---|
| Siege Writ exact recipe and cost | TBD |
| Base maintenance cost per district | TBD |
| Maintenance resource composition (Field Rations + Gold?) | TBD |
| T3 Ranged unit (Longbow? Mounted Archer?) | TBD |
| Resolution timer — UTC time and whether it varies by region | TBD |
| Neutral district mechanics | Resolved — declaration required; uncontested = default win; multi-attacker = round-robin, no Stage 1 |
| Guild storage for maintenance (separate from empire storage?) | TBD |
| Whether declaration can be retracted once made | TBD |
| Combat log / post-battle visibility (what do all guilds see after resolution?) | TBD |
