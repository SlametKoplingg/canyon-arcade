// Canyon Arcade — the game loop. A fixed-step simulation (60 Hz) under a
// requestAnimationFrame render, keyboard + mouse input, title / playing /
// pause / over / won screens, and a best score kept in this browser.
//
// ?shot=cover|giants|hazard|finish stages one deterministic screenshot scene
// instead of starting the loop: one frame is rendered and window.__shotReady
// is set, so a headless run can capture exactly what a real flight looks
// like. ?seed=N rebuilds the course from that seed (default 7).

import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildTrack } from './track.js';
import { autopilot, createWorld } from './world.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, render } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shotName = params.get('shot');

const random = createRandom(seed);
const track = buildTrack(random);
const audio = createAudio();
const world = createWorld(random, track, audio);
const input = createInput(canvas);

let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
} catch {
  best = 0;
}
let screen = SCREEN_TITLE;
let paused = false;
let lastFrame = 0;
let accumulator = 0;

function saveBest() {
  if (world.state.score > best) {
    best = Math.floor(world.state.score);
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Best score is a nicety, not a requirement.
    }
  }
}

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

function startFlight() {
  world.reset();
  world.state.status = 'playing';
  screen = SCREEN_PLAY;
  paused = false;
  audio.unlock();
  announce('Flying. Thread the rings, mind the birds.');
}

function backToTitle() {
  world.reset();
  screen = SCREEN_TITLE;
  paused = false;
  announce('Canyon Arcade. Press Space or click to fly.');
}

function stepGame(dt) {
  const { state } = world;
  if (screen === SCREEN_TITLE) {
    // The title screen flies itself: a live attract demo behind the menu.
    world.step(dt, autopilot(state, track), true);
    return;
  }
  if (paused || screen === SCREEN_OVER || screen === SCREEN_WIN) return;
  const control = {
    steer: input.steer(),
    climb: input.climb(),
    boost: input.boost(),
  };
  world.step(dt, control, false);
  audio.engine(state.throttle, state.status === 'playing');
  if (state.status === 'won') {
    screen = SCREEN_WIN;
    saveBest();
    announce(`Course complete. Score ${Math.floor(state.score)}.`);
  } else if (state.status === 'lost') {
    screen = SCREEN_OVER;
    saveBest();
    announce(`Game over. Score ${Math.floor(state.score)}.`);
  }
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_CONFIRM) {
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      startFlight();
    } else if (paused) {
      paused = false;
      screen = SCREEN_PLAY;
    }
  }
  if (actions & ACTION_PAUSE) {
    if (screen === SCREEN_PLAY && !paused) {
      paused = true;
      screen = SCREEN_PAUSE;
    } else if (paused) {
      paused = false;
      screen = SCREEN_PLAY;
    }
  }
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  handleActions();
  accumulator += dt;
  while (accumulator >= STEP) {
    stepGame(STEP);
    accumulator -= STEP;
  }
  render(ctx, world, track, { screen, best });
  window.requestAnimationFrame(frame);
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM' && !event.repeat) {
    audio.setMuted(window.__canyonMuted = !window.__canyonMuted);
  }
});

// Test and debug hooks (read-only state, no cheats in the shipped game).
window.__canyon = { world, track, input, autopilot, start: startFlight, version: 'canyon-arcade-1.0' };
window.__canyonMuted = false;

if (shotName) {
  // Screenshot mode: stage the scene, draw one frame, signal readiness.
  const staged = stageShot(shotName, world, track);
  render(ctx, world, track, { screen: staged.screen, best: staged.best });
  document.title = `Canyon Arcade — shot ${shotName}`;
  window.__shotReady = true;
} else {
  announce('Canyon Arcade. Press Space or click to fly.');
  window.requestAnimationFrame((now) => {
    lastFrame = now;
    window.requestAnimationFrame(frame);
  });
}
