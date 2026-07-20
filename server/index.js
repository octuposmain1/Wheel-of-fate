import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRouter } from './routes/render.js';
import { wheelsRouter } from './routes/wheels.js';
import { charactersRouter } from './routes/characters.js';
import { rarityTiersRouter } from './routes/rarityTiers.js';
import { aiRouter } from './routes/ai.js';
import { recoverStaleJobsOnBoot } from './services/renderQueue.js';
import { isDbConfigured } from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/api/render', renderRouter);
app.use('/api/wheels', wheelsRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/rarity-tiers', rarityTiersRouter);
app.use('/api/ai', aiRouter);

app.use(express.static(PROJECT_ROOT));

const port = process.env.PORT || 4000;

async function start() {
  if (isDbConfigured()) {
    await recoverStaleJobsOnBoot();
  } else {
    console.log('DATABASE_URL not set — running with localStorage-only persistence (video export still works).');
  }

  app.listen(port, () => {
    console.log(`Wheel of Fate server listening on http://localhost:${port}`);
  });
}

start();
