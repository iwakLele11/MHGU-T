/**
 * calculator.js — pure, DOM-free, Alpine-free calculation functions.
 *
 * STAGE 1 SKELETON ONLY. Signatures are defined; bodies are empty. All of these are
 * implemented in Stage 3. See docs/STAGE1-DESIGN.md section 5.1 for the design.
 *
 * Each function takes plain data and returns plain data so it stays easy to test.
 */

/**
 * Sum skill points across all equipped pieces, applying the Torso Up rule.
 *
 * Torso Up: each piece with the "Torso Up" marker multiplies the Chest contribution
 * (Chest's own skill points PLUS points from decorations installed on the Chest).
 * Multiplier = 1 + torsoUpCount, so 2 Torso Up pieces -> Chest contribution x3.
 *
 * @param {object} equipment - the build state (weapon, armor map, charm, decorations map)
 * @returns {Object<string, number>} map of skillName -> total points
 */
function computeSkillTotals(equipment) {
  // Stage 3
  return {};
}

/**
 * Match skill totals against activation thresholds.
 * Positive thresholds: +10 / +15 / +20. Negative skills: -10 / -15.
 * Active skills are returned first (sorted), then inactive ones with "x / threshold" progress.
 *
 * @param {Object<string, number>} totals - from computeSkillTotals
 * @param {Array<object>} skills - skills.json entries (with `levels`)
 * @returns {Array<object>} resolved skill rows (active-first, with progress + badge state)
 */
function resolveActiveSkills(totals, skills) {
  // Stage 3
  return [];
}

/**
 * Apply the Torso Up multiplier to the Chest contribution.
 *
 * @param {number} chestSkillPoints - Chest piece's own skill points for a tree
 * @param {number} chestDecoPoints - points from decorations installed on the Chest
 * @param {number} torsoUpCount - number of equipped pieces carrying "Torso Up"
 * @returns {number} multiplied Chest contribution ((base + deco) * (1 + torsoUpCount))
 */
function applyTorsoUp(chestSkillPoints, chestDecoPoints, torsoUpCount) {
  // Stage 3
  return 0;
}

/**
 * Total defense and the five elemental resistances for the current build.
 *
 * @param {object} equipment - the build state
 * @returns {{defense: number, resistances: {fire:number,water:number,thunder:number,ice:number,dragon:number}}}
 */
function computeDefenseAndResistances(equipment) {
  // Stage 3
  return null;
}

/**
 * Summarize the equipped weapon's stats for the summary panel.
 *
 * @param {object|null} weapon - the equipped weapon (weapons.json entry) or null
 * @returns {object|null} attack, affinity, element/status, displayed sharpness level
 */
function summarizeWeaponStats(weapon) {
  // Stage 3
  return null;
}

// Expose on window so app.js (loaded as a classic script) can call these.
window.MhguCalc = {
  computeSkillTotals,
  resolveActiveSkills,
  applyTorsoUp,
  computeDefenseAndResistances,
  summarizeWeaponStats,
};
