// SQLite persistence using Node's built-in node:sqlite module.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS players (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  stat_points INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  crystals INTEGER NOT NULL DEFAULT 0,
  selected_hero TEXT NOT NULL DEFAULT 'aiden',
  team_json TEXT NOT NULL DEFAULT '[]',
  settings_json TEXT NOT NULL DEFAULT '{}',
  pity_epic INTEGER NOT NULL DEFAULT 0,
  pity_legendary INTEGER NOT NULL DEFAULT 0,
  total_kills INTEGER NOT NULL DEFAULT 0,
  bosses_defeated INTEGER NOT NULL DEFAULT 0,
  summons INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS heroes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hero_id TEXT NOT NULL,
  owned INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  upgrade_hp INTEGER NOT NULL DEFAULT 0,
  upgrade_atk INTEGER NOT NULL DEFAULT 0,
  upgrade_def INTEGER NOT NULL DEFAULT 0,
  upgrade_skill INTEGER NOT NULL DEFAULT 0,
  alloc_hp INTEGER NOT NULL DEFAULT 0,
  alloc_atk INTEGER NOT NULL DEFAULT 0,
  alloc_def INTEGER NOT NULL DEFAULT 0,
  ascension INTEGER NOT NULL DEFAULT 0,
  fragments INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, hero_id)
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  rarity TEXT NOT NULL,
  atk INTEGER NOT NULL DEFAULT 0,
  def INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL DEFAULT 0,
  equipped_by TEXT
);
CREATE INDEX IF NOT EXISTS items_user ON items(user_id);
CREATE TABLE IF NOT EXISTS potions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS materials (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS level_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter INTEGER NOT NULL,
  level INTEGER NOT NULL,
  clears INTEGER NOT NULL DEFAULT 0,
  best_kills INTEGER NOT NULL DEFAULT 0,
  first_cleared_at INTEGER,
  PRIMARY KEY (user_id, chapter, level)
);
CREATE TABLE IF NOT EXISTS achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);
CREATE TABLE IF NOT EXISTS summon_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  batch_id TEXT NOT NULL,
  source TEXT NOT NULL,
  hero_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  duplicate INTEGER NOT NULL DEFAULT 0,
  fragments INTEGER NOT NULL DEFAULT 0,
  pity INTEGER NOT NULL DEFAULT 0,
  cost_coins INTEGER NOT NULL DEFAULT 0,
  cost_crystals INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS summon_user ON summon_history(user_id, id);
`;

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

// Runs fn inside an immediate transaction; rolls back on any thrown error.
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
