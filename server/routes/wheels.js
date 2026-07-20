import { Router } from 'express';
import { pool, isDbConfigured } from '../db/pool.js';

export const wheelsRouter = Router();

function requireDb(req, res, next) {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
}

wheelsRouter.use(requireDb);

wheelsRouter.get('/', async (req, res) => {
  const { rows: wheels } = await pool.query('SELECT * FROM wheels ORDER BY created_at ASC');
  const { rows: traits } = await pool.query('SELECT * FROM traits ORDER BY position ASC');

  const traitsByWheel = new Map();
  for (const t of traits) {
    if (!traitsByWheel.has(t.wheel_id)) traitsByWheel.set(t.wheel_id, []);
    traitsByWheel.get(t.wheel_id).push({ id: t.id, label: t.label, rarity: t.rarity });
  }

  res.json(
    wheels.map((w) => ({
      id: w.id,
      name: w.name,
      icon: w.icon,
      color: w.color,
      createdAt: new Date(w.created_at).getTime(),
      traits: traitsByWheel.get(w.id) ?? [],
    }))
  );
});

wheelsRouter.post('/', async (req, res) => {
  const { id, name, icon, color } = req.body ?? {};
  if (!id || !name) return res.status(400).json({ error: 'id and name are required' });

  await pool.query(
    `INSERT INTO wheels (id, name, icon, color) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color`,
    [id, name, icon ?? '🎡', color ?? '#00f5ff']
  );
  res.status(201).json({ id, name, icon: icon ?? '🎡', color: color ?? '#00f5ff' });
});

wheelsRouter.put('/:id', async (req, res) => {
  const { name, icon, color } = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE wheels SET
       name = COALESCE($2, name),
       icon = COALESCE($3, icon),
       color = COALESCE($4, color)
     WHERE id = $1 RETURNING *`,
    [req.params.id, name, icon, color]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Wheel not found' });
  res.json(rows[0]);
});

wheelsRouter.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM wheels WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

wheelsRouter.post('/:id/traits', async (req, res) => {
  const { id, label, rarity, position } = req.body ?? {};
  if (!id || !label || !rarity) {
    return res.status(400).json({ error: 'id, label and rarity are required' });
  }

  await pool.query(
    `INSERT INTO traits (id, wheel_id, label, rarity, position) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, rarity = EXCLUDED.rarity, position = EXCLUDED.position`,
    [id, req.params.id, label, rarity, position ?? 0]
  );
  res.status(201).json({ id, label, rarity });
});

wheelsRouter.put('/:id/traits/:traitId', async (req, res) => {
  const { label, rarity } = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE traits SET label = COALESCE($3, label), rarity = COALESCE($4, rarity)
     WHERE id = $2 AND wheel_id = $1 RETURNING *`,
    [req.params.id, req.params.traitId, label, rarity]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Trait not found' });
  res.json({ id: rows[0].id, label: rows[0].label, rarity: rows[0].rarity });
});

wheelsRouter.delete('/:id/traits/:traitId', async (req, res) => {
  await pool.query('DELETE FROM traits WHERE id = $1 AND wheel_id = $2', [req.params.traitId, req.params.id]);
  res.status(204).end();
});

wheelsRouter.put('/:id/traits/reorder', async (req, res) => {
  const { traitIds } = req.body ?? {};
  if (!Array.isArray(traitIds)) return res.status(400).json({ error: 'traitIds must be an array' });

  await Promise.all(
    traitIds.map((traitId, position) =>
      pool.query('UPDATE traits SET position = $3 WHERE id = $1 AND wheel_id = $2', [
        traitId,
        req.params.id,
        position,
      ])
    )
  );
  res.status(204).end();
});
