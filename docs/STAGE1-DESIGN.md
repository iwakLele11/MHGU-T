# MHGU Web Companion & Set Builder — Stage 1 Design

> **This is Stage 1 of 3.** Per the agreed workflow ("Jangan Langsung Dump Semua Kode"),
> this document only covers: schema validation, the JSON data shapes, the SQLite to JSON
> extraction plan, the project folder structure, and the Alpine.js state/module design.
> It ships with skeleton (stub) files only.
>
> **Stage 2** (index.html, the JSON loader, and the Weapon & Armor filter pages) and
> **Stage 3** (the Set Builder with decoration slotting, custom charm, and the Torso Up
> calculator) are **deferred and will not be built until you approve this design.**

---

## 0. Note on your pasted JSON samples

Section 2 of the brief contained literal placeholders (`[TEMPEL 1 CONTOH OBJEK ... DI SINI]`),
so there were no real sample objects to validate against. Instead, the real data source is the
bundled SQLite database `mhgu_codex.db` (the same `mhgu_codex.db.gz` the reference Android app
ships in its assets). Every shape, field name, and example in this document is taken directly
from that database, so the JSON files we design here are what the app will actually consume.

---

## 1. Schema validation

The database is a standard, unencrypted SQLite 3 file. The seven tables relevant to this app
(plus two helper tables) validate as follows:

| Table                     | Rows   | Role |
|---------------------------|--------|------|
| `weapons`                 | 10,877 | Weapon list + stats |
| `armor`                   | 5,637  | Armor pieces + stats |
| `armor_skills`            | 14,086 | Skill points granted by each armor piece (incl. "Torso Up") |
| `skills`                  | 205    | Skill trees + max points |
| `skill_levels`            | 326    | Activation thresholds per skill tree |
| `decorations`             | 242    | Decorations + slot size |
| `decoration_skills`       | 424    | Skill points granted by each decoration |
| `skill_armor_sources`     | —      | Helper: reverse lookup skill → armor (names have no hunter suffix) |
| `skill_decoration_sources`| —      | Helper: reverse lookup skill → decoration |

**Column layouts (verified):**

- `weapons(id, name, type, treeName, upgradeFrom?, attack, affinity, element, elementValue, sharpness, special, slots, rarity, description)`
- `armor(id, name, setName, piece, defense, maxDefense, fireRes, waterRes, thunderRes, iceRes, dragonRes, slots, rarity, description)`
- `armor_skills(armorId, skillName, points)` — PK `(armorId, skillName)`
- `skills(id, name, treeName, category, maxPoints, description)`
- `skill_levels(id, skillId, points, effect)`
- `decorations(id, name, slotSize, rarity, obtain, description)`
- `decoration_skills(decorationId, skillName, points)` — PK `(decorationId, skillName)`

**Key findings that shape the design:**

1. **14 weapon types** confirmed: Great Sword, Sword and Shield, Hammer, Lance, Heavy Bowgun,
   Light Bowgun, Long Sword, Switch Axe, Gunlance, Bow, Dual Blades, Hunting Horn,
   Insect Glaive, Charge Blade.
2. **`element` mixes true elements and status.** Values seen: `Fire`, `Water`, `Thunder`, `Ice`,
   `Dragon` (elements) and `Poison`, `Paralysis`, `Sleep`, `Blastblight` (status), or `""` (none).
   The weapon `special` field is separate and holds e.g. `"Defense: +10"`. The UI "Element/Status"
   filter therefore spans both element and status values.
3. **Slots are a 3-glyph string** using `◯` (U+25EF, open slot) and `—` (U+2014, em dash = no slot):
   `———`=0, `◯——`=1, `◯◯—`=2, `◯◯◯`=3. We parse this to an integer `slotCount` (0–3).
4. **Sharpness is a space-separated list of hit-level sets.** Each set is 7 dot-joined integers in
   the fixed order **Red.Orange.Yellow.Green.Blue.White.Purple**. Weapons have either **1 set**
   (2,156 weapons) or **3 sets** (8,721 weapons). The 3 sets correspond to **base / Sharpness+1 /
   Sharpness+2** (Handicraft levels). Example: `7.7.11.5.0.0.0 7.7.11.7.0.0.0 7.7.11.8.2.0.0`.
