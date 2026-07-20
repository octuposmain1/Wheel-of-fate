import { Router } from 'express';
import { pool, isDbConfigured } from '../db/pool.js';

export const rarityTiersRouter = Router();

function requireDb(req, res, next) {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  next();
}

rarityTiersRouter.use(requireDb);

rarityTiersRouter.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM rarity_tiers ORDER BY position ASC');
  res.json(rows.map(t => ({ id: t.id, label: t.label, weight: t.weight, color: t.color, icon: t.icon })));
});

rarityTiersRouter.post('/', async (req, res) => {
  const { id, label, weight, color, icon } = req.body ?? {};
  if (!id || !label || weight == null || !color || !icon) {
    return res.status(400).json({ error: 'id, label, weight, color and icon are required' });
  }

  await pool.query(
    `INSERT INTO rarity_tiers (id, label, weight, color, icon) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, weight = EXCLUDED.weight, color = EXCLUDED.color, icon = EXCLUDED.icon`,
    [id, label, weight, color, icon]
  );
  res.status(201).json({ id, label, weight, color, icon });
});

rarityTiersRouter.put('/:id', async (req, res) => {
  const { label, weight, color, icon } = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE rarity_tiers SET
       label = COALESCE($2, label),
       weight = COALESCE($3, weight),
       color = COALESCE($4, color),
       icon = COALESCE($5, icon)
     WHERE id = $1 RETURNING *`,
    [req.params.id, label, weight, color, icon]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Rarity tier not found' });
  const t = rows[0];
  res.json({ id: t.id, label: t.label, weight: t.weight, color: t.color, icon: t.icon });
});

rarityTiersRouter.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM rarity_tiers WHERE id = $1', [req.params.id]);
  res.status(204).end();
});
