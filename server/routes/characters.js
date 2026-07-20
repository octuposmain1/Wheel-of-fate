import { Router } from 'express';
import { pool, isDbConfigured } from '../db/pool.js';

export const charactersRouter = Router();

function requireDb(req, res, next) {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
}

charactersRouter.use(requireDb);

charactersRouter.get('/', async (req, res) => {
  const { rows: characters } = await pool.query('SELECT * FROM characters ORDER BY created_at ASC');
  const { rows: traits } = await pool.query('SELECT * FROM character_traits ORDER BY position ASC');

  const traitsByChar = new Map();
  for (const t of traits) {
    if (!traitsByChar.has(t.character_id)) traitsByChar.set(t.character_id, []);
    traitsByChar.get(t.character_id).push({
      wheelId: t.wheel_id,
      wheelName: t.wheel_name,
      wheelIcon: t.wheel_icon,
      trait: { label: t.trait_label, rarity: t.trait_rarity },
    });
  }

  res.json(
    characters.map((c) => {
      let powerSystem = null;
      if (c.power_system) {
        try {
          powerSystem = JSON.parse(c.power_system);
        } catch (e) {
          console.warn('Failed to parse power_system:', e);
        }
      }
      return {
        id: c.id,
        name: c.name,
        backstory: c.backstory,
        powerSystem,
        createdAt: new Date(c.created_at).getTime(),
        traits: traitsByChar.get(c.id) ?? [],
      };
    })
  );
});

charactersRouter.post('/', async (req, res) => {
  const { id, name, backstory, traits, powerSystem } = req.body ?? {};
  if (!id || !name || !Array.isArray(traits)) {
    return res.status(400).json({ error: 'id, name and traits[] are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO characters (id, name, backstory, power_system) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, backstory = EXCLUDED.backstory, power_system = EXCLUDED.power_system`,
      [id, name, backstory ?? null, powerSystem ? JSON.stringify(powerSystem) : null]
    );
    await client.query('DELETE FROM character_traits WHERE character_id = $1', [id]);
    for (let i = 0; i < traits.length; i++) {
      const t = traits[i];
      await client.query(
        `INSERT INTO character_traits
           (id, character_id, wheel_id, wheel_name, wheel_icon, trait_label, trait_rarity, position)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
        [id, t.wheelId ?? null, t.wheelName ?? '', t.wheelIcon ?? '', t.trait.label, t.trait.rarity, i]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(201).json({ id, name, backstory: backstory ?? null, traits, powerSystem: powerSystem ?? null });
});

charactersRouter.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM characters WHERE id = $1', [req.params.id]);
  res.status(204).end();
});