5. **Hunter type (Blademaster/Gunner) is NOT a column.** See the gap resolution in §1.1.
6. **`armor_skills.skillName` joins exactly to `skills.name`** (0 mismatches — every skillName,
   including `"Torso Up"`, has a matching `skills.name`). `"Torso Up"` appears as a `skillName`
   on 25 armor pieces and **does** exist in `skills` as a degenerate row (id 203, category
   `"Armor only"`, `maxPoints` 0, 0 threshold levels). It is not a normal skill tree: it is the
   marker for the Torso Up mechanic. We therefore handle it specially rather than as a skill —
   extraction pulls it out of each piece into a `torsoUp` boolean flag and **excludes the id-203
   row from `skills.json`** (see §2.3 and §3 step 6), so the skill resolver never sees it. Max 4
   skills per piece.
7. **DB `piece` = `Body`, UI = `Chest`.** `piece` values are `Head, Body, Arms, Waist, Legs`; the UI
   calls the torso slot "Chest". We map Body → Chest in the JSON (see §2).

### 1.1 Resolving the Blademaster/Gunner gap

The `armor` table has no hunter-type column, but the Blademaster vs Gunner Lock rule needs one.
**Hunter type is encoded as a suffix in `setName`:** `"... (Blademaster)"` or `"... (Gunner)"`.

Counts in the DB:

| setName suffix        | pieces |
|-----------------------|--------|
| `(Blademaster)`       | 2,761  |
| `(Gunner)`            | 2,761  |
| neither (universal)   | 115    |

The 115 no-suffix pieces are low-rarity universal gear (e.g. `Leather`, `Chainmail`, `Yukumo`)
that both hunter types can wear. **Chosen strategy:** during extraction, parse `setName`, derive
`hunterType ∈ {"Blademaster", "Gunner", "Both"}` (`"Both"` when there is no suffix), and store a
cleaned `setName` with the suffix stripped alongside the raw value. This cleanly satisfies the
Stage 3 rule: picking a Blademaster or Gunner weapon filters Chest/Arms/Waist/Legs to that type
`OR "Both"`; Head follows the universal/specific data as-is.

This is corroborated by the reference Android app's domain model
(`mhgudb/.../feature/armor/domain/Armor.kt`), which carries the same columns and no hunter-type
field, implying the type is derived from the set name there too.

---

## 2. JSON data file shapes

Four files, fetched once at load. All mapped/cleaned field names are listed; a real example from
the DB follows each shape.

### 2.1 `data/weapons.json`

```jsonc
{
  "id": 66817,
  "name": "Igneous Blade 1",
  "type": "Great Sword",
  "treeName": "Petrified Blade 1",
  "upgradeFrom": "Halberd 3",      // null when none
  "attack": 160,
  "affinity": 15,                   // signed, can be negative
  "element": "Fire",               // element OR status OR "" (none)
  "elementValue": 20,
  "special": "",                    // e.g. "Defense: +10", else ""
  "slotCount": 1,                   // parsed 0-3 from the glyph string
  "slotsRaw": "◯——",               // original glyphs, kept for display
  "rarity": 5,
  "description": "A fiery sword infused with the fury of the earth...",
  // Sharpness parsed into one 7-int array per handicraft level.
  // Order per level: [Red, Orange, Yellow, Green, Blue, White, Purple].
  "sharpness": [
    [7, 7, 11, 5, 0, 0, 0],         // base       (display default)
    [7, 7, 11, 7, 0, 0, 0],         // Sharpness+1
    [7, 7, 11, 8, 2, 0, 0]          // Sharpness+2
  ],
  "sharpnessMaxLevel": 2            // index into sharpness[]; 0 when only base exists
}
```

**Display decision:** the builder shows **`sharpness[0]` (base) by default**, with a note/toggle
that +1 / +2 levels exist (`sharpness.length > 1`). Weapons with a single set simply have a
one-element `sharpness` array and `sharpnessMaxLevel: 0`.

