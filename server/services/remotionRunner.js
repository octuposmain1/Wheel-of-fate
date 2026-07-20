import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { ensureToneBank } from './toneSynth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY_POINT = path.join(__dirname, '..', 'remotion', 'src', 'index.ts');
const PUBLIC_DIR = path.join(__dirname, '..', 'remotion', 'public');
const COMPOSITION_ID = 'CharacterReveal';

let bundlePromise = null;

function getServeUrl() {
  if (!bundlePromise) {
    // publicDir must be explicit: bundle() otherwise resolves the "remotion
    // root" by walking up to the nearest package.json, which lands on
    // server/ (no package.json in server/remotion/) — so it would look for
    // server/public/ instead of server/remotion/public/ and silently skip
    // copying any of it (audio/generated/*.wav 404s at render time).
    bundlePromise = bundle({ entryPoint: ENTRY_POINT, publicDir: PUBLIC_DIR });
  }
  return bundlePromise;
}

export async function renderCharacterVideo({ inputProps, outputPath, onProgress }) {
  ensureToneBank();
  const serveUrl = await getServeUrl();

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  });

  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => onProgress?.(progress),
  });
}
