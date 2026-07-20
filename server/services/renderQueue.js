import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCharacterVideo } from './remotionRunner.js';
import { pool, isDbConfigured } from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDERS_DIR = path.join(__dirname, '..', 'renders');
fs.mkdirSync(RENDERS_DIR, { recursive: true });

const MAX_CONCURRENT = 1;

const jobs = new Map();
const queue = [];
let activeCount = 0;

// Best-effort persistence so a job survives a server restart. Failure here
// never blocks the render itself — Postgres is optional (Stage 4 feature).
function _syncJobToDb(job) {
  if (!isDbConfigured()) return;
  pool
    .query(
      `INSERT INTO render_jobs (id, status, progress, output_path, error_message, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         progress = EXCLUDED.progress,
         output_path = EXCLUDED.output_path,
         error_message = EXCLUDED.error_message,
         updated_at = now()`,
      [job.id, job.status, job.progress, job.outputPath, job.errorMessage]
    )
    .catch((err) => console.warn('render_jobs sync failed:', err.message));
}

export function createRenderJob(payload) {
  const id = crypto.randomUUID();
  const job = {
    id,
    status: 'queued',
    progress: 0,
    outputPath: null,
    errorMessage: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  _syncJobToDb(job);
  queue.push({ id, payload });
  _pump();
  return job;
}

export async function getRenderJob(id) {
  const inMemory = jobs.get(id);
  if (inMemory) return inMemory;

  // Not in this process's memory (e.g. server restarted since the job was
  // created) — fall back to Postgres if it's configured.
  if (!isDbConfigured()) return null;
  const { rows } = await pool.query('SELECT * FROM render_jobs WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    outputPath: row.output_path,
    errorMessage: row.error_message,
  };
}

// A job that was 'queued'/'rendering' when the process died can't be
// resumed mid-render — mark it as errored on boot rather than leaving
// clients polling a job that will never finish.
export async function recoverStaleJobsOnBoot() {
  if (!isDbConfigured()) return;
  await pool
    .query(
      `UPDATE render_jobs SET status = 'error', error_message = 'Server restarted during render', updated_at = now()
       WHERE status IN ('queued', 'rendering')`
    )
    .catch((err) => console.warn('Stale render_jobs recovery failed:', err.message));
}

function _pump() {
  if (activeCount >= MAX_CONCURRENT) return;
  const next = queue.shift();
  if (!next) return;

  activeCount++;
  const job = jobs.get(next.id);
  job.status = 'rendering';
  _syncJobToDb(job);

  const outputPath = path.join(RENDERS_DIR, `${next.id}.mp4`);

  renderCharacterVideo({
    inputProps: next.payload,
    outputPath,
    onProgress: (progress) => {
      job.progress = progress ?? job.progress;
    },
  })
    .then(() => {
      job.status = 'done';
      job.progress = 1;
      job.outputPath = outputPath;
      _syncJobToDb(job);
    })
    .catch((err) => {
      job.status = 'error';
      job.errorMessage = err?.message ?? 'Render failed';
      _syncJobToDb(job);
    })
    .finally(() => {
      activeCount--;
      _pump();
    });

  // Keep pumping in case MAX_CONCURRENT > 1 in the future.
  _pump();
}