### 2.2 `data/armors.json`

```jsonc
{
  "id": 1310724,
  "name": "Hunting Helm",
  "setName": "Hunting",            // cleaned: suffix stripped
  "setNameRaw": "Hunting (Blademaster)",
  "hunterType": "Blademaster",     // "Blademaster" | "Gunner" | "Both"
  "piece": "Head",                 // Head | Chest | Arms | Waist | Legs  (Body -> Chest)
  "defense": 2,
  "maxDefense": 50,
  "resistances": { "fire": 1, "water": 0, "thunder": 0, "ice": 0, "dragon": 0 },
  "slotCount": 1,                  // parsed 0-3
  "slotsRaw": "◯——",
  "rarity": 1,
  "description": "",
  "torsoUp": false,                // true if this piece has the "Torso Up" skillName
  // Normal skills only (Torso Up is pulled out into the flag above):
  "skills": [ { "name": "Psychic", "points": 3 } ]
}
```

A real Blademaster chest (`piece: "Chest"`) with Torso Up would carry `"torsoUp": true` and its
own `skills` array.

### 2.3 `data/skills.json`

Keyed on the skill tree, with activation thresholds from `skill_levels` sorted high → low so the
calculator can match totals against them. The degenerate `"Torso Up"` row (id 203, `maxPoints` 0,
no thresholds) is **excluded** from this file — it is handled via the armor `torsoUp` flag and
`applyTorsoUp`, not as a skill the resolver evaluates. So `skills.json` holds 204 entries.

```jsonc
{
  "id": 4,
  "name": "Stun",
  "treeName": "Negate Stun / Halve Stun",
  "category": "Jewel",             // "Jewel" | "Armor only"
  "maxPoints": 15,
  "description": "3 skill thresholds in the Stun tree.",
  // thresholds: positive = activation (+10/+15/+20), negative = negative skill (-10/-15)
  "levels": [
    { "points": 15,  "effect": "Negate Stun: Prevents Stun." },
    { "points": 10,  "effect": "Halve Stun: Reduces the likelihood of being Stunned by 50%." },
    { "points": -10, "effect": "Double Stun: Makes it harder to recover from being Stunned." }
  ]
}
```

### 2.4 `data/decorations.json`

```jsonc
{
  "id": 2639,
  "name": "Antidote Jwl 2",
  "slotSize": 2,                   // 1-3, must fit remaining slot capacity on a piece
  "rarity": 5,
  "obtain": "Create: Sunspire Jewel, Iodrome Hide x2, ...",
  "description": "A Decoration that boosts Poison skills.",
  "skills": [
    { "name": "Poison", "points": 3 },
    { "name": "Stun",   "points": -1 }
  ]
}
```

---

## 3. SQLite → JSON extraction plan

A single one-time script (`scripts/extract.sh`) reads `mhgu_codex.db` and writes the four
`data/*.json` files. It runs **locally** (no network); the browser never touches SQLite.

**Transforms applied during extraction:**

1. **Slots → `slotCount`:** count `◯` (U+25EF) characters in the `slots` string (0–3); keep the
   raw string as `slotsRaw`.
2. **Sharpness → nested arrays:** split on spaces into sets, split each set on `.` into 7 ints;
   `sharpnessMaxLevel = sets.length - 1`.
3. **Armor `piece` Body → Chest:** map the single value `Body` to `Chest`; others unchanged.
4. **Hunter type:** if `setName` ends with `(Blademaster)` → `Blademaster`; `(Gunner)` → `Gunner`;
   otherwise `Both`. `setName` = raw with the `" (Blademaster)"` / `" (Gunner)"` suffix removed;
   keep raw as `setNameRaw`.
5. **Torso Up:** when an armor piece has an `armor_skills` row with `skillName = "Torso Up"`, set
   `torsoUp: true` and exclude that row from the piece's `skills` array. Also **drop the matching
   `skills` row (id 203, name `"Torso Up"`) from `skills.json`** so the skill resolver never
   receives a degenerate zero-threshold tree.
