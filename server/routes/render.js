import { Router } from 'express';
import path from 'node:path';
import { createRenderJob, getRenderJob } from '../services/renderQueue.js';

export const renderRouter = Router();

renderRouter.post('/', (req, res) => {
  const { characterName, traits, backstory } = req.body ?? {};

  if (!Array.isArray(traits) || traits.length === 0) {
    return res.status(400).json({ error: 'traits must be a non-empty array' });
  }

  const job = createRenderJob({
    characterName: characterName || 'Unnamed Character',
    traits,
    backstory: backstory ?? null,
  });

  res.status(202).json({ jobId: job.id, statusUrl: `/api/render/${job.id}` });
});

renderRouter.get('/:id', async (req, res) => {
  const job = await getRenderJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    downloadUrl: job.status === 'done' ? `/api/render/${job.id}/download` : null,
    error: job.errorMessage,
  });
});

renderRouter.get('/:id/download', async (req, res) => {
  const job = await getRenderJob(req.params.id);
  if (!job || job.status !== 'done' || !job.outputPath) {
    return res.status(404).json({ error: 'Render not ready' });
  }

  const filename = `${(job.id ?? 'character')}.mp4`;
  res.setHeader('Content-Type', 'video/mp4');
  if (req.query.download === '1') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
  res.sendFile(path.resolve(job.outputPath));
});
