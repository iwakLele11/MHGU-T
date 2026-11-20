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

    // Human-readable load error (Stage 2). Empty string when there is no error.
    loadError: '',

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
      await this.loadData();
      // Stage 3: this.loadSavedBuilds();
    },

    /**
     * Fetch the four data/*.json files in parallel and populate `this.data`.
     * On any failure, set a readable `this.loadError` and leave `data.loaded` false.
     * @returns {Promise<void>}
     */
    async loadData() {
      this.loadError = '';
      const files = ['weapons', 'armors', 'skills', 'decorations'];
      try {
        const responses = await Promise.all(
          files.map((f) => fetch('data/' + f + '.json'))
        );
        responses.forEach((res, i) => {
          if (!res.ok) {
            throw new Error('data/' + files[i] + '.json (HTTP ' + res.status + ')');
          }
        });
        const [weapons, armors, skills, decorations] = await Promise.all(
          responses.map((res) => res.json())
        );
        this.data.weapons = weapons;
        this.data.armors = armors;
        this.data.skills = skills;
        this.data.decorations = decorations;
        this.data.loaded = true;
      } catch (err) {
        this.data.loaded = false;
        this.loadError =
          'Could not load game data: ' +
          (err && err.message ? err.message : String(err)) +
          '. Serve this folder over HTTP (e.g. "python3 -m http.server") and reload.';
      }
    },

    // --- Stage 2: filtering / sorting / pagination -------------------------------

    // Order of the 7 sharpness segments: Red, Orange, Yellow, Green, Blue, White, Purple.
    sharpnessColors: ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'White', 'Purple'],

    /** Reset weapon paging to the first page. Call on any weapon filter change. */
    resetWeaponPaging() {
      this.weaponFilter.visibleCount = 40;
    },

    /** Reset armor paging to the first page. Call on any armor filter change. */
    resetArmorPaging() {
      this.armorFilter.visibleCount = 40;
    },

    /** Full weapon list after applying weaponFilter, then sorted. */
    get filteredWeapons() {
      const f = this.weaponFilter;
      const search = f.search.trim().toLowerCase();
      const minAttack = Number(f.minAttack) || 0;
      const minSlots = Number(f.minSlots) || 0;
      const colorIndex = f.sharpnessColor
        ? this.sharpnessColors.indexOf(f.sharpnessColor)
        : -1;

      const result = this.data.weapons.filter((w) => {
        if (search && !w.name.toLowerCase().includes(search)) return false;
        if (f.type && w.type !== f.type) return false;
        if (w.attack < minAttack) return false;
        if (f.affinitySign === '+' && !(w.affinity > 0)) return false;
        if (f.affinitySign === '-' && !(w.affinity < 0)) return false;
        if (f.element !== '' && f.element !== 'any' && w.element !== f.element) return false;
        if (colorIndex >= 0) {
          const base = w.sharpness && w.sharpness[0];
          if (!base || !(base[colorIndex] > 0)) return false;
        }
        if ((w.slotCount || 0) < minSlots) return false;
        return true;
      });

      return this.sortRows(result, f.sort);
    },

    /** The slice of filteredWeapons currently rendered. */
    get visibleWeapons() {
      return this.filteredWeapons.slice(0, this.weaponFilter.visibleCount);
    },

    /** Render 40 more weapons (clamped to the filtered total). */
    loadMoreWeapons() {
      const total = this.filteredWeapons.length;
      this.weaponFilter.visibleCount = Math.min(
        this.weaponFilter.visibleCount + 40,
        total
      );
    },

    /** Full armor list after applying armorFilter, then sorted. */
    get filteredArmors() {
      const f = this.armorFilter;
      const search = f.search.trim().toLowerCase();
      const minDefense = Number(f.minDefense) || 0;
      const minSlots = Number(f.minSlots) || 0;
      const bySkill = f.bySkill.trim().toLowerCase();
      const resType = f.resistance.type;
      const resMin = Number(f.resistance.min) || 0;

      const result = this.data.armors.filter((a) => {
        if (search && !a.name.toLowerCase().includes(search)) return false;
        if (f.piece && a.piece !== f.piece) return false;
        // Selecting a specific hunter type matches that type plus universal "Both" pieces.
        if (f.hunterType && f.hunterType !== 'any') {
          if (a.hunterType !== f.hunterType && a.hunterType !== 'Both') return false;
        }
        if (a.defense < minDefense) return false;
        if (resType) {
          const r = a.resistances ? a.resistances[resType] : undefined;
          if (!(Number(r) >= resMin)) return false;
        }
        if ((a.slotCount || 0) < minSlots) return false;
        if (bySkill) {
          const hit =
            Array.isArray(a.skills) &&
            a.skills.some((s) => s.name.toLowerCase().includes(bySkill));
          if (!hit) return false;
        }
        return true;
      });

      return this.sortRows(result, f.sort);
    },

    /** The slice of filteredArmors currently rendered. */
    get visibleArmors() {
      return this.filteredArmors.slice(0, this.armorFilter.visibleCount);
    },

    /** Render 40 more armor pieces (clamped to the filtered total). */
    loadMoreArmors() {
      const total = this.filteredArmors.length;
      this.armorFilter.visibleCount = Math.min(
        this.armorFilter.visibleCount + 40,
        total
      );
    },

    /**
     * Sort a copy of `rows` by a numeric-or-string key in the given direction.
     * @param {Array<object>} rows
     * @param {{key: string, dir: string}} sort
     * @returns {Array<object>}
     */
    sortRows(rows, sort) {
      const key = sort && sort.key ? sort.key : null;
      if (!key) return rows;
      const dir = sort.dir === 'asc' ? 1 : -1;
      return rows.slice().sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir;
        }
        return String(av == null ? '' : av).localeCompare(String(bv == null ? '' : bv)) * dir;
      });
    },

    /**
     * Build the filled/empty slot indicator list for a piece's slotCount.
     * @param {number} slotCount 0-3
     * @returns {Array<boolean>} length 3; true = filled slot
     */
    slotDots(slotCount) {
      const n = Math.max(0, Math.min(3, Number(slotCount) || 0));
      return [0, 1, 2].map((i) => i < n);
    },

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