6. **Skill thresholds:** join `skill_levels.skillId → skills.id`, sort by `points` descending,
   attach as `levels`.
7. **Embedded skills:** `armor.skills` from `armor_skills`, `decorations.skills` from
   `decoration_skills` (both join cleanly to `skills.name`).

**Reference SQL (the extraction script wraps these; a small transform layer applies steps 1–6):**

```sql
-- weapons (raw; slots + sharpness parsed in the script's transform step)
SELECT id, name, type, treeName, upgradeFrom, attack, affinity,
       element, elementValue, special, slots, sharpness, rarity, description
FROM weapons ORDER BY type, id;

-- armor (raw; Body->Chest, hunterType, setName cleaning done in transform step)
SELECT id, name, setName, piece, defense, maxDefense,
       fireRes, waterRes, thunderRes, iceRes, dragonRes, slots, rarity, description
FROM armor ORDER BY setName, piece, id;

-- armor skills (Torso Up separated in transform step)
SELECT armorId, skillName, points FROM armor_skills ORDER BY armorId;

-- skills + thresholds  (exclude the degenerate "Torso Up" marker row, id 203)
SELECT id, name, treeName, category, maxPoints, description
FROM skills WHERE name <> 'Torso Up' ORDER BY id;
SELECT skillId, points, effect FROM skill_levels ORDER BY skillId, points DESC;

-- decorations + skills
SELECT id, name, slotSize, rarity, obtain, description FROM decorations ORDER BY id;
SELECT decorationId, skillName, points FROM decoration_skills ORDER BY decorationId;
```

**Regeneration command (documented, run once when the DB changes):**

```bash
bash scripts/extract.sh /path/to/mhgu_codex.db ./data
```

> The full `data/*.json` files are generated in a later stage; Stage 1 only designs and stubs the
> extractor.

---

## 4. Project folder structure

```
MHGU-T/
├── index.html              # single-page shell; Tailwind + Alpine via CDN
├── css/                    # optional custom styles (sharpness bar, etc.) — may stay empty
├── js/
│   ├── app.js              # Alpine components/store, JSON loading, filtering, pagination, localStorage
│   └── calculator.js       # pure calculation functions (no DOM, no Alpine)
├── data/
│   ├── weapons.json        # generated by scripts/extract.sh (later stage)
│   ├── armors.json
│   ├── skills.json
│   └── decorations.json
├── scripts/
│   └── extract.sh          # one-time SQLite -> JSON extractor
├── docs/
│   └── STAGE1-DESIGN.md     # this document
└── README.md
```

No `package.json`, no bundler, no build step. Served as static files
(`python3 -m http.server 8000`) and opened in a browser.

---

## 5. Alpine.js state design & module split

### 5.1 Module responsibilities

- **`js/app.js`** — everything that touches Alpine or the DOM: the Alpine store/component, the
  `fetch()` JSON loader, filter + sort + pagination state, the Set Builder equipment state,
  decoration slotting actions, and localStorage save/load/delete + "Copy Build Text". It imports
  pure helpers from `calculator.js`.
- **`js/calculator.js`** — pure, DOM-free, Alpine-free functions that take plain data and return
  plain results, so they are easy to reason about and unit-test:
  - `computeSkillTotals(equipment)` → `{ [skillName]: totalPoints }`, applying the Torso Up rule.
  - `resolveActiveSkills(totals, skills)` → active skills (sorted first) + "x / threshold" progress
    for inactive ones, matching +10/+15/+20 and negatives -10/-15.
  - `applyTorsoUp(chestSkillPoints, chestDecoPoints, torsoUpCount)` → multiplied Chest contribution
    (multiplier = `1 + torsoUpCount`, so 2 pieces → ×3, per the stated rule).
  - `computeDefenseAndResistances(equipment)` → total defense + {fire,water,thunder,ice,dragon}.
  - `summarizeWeaponStats(weapon)` → attack, affinity, element/status, displayed sharpness level.

### 5.2 Alpine store / component shape (designed; implemented in Stages 2–3)

