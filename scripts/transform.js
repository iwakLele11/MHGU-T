#!/usr/bin/env node
//
// transform.js — applies the Stage 1 design transforms to raw SQLite rows and
// writes the four data/*.json files consumed by the web companion.
//
// Invoked by scripts/extract.sh. It receives, via argv, a directory holding the
// intermediate raw JSON dumps (one per table, produced by `sqlite3 -json`) and
// the output directory for the final data/*.json files.
//
// Usage: node scripts/transform.js <rawDir> <outDir>
//
// Transform rules are specified in docs/STAGE1-DESIGN.md section 3.

'use strict';

const fs = require('fs');
const path = require('path');

const OPEN_SLOT = '\u25EF'; // ◯ open slot glyph

const rawDir = process.argv[2];
const outDir = process.argv[3];

if (!rawDir || !outDir) {
  console.error('Usage: node scripts/transform.js <rawDir> <outDir>');
  process.exit(1);
}

function readRaw(name) {
  const file = path.join(rawDir, name + '.json');
  const text = fs.readFileSync(file, 'utf8').trim();
  // sqlite3 -json emits an empty string for an empty result set.
  if (text === '') return [];
  return JSON.parse(text);
}

function writeOut(name, data) {
  const file = path.join(outDir, name + '.json');
  fs.writeFileSync(file, JSON.stringify(data) + '\n');
  return file;
}

// Count open-slot glyphs (0-3) in a slots string like "◯——".
function parseSlotCount(slots) {
  if (!slots) return 0;
  let count = 0;
  for (const ch of slots) {
    if (ch === OPEN_SLOT) count++;
  }
  return count;
}

// "7.7.11.5.0.0.0 7.7.11.7.0.0.0" -> [[7,7,11,5,0,0,0],[7,7,11,7,0,0,0]]
function parseSharpness(sharpness) {
  if (!sharpness) return [];
  return sharpness
    .trim()
    .split(/\s+/)
    .map((set) => set.split('.').map((n) => parseInt(n, 10)));
}

// --- weapons -------------------------------------------------------------
function buildWeapons() {
  const rows = readRaw('weapons');
  return rows.map((r) => {
    const sharpness = parseSharpness(r.sharpness);
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      treeName: r.treeName,
      upgradeFrom: r.upgradeFrom == null || r.upgradeFrom === '' ? null : r.upgradeFrom,
      attack: r.attack,
      affinity: r.affinity,
      element: r.element,
      elementValue: r.elementValue,
      special: r.special,
      slotCount: parseSlotCount(r.slots),
      slotsRaw: r.slots,
      rarity: r.rarity,
      description: r.description,
      sharpness: sharpness,
      sharpnessMaxLevel: sharpness.length > 0 ? sharpness.length - 1 : 0,
    };
  });
}

// --- armor ---------------------------------------------------------------
function cleanSetName(setNameRaw) {
  if (setNameRaw.endsWith(' (Blademaster)')) {
    return { setName: setNameRaw.slice(0, -' (Blademaster)'.length), hunterType: 'Blademaster' };
  }
  if (setNameRaw.endsWith(' (Gunner)')) {
    return { setName: setNameRaw.slice(0, -' (Gunner)'.length), hunterType: 'Gunner' };
  }
  return { setName: setNameRaw, hunterType: 'Both' };
}

function buildArmors() {
  const rows = readRaw('armor');
  const skillRows = readRaw('armor_skills');

  // Group armor_skills by armorId.
  const byArmor = new Map();
  for (const s of skillRows) {
    if (!byArmor.has(s.armorId)) byArmor.set(s.armorId, []);
    byArmor.get(s.armorId).push(s);
  }

  return rows.map((r) => {
    const { setName, hunterType } = cleanSetName(r.setName);
    const piece = r.piece === 'Body' ? 'Chest' : r.piece;

    let torsoUp = false;
    const skills = [];
    for (const s of byArmor.get(r.id) || []) {
      if (s.skillName === 'Torso Up') {
        torsoUp = true;
        continue;
      }
      skills.push({ name: s.skillName, points: s.points });
    }

    return {
      id: r.id,
      name: r.name,
      setName: setName,
      setNameRaw: r.setName,
      hunterType: hunterType,
      piece: piece,
      defense: r.defense,
      maxDefense: r.maxDefense,
      resistances: {
        fire: r.fireRes,
        water: r.waterRes,
        thunder: r.thunderRes,
        ice: r.iceRes,
        dragon: r.dragonRes,
      },
      slotCount: parseSlotCount(r.slots),
      slotsRaw: r.slots,
      rarity: r.rarity,
      description: r.description,
      torsoUp: torsoUp,
      skills: skills,
    };
  });
}

// --- skills --------------------------------------------------------------
function buildSkills() {
  const rows = readRaw('skills'); // already excludes "Torso Up" via SQL WHERE clause
  const levelRows = readRaw('skill_levels'); // ordered by skillId, points DESC

  const bySkill = new Map();
  for (const l of levelRows) {
    if (!bySkill.has(l.skillId)) bySkill.set(l.skillId, []);
    bySkill.get(l.skillId).push({ points: l.points, effect: l.effect });
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    treeName: r.treeName,
    category: r.category,
    maxPoints: r.maxPoints,
    description: r.description,
    levels: bySkill.get(r.id) || [],
  }));
}

// --- decorations ---------------------------------------------------------
function buildDecorations() {
  const rows = readRaw('decorations');
  const skillRows = readRaw('decoration_skills');

  const byDeco = new Map();
  for (const s of skillRows) {
    if (!byDeco.has(s.decorationId)) byDeco.set(s.decorationId, []);
    byDeco.get(s.decorationId).push({ name: s.skillName, points: s.points });
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slotSize: r.slotSize,
    rarity: r.rarity,
    obtain: r.obtain,
    description: r.description,
    skills: byDeco.get(r.id) || [],
  }));
}

const outputs = {
  weapons: buildWeapons(),
  armors: buildArmors(),
  skills: buildSkills(),
  decorations: buildDecorations(),
};

for (const [name, data] of Object.entries(outputs)) {
  const file = writeOut(name, data);
  console.log(`  ${name}.json: ${data.length} rows -> ${file}`);
}
