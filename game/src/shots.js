// Canyon Arcade — the screenshot scenes behind ?shot=cover|giants|hazard|finish.
// Each scene plays the real rules forward from a fresh world for a fixed
// stretch, steered by the world's own autopilot, so the frame is what a real
// flight looks like and the same seed always gives the same frame.
//
//   cover  — fly until the next ring is close: a big gold ring ahead, HUD live.
//   giants — stop with Godzilla ~6k ahead: the kaiju fills the canyon.
//   hazard — play until the wing fails (or a bird hits), then half a second:
//            the red malfunction banner over a live flight.
//   finish — stop 12 segments short of the line: the asphalt runway ahead.
//
// Motion note: every scene is a real flight, not a posed still — the plane
// banks, the giants breathe, the birds flap, the HUD numbers are mid-flight.

import { COURSE, GIANTS, PLANE, SEGMENT_LENGTH, STEP } from './config.js';
import { autopilot, EVENT_BIRD, nextRing } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_WIN } from './render.js';

const GIANTS_HOLD_SECONDS = 0.5;
const HAZARD_LIMIT_SECONDS = 45;
const FINISH_HOLD_SECONDS = 0.5;

function nextRingZ(state, track) {
  const ring = nextRing(state, track);
  if (!ring) return Infinity;
  const index = track.segments.findIndex((segment) => segment.ring === ring);
  return index < 0 ? Infinity : index * SEGMENT_LENGTH;
}

function playSeconds(world, track, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, autopilot(world.state, track), false);
    if (world.state.status !== 'playing') break;
  }
}

function playUntil(world, track, reached) {
  for (let i = 0; i < 600 / STEP; i += 1) {
    world.step(STEP, autopilot(world.state, track), false);
    if (world.state.status !== 'playing') break;
    if (reached(world.state)) break;
  }
}

/**
 * Set `world` to the named scene (cover, giants, hazard, finish; any other
 * name is cover) and return the screen to draw over it and the best score
 * to show. The world is always left in 'playing' for the shot frame unless
 * the flight genuinely ended (won/lost) during staging.
 */
export function stageShot(name, world, track) {
  world.reset();
  world.state.status = 'playing';
  const courseLength = track.length;

  if (name === 'giants') {
    // Stop with Godzilla ~3.5k ahead (about 220 px tall on screen), then
    // hold half a second. A longer hold flies past him — he ends up behind
    // the camera and the shot shows an empty canyon.
    const godzillaZ = Math.floor(COURSE.segments * GIANTS.godzillaAt) * SEGMENT_LENGTH;
    playUntil(world, track, (state) => state.distance >= godzillaZ - 3500);
    playSeconds(world, track, GIANTS_HOLD_SECONDS);
  } else if (name === 'hazard') {
    let struck = false;
    for (let i = 0; i < HAZARD_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilot(world.state, track), false);
      if (world.state.status !== 'playing') break;
      if (world.state.wingError.active || events & EVENT_BIRD) {
        struck = true;
        break;
      }
    }
    if (struck) playSeconds(world, track, 0.5);
    else playSeconds(world, track, 2);
  } else if (name === 'finish') {
    // Stop 40 segments short of the finish line, then hold half a second:
    // the canyon and river fill the foreground, the dark asphalt runway is
    // the strip ahead. Stopping 12 segments out at low altitude leaves only
    // a flat dark band and empty sky past the course end; stopping there at
    // ring altitude hides the runway below the frame.
    playUntil(world, track, (state) => state.distance >= courseLength - 40 * SEGMENT_LENGTH);
    world.state.altitude = PLANE.hoverHeight;
    playSeconds(world, track, FINISH_HOLD_SECONDS);
  } else {
    // Cover: fly until the next ring is close (~2.6k ahead, a big gold ring
    // in frame), then hold half a second. A fixed 18 s left the ring a speck
    // on the horizon.
    playUntil(world, track, (state) => nextRingZ(state, track) - state.distance <= 2600);
    playSeconds(world, track, 0.5);
  }

  const { status } = world.state;
  return {
    screen: status === 'won' ? SCREEN_WIN : status === 'lost' ? SCREEN_OVER : SCREEN_PLAY,
    best: 0,
  };
}
