// Canyon Arcade — the submission entry point. A Node 22 script (stdlib only)
// that copies the static game and its screenshots into the submission output
// directory and writes a dossier of the game's own facts.
//
// Input: this repo root. Output: /output (created if it does not exist).
// The kit at ../kit/ supplies the CLI and the vendor rules; this file only
// copies files and records what was copied.

import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT = '/output';
const GAME = join(process.cwd(), 'game');
const SHOTS = join(process.cwd(), 'screenshots');

const DOSSIER = {
  game: 'Canyon Arcade',
  description: 'An arcade ring-chase through a desert canyon. Fly low, thread 30 golden rings to the runway, dodge the birds, ride out the wing-malfunction events, and finish before a part falls off every minute leaves the plane a skeleton. Godzilla wades the river at the first bend; Ultraman watches from the second.',
  controls: {
    keyboard: 'Arrows or WASD to steer and climb, Shift to boost, Space or Enter to start, P or Esc to pause, M to mute',
    mouse: 'move to steer, click to boost',
  },
  rules: [
    'Thread the golden rings in order: each one is worth 100 points and 4 seconds on the clock.',
    'Birds cross the canyon. A hit costs 8% airframe integrity and knocks the plane sideways.',
    'A wing malfunction strikes every 22–38 seconds: steering drops to 38% for 4 seconds, with an alarm and a red warning banner.',
    'Every 60 seconds one airframe part falls off and integrity drops 15%. At 0% the plane is a skeleton and the flight ends.',
    'Finish the course before the 150-second clock runs out.',
  ],
  hazards: ['birds', 'wing malfunction', 'per-minute part loss', 'canyon walls'],
  features: ['Godzilla', 'Ultraman', '30 sequential rings', 'runway finish', 'HUD with altitude, speed, heading, score, timer, integrity'],
};

async function sizeOf(path) {
  const info = await stat(path);
  return info.size;
}

async function main() {
  const gameDir = join(OUTPUT, 'game');
  const shotsDir = join(OUTPUT, 'screenshots');
  await mkdir(gameDir, { recursive: true });
  await mkdir(shotsDir, { recursive: true });

  // The whole game directory: index.html plus every module. No external
  // files, no network requests, nothing to resolve.
  await cp(GAME, gameDir, { recursive: true });

  const shotsManifest = JSON.parse(await readFile(join(process.cwd(), 'shots.json'), 'utf8'));
  const shotFiles = [];
  for (const shot of shotsManifest.shots) {
    const source = join(SHOTS, shot.file);
    await cp(source, join(shotsDir, shot.file));
    shotFiles.push({
      file: shot.file,
      label: shot.label,
      bytes: await sizeOf(source),
    });
  }

  const dossier = {
    ...DOSSIER,
    files: {
      game: 'game/index.html',
      screenshots: shotFiles.map((shot) => shot.file),
    },
    shots: shotFiles,
  };
  await writeFile(join(OUTPUT, 'dossier.json'), JSON.stringify(dossier, null, 2), 'utf8');
  await writeFile(join(OUTPUT, 'README.md'), await readFile(join(process.cwd(), 'README.md'), 'utf8'));
  console.log(`Canyon Arcade dossier written to ${OUTPUT} with ${shotFiles.length} screenshots.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
