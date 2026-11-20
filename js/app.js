/**
 * app.js — Alpine.js components/store, JSON loading, filtering, pagination, localStorage.
 *
 * STAGE 1 SKELETON ONLY. These are stubs that define the intended shape; no feature
 * logic is implemented. See docs/STAGE1-DESIGN.md sections 5 and 6 for the full design.
 *
 * Responsibilities (this module): the Alpine store/component, the fetch() JSON loader,
 * weapon/armor filter + sort + pagination state, the Set Builder equipment state,
 * decoration slotting actions, and localStorage save/load/delete + "Copy Build Text".
 * Pure calculations live in calculator.js and are imported here.
 */

/**
 * The root Alpine component factory.
 * @returns {object} Alpine x-data object (shape per docs/STAGE1-DESIGN.md section 5.2)
 */
function mhguApp() {
  return {
    activeTab: 'weapons', // "weapons" | "armor" | "builder"

    data: { weapons: [], armors: [], skills: [], decorations: [], loaded: false },

    // Weapon filter state (Stage 2). visibleCount drives the Load More slice (30-50).
    weaponFilter: {
      search: '', type: '', minAttack: 0, affinitySign: 'any',
      element: '', sharpnessColor: '', minSlots: 0,
      sort: { key: 'attack', dir: 'desc' }, visibleCount: 40,
    },

    // Armor filter state (Stage 2).
    armorFilter: {
      search: '', piece: '', hunterType: '',
      minDefense: 0, resistance: { type: '', min: 0 }, minSlots: 0, bySkill: '',
      sort: { key: 'defense', dir: 'desc' }, visibleCount: 40,
    },

    // Set Builder state (Stage 3).
    build: {
      weapon: null,
      armor: { Head: null, Chest: null, Arms: null, Waist: null, Legs: null },
      charm: { skills: [], slotCount: 0 },
      decorations: { weapon: [], Head: [], Chest: [], Arms: [], Waist: [], Legs: [], charm: [] },
    },

    savedBuilds: [],

    /** Lifecycle hook: load JSON once when the component initializes. Stage 2. */
    async init() {
      // Stage 2: await this.loadData(); this.loadSavedBuilds();
    },

    /**
     * Fetch the four data/*.json files in parallel and populate `this.data`.
     * @returns {Promise<void>}
     */
    async loadData() {
      // Stage 2: fetch data/weapons.json, armors.json, skills.json, decorations.json.
    },

    // --- Stage 2: filtering / sorting / pagination -------------------------------
    get filteredWeapons() { /* Stage 2 */ return []; },
    get visibleWeapons() { /* Stage 2: slice to weaponFilter.visibleCount */ return []; },
    get filteredArmors() { /* Stage 2 */ return []; },
    get visibleArmors() { /* Stage 2: slice to armorFilter.visibleCount */ return []; },
    loadMoreWeapons() { /* Stage 2 */ },
    loadMoreArmors() { /* Stage 2 */ },

    // --- Stage 3: set builder getters (delegate to calculator.js) ----------------
    get builderHunterType() { /* Stage 3: derive from this.build.weapon */ return 'Both'; },
    armorChoicesFor(/* piece */) { /* Stage 3: Blademaster/Gunner lock + "Both" */ return []; },
    get skillTotals() { /* Stage 3: computeSkillTotals(this.build) */ return {}; },
    get activeSkills() { /* Stage 3: resolveActiveSkills(...) */ return []; },
    get defenseSummary() { /* Stage 3: computeDefenseAndResistances(this.build) */ return null; },
    get weaponSummary() { /* Stage 3: summarizeWeaponStats(this.build.weapon) */ return null; },

    // --- Stage 3: decoration slotting --------------------------------------------
    remainingSlots(/* pieceKey */) { /* Stage 3: slotCount - used capacity */ return 0; },
    installDecoration(/* pieceKey, decoration */) { /* Stage 3: capacity check + add */ },
    removeDecoration(/* pieceKey, index */) { /* Stage 3 */ },

    // --- Stage 3: localStorage + share -------------------------------------------
    loadSavedBuilds() { /* Stage 3 */ },
    saveBuild(/* name */) { /* Stage 3 */ },
    deleteBuild(/* id */) { /* Stage 3 */ },
    applyBuild(/* id */) { /* Stage 3 */ },
    copyBuildText() { /* Stage 3: build a tidy text summary + clipboard */ },
  };
}

// Register the component with Alpine once it is available.
document.addEventListener('alpine:init', () => {
  window.Alpine && window.Alpine.data('mhguApp', mhguApp);
});
