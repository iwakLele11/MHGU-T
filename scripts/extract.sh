#!/usr/bin/env bash
#
# extract.sh — one-time SQLite -> JSON extractor for the MHGU Web Companion.
#
# STAGE 1 STUB. This script is documented but intentionally NOT implemented yet.
# The full implementation (and the authoritative SQL + transform rules) is specified
# in docs/STAGE1-DESIGN.md section 3. It will be filled in when the data/*.json files
# are generated in a later stage.
#
# Intended usage:
#   bash scripts/extract.sh /path/to/mhgu_codex.db ./data
#
# What it will do (per the design doc):
#   1. Read the weapons, armor, armor_skills, skills, skill_levels, decorations,
#      and decoration_skills tables from the SQLite database.
#   2. Apply transforms:
#        - slots glyph string ("◯——") -> integer slotCount (0-3), keep raw as slotsRaw
#        - sharpness "a.b.c.d.e.f.g ..." -> array of 7-int arrays (one per handicraft level)
#        - armor piece "Body" -> "Chest"
#        - setName suffix "(Blademaster)"/"(Gunner)"/none -> hunterType + cleaned setName
#        - "Torso Up" armor_skills row -> torsoUp boolean flag (excluded from skills[]);
#          also drop the degenerate "Torso Up" skills row (id 203) from skills.json
#        - join skill_levels -> skills for activation thresholds (sorted high to low)
#        - embed armor/decoration skills from their join tables
#   3. Write data/weapons.json, data/armors.json, data/skills.json, data/decorations.json.
#
# Requires: sqlite3 CLI (reads the DB locally; no network).

set -euo pipefail

echo "scripts/extract.sh is a Stage 1 stub. Implementation is deferred."
echo "See docs/STAGE1-DESIGN.md section 3 for the extraction plan and SQL."
exit 0
