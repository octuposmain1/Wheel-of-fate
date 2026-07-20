CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS wheels (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT '🎡',
  color       text NOT NULL DEFAULT '#00f5ff',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Rarity is an arbitrary user-defined tier id now (rarity_tiers below),
-- not a closed enum, so re-running this against a database created before
-- editable rarities existed drops the old CHECK constraint.
ALTER TABLE IF EXISTS traits DROP CONSTRAINT IF EXISTS traits_rarity_check;

CREATE TABLE IF NOT EXISTS traits (
  id          uuid PRIMARY KEY,
  wheel_id    uuid NOT NULL REFERENCES wheels(id) ON DELETE CASCADE,
  label       text NOT NULL,
  rarity      text NOT NULL,
  position    int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS traits_wheel_id_idx ON traits(wheel_id);

-- User-editable/addable rarity tiers (label/weight/color/icon). Ids are
-- stable references from traits.rarity / character_traits.trait_rarity —
-- the 4 defaults keep fixed ids ('common'/'rare'/'legendary'/'mythic') so
-- existing data never needs migrating; new tiers get a random uuid.
CREATE TABLE IF NOT EXISTS rarity_tiers (
  id      text PRIMARY KEY,
  label   text NOT NULL,
  weight  real NOT NULL,
  color   text NOT NULL,
  icon    text NOT NULL,
  position int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS characters (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  backstory   text,
  power_system text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS power_system text;

-- Snapshot wheel name/icon at roll time — characters must survive the
-- source wheel being edited or deleted later (wheel_id kept nullable
-- for that reason; it's a soft reference, not authoritative).
CREATE TABLE IF NOT EXISTS character_traits (
  id            uuid PRIMARY KEY,
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  wheel_id      uuid REFERENCES wheels(id) ON DELETE SET NULL,
  wheel_name    text NOT NULL,
  wheel_icon    text NOT NULL,
  trait_label   text NOT NULL,
  trait_rarity  text NOT NULL,
  position      int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS character_traits_character_id_idx ON character_traits(character_id);

-- Render jobs live in Postgres too so they survive a server restart and a
-- client can resume polling a job after reload.
CREATE TABLE IF NOT EXISTS render_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid REFERENCES characters(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','rendering','done','error')),
  progress      real NOT NULL DEFAULT 0,
  output_path   text,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
