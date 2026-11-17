// Headless screenshot harness: a tiny software Canvas2D rasterizer (no dependencies)
// that runs the game's real renderer + shot staging, writes PNG, and converts to JPG
// with ffmpeg. Usage: node tools/make-shots.mjs [start|play|end|all]
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createWorld } from '../game/src/world.js';
import { createRandom } from '../game/src/random.js';
import { createRenderer } from '../game/src/render.js';
import { stageShot } from '../game/src/shots.js';

const W = 1280; const H = 720;

import { StubCanvas, toPNG } from './canvas-stub.mjs';
// ---------- run ----------
const SHOTS = [
  { name: 'start', file: 'screenshots/1-start.jpg' },
  { name: 'play', file: 'screenshots/2-play.jpg' },
  { name: 'end', file: 'screenshots/3-end.jpg' },
];
const which = process.argv[2] || 'all';
for (const shotDef of SHOTS) {
  if (which !== 'all' && which !== shotDef.name) continue;
  const canvas = new StubCanvas();
  canvas.width = W; canvas.height = H;
  const world = createWorld(createRandom(1));
  const renderer = createRenderer(canvas);
  const scene = stageShot(shotDef.name, world);
  renderer.draw(world.state, scene.screen, { hasSave: scene.hasSave });
  renderer.draw(world.state, scene.screen, { hasSave: scene.hasSave });
  const pngPath = `/tmp/shot-${shotDef.name}.png`;
  writeFileSync(pngPath, toPNG(canvas));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', pngPath, '-q:v', '4', shotDef.file]);
  console.log('wrote', shotDef.file);
}
