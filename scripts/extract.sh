#!/usr/bin/env bash
#
# extract.sh — one-time SQLite -> JSON extractor for the MHGU Web Companion.
#
# Reads mhgu_codex.db and writes the four data/*.json files the static web app
# consumes. The authoritative SQL + transform rules live in
# docs/STAGE1-DESIGN.md section 3.
#
# Pipeline: sqlite3 (.mode json) dumps the raw rows of each relevant table into
# a temporary directory, then scripts/transform.js applies the parsing/cleaning
# transforms (slots -> slotCount, sharpness -> nested int arrays, Body -> Chest,
# hunterType from setName, Torso Up flag, embedded skills + thresholds) and
# writes the final JSON files.
#
# Usage:
#   bash scripts/extract.sh /path/to/mhgu_codex.db ./data
#
# Defaults: DB = /projects/sandbox/mhgu_codex.db, OUT = ./data
#
# Requires: sqlite3 CLI and node (reads the DB locally; no network).

set -euo pipefail

DB="${1:-/projects/sandbox/mhgu_codex.db}"
OUT="${2:-./data}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "error: sqlite3 CLI not found on PATH" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found on PATH" >&2
  exit 1
fi
if [[ ! -f "$DB" ]]; then
  echo "error: database not found: $DB" >&2
  exit 1
fi

mkdir -p "$OUT"

RAW_DIR="$(mktemp -d)"
cleanup() { rm -rf "$RAW_DIR"; }
trap cleanup EXIT

echo "Extracting raw rows from $DB ..."

# Each query emits a JSON array of rows into $RAW_DIR/<table>.json.
# Reference SQL is from docs/STAGE1-DESIGN.md section 3.
dump() {
  local name="$1" sql="$2"
  sqlite3 -json "$DB" "$sql" > "$RAW_DIR/$name.json"
}

dump weapons "SELECT id, name, type, treeName, upgradeFrom, attack, affinity, element, elementValue, special, slots, sharpness, rarity, description FROM weapons ORDER BY type, id;"

dump armor "SELECT id, name, setName, piece, defense, maxDefense, fireRes, waterRes, thunderRes, iceRes, dragonRes, slots, rarity, description FROM armor ORDER BY setName, piece, id;"

dump armor_skills "SELECT armorId, skillName, points FROM armor_skills ORDER BY armorId;"

dump skills "SELECT id, name, treeName, category, maxPoints, description FROM skills WHERE name <> 'Torso Up' ORDER BY id;"

dump skill_levels "SELECT skillId, points, effect FROM skill_levels ORDER BY skillId, points DESC;"

dump decorations "SELECT id, name, slotSize, rarity, obtain, description FROM decorations ORDER BY id;"

dump decoration_skills "SELECT decorationId, skillName, points FROM decoration_skills ORDER BY decorationId;"

echo "Transforming and writing JSON to $OUT ..."
node "$SCRIPT_DIR/transform.js" "$RAW_DIR" "$OUT"

echo "Done."