```jsonc
{
  "activeTab": "weapons",          // "weapons" | "armor" | "builder"

  "data": { "weapons": [], "armors": [], "skills": [], "decorations": [], "loaded": false },

  // Weapon filter page (Stage 2)
  "weaponFilter": {
    "search": "", "type": "", "minAttack": 0, "affinitySign": "any",
    "element": "", "sharpnessColor": "", "minSlots": 0,
    "sort": { "key": "attack", "dir": "desc" },
    "visibleCount": 40            // Load More step; render 30-50 at a time
  },

  // Armor filter page (Stage 2)
  "armorFilter": {
    "search": "", "piece": "", "hunterType": "",
    "minDefense": 0, "resistance": { "type": "", "min": 0 },
    "minSlots": 0, "bySkill": "",
    "sort": { "key": "defense", "dir": "desc" },
    "visibleCount": 40
  },

  // Set Builder (Stage 3)
  "build": {
    "weapon": null,
    "armor": { "Head": null, "Chest": null, "Arms": null, "Waist": null, "Legs": null },
    "charm": { "skills": [], "slotCount": 0 },        // up to 2 skills, points +/-, slots 0-3
    // decorations installed per piece key: "weapon" | "Head".."Legs" | "charm"
    "decorations": { "weapon": [], "Head": [], "Chest": [], "Arms": [], "Waist": [], "Legs": [], "charm": [] }
  },

  "savedBuilds": []                // mirror of localStorage
}
```

### 5.3 Reactive getters (real-time summary)

The right-hand summary panel is driven entirely by Alpine getters that delegate to
`calculator.js`, so it recomputes automatically whenever `build` changes:

- `get skillTotals()` → `computeSkillTotals(this.build)`
- `get activeSkills()` → `resolveActiveSkills(this.skillTotals, this.data.skills)`
- `get defenseSummary()` → `computeDefenseAndResistances(this.build)`
- `get weaponSummary()` → `summarizeWeaponStats(this.build.weapon)`

**Blademaster/Gunner Lock** is a derived getter: once a weapon is chosen, the armor pickers for
Chest/Arms/Waist/Legs filter to `hunterType === builderHunterType || hunterType === "Both"`; Head
is unfiltered.

**Decoration slotting** actions check that a decoration's `slotSize` fits the piece's remaining
capacity (`slotCount − sum(installed slotSizes)`), with install/remove per piece. Chest-installed
decoration points feed the Torso Up multiplier together with the Chest piece's own skills.

---

## 6. Performance & UI/UX notes

- **Pagination / Load More:** weapon (10,877) and armor (5,637) lists render at most **40 items**
  at a time (`visibleCount`, within the 30–50 range) with a "Load More" button, so `x-for` never
  mounts thousands of nodes. Filtering/sorting operate on the full array; only the slice is rendered.
- **Dark theme:** slate/zinc background with amber + emerald accents, tuned for dense data.
- **Responsive layout:** desktop uses a split screen — left = database filters / equipment pickers,
  right = a sticky Set Builder summary; mobile collapses to compact tab navigation.
- **Visual elements:**
  - Horizontal **sharpness color bar** rendered from the 7-int array
    (Red, Orange, Yellow, Green, Blue, White, Purple).
  - **Slot indicators** drawn from `slotCount` as filled/empty circles (e.g. `O O -`).
  - **Skill badges** colored green (active), gray (not yet active, shown as `8 / 10`),
    red (negative skill).

---

## 7. Stage 1 deliverables in this commit

- `docs/STAGE1-DESIGN.md` — this design.
- `index.html` — skeleton shell (CDN tags + dark body + placeholder), no feature logic.
- `js/app.js` — stub store/loader outline, `// Stage 2` / `// Stage 3` markers.
- `js/calculator.js` — stub function signatures, `// Stage 3` markers.
- `scripts/extract.sh` — documented stub (not run yet).
- `data/.gitkeep` — placeholder; real JSON generated later.
- `README.md` — overview + run command.

**Awaiting your approval before Stage 2.**
