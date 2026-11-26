// Canyon Arcade — the simulation. The plane flies forward along the canyon;
// the player steers across it, climbs and dives to thread the rings, and must
// reach the finish runway before the clock or the airframe gives out.
//
// The three hazards the player asked for are all real rules here:
//   1. birds cross the canyon and can hit the plane (damage + shake);
//   2. the wing fails at random (controls go soft for a few seconds);
//   3. one part falls off per minute of flight (integrity drops; at zero the
//      plane is a skeleton and the flight is over).
import {
  BIRDS,
  CORRIDOR_HALF,
  COURSE,
  DAMAGE,
  PLANE,
  SCORE,
  SEGMENT_LENGTH,
  STEP,
  WING_ERROR,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_BIRD = 2;
export const EVENT_PART = 4;
export const EVENT_WING = 8;
export const EVENT_WALL = 16;
export const EVENT_OVER = 32;
export const EVENT_WIN = 64;
export const EVENT_NEARMISS = 128;
export const EVENT_MISS = 256;

const PART_KEYS = ['leftWing', 'rightWing', 'tailFin', 'cowling', 'panel'];

/** The autopilot: steers and climbs toward the next ring, dodges birds. */
export function autopilot(state, track) {
  const next = nextRing(state, track);
  let steer = 0;
  let climb = 0;
  if (next) {
    steer = clamp((next.x - state.playerX) / 900, -1, 1);
    climb = clamp((next.altitude - state.altitude) / 700, -1, 1);
  }
  // A bird about to cross the plane's line owns the stick: dodging beats
  // chasing a ring for one step, or the ring pulls the plane into the bird.
  let dodge = 0;
  for (const bird of state.birds) {
    const dz = bird.z - state.distance;
    if (dz > 0 && dz < 2600 && Math.abs(bird.x - state.playerX) < 420) {
      dodge = bird.x > state.playerX ? -1 : 1;
      break;
    }
  }
  if (dodge !== 0) {
    return { steer: dodge, climb: clamp(climb, -1, 1), boost: state.timeLeft < 45 };
  }
  return {
    steer: clamp(steer, -1, 1),
    climb: clamp(climb, -1, 1),
    boost: state.timeLeft < 45,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nextRing(state, track) {
  const from = Math.floor(state.distance / SEGMENT_LENGTH) + 1;
  for (let i = from; i < track.segments.length; i += 1) {
    if (track.segments[i].ring) return track.segments[i].ring;
  }
  return null;
}

export function createWorld(random, track, audio) {
  const state = {
    status: 'title',
    cause: null,
    time: 0,
    timeLeft: COURSE.timeLimit,
    distance: 0,
    speed: PLANE.cruiseSpeed,
    throttle: 0.6,
    playerX: 0,
    altitude: PLANE.hoverHeight,
    bank: 0,
    heading: 90,
    score: 0,
    ringsPassed: 0,
    ringsTotal: COURSE.rings,
    integrity: 100,
    parts: { leftWing: true, rightWing: true, tailFin: true, cowling: true, panel: true },
    partsLost: 0,
    nextPartAt: 60,
    wingError: { active: false, until: 0, nextAt: WING_ERROR.minGap + random() * 6 },
    birdTimer: 2.5,
    birds: [],
    particles: [],
    fallingParts: [],
    messages: [],
    wallCooldown: 0,
    shake: 0,
    won: false,
  };

  function reset() {
    state.status = 'title';
    state.cause = null;
    state.time = 0;
    state.timeLeft = COURSE.timeLimit;
    state.distance = 0;
    state.speed = PLANE.cruiseSpeed;
    state.throttle = 0.6;
    state.playerX = 0;
    state.altitude = PLANE.hoverHeight;
    state.bank = 0;
    state.heading = 90;
    state.score = 0;
    state.ringsPassed = 0;
    state.integrity = 100;
    state.parts = { leftWing: true, rightWing: true, tailFin: true, cowling: true, panel: true };
    state.partsLost = 0;
    state.nextPartAt = 60;
    state.wingError = { active: false, until: 0, nextAt: WING_ERROR.minGap + random() * 6 };
    state.birdTimer = 2.5;
    state.birds = [];
    state.particles = [];
    state.fallingParts = [];
    state.messages = [];
    state.wallCooldown = 0;
    state.shake = 0;
    state.won = false;
    for (const segment of track.segments) {
      if (segment.ring) segment.ring.passed = false;
    }
  }

  function addMessage(text, color, seconds) {
    state.messages.push({ text, color: color || '#eef6ff', until: state.time + (seconds || 2.2) });
  }

  function burst(x, y, z, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const up = random() * 2 - 0.5;
      state.particles.push({
        x, y, z,
        vx: Math.cos(angle) * speed * (0.4 + random() * 0.6),
        vy: up * speed,
        vz: -speed * 0.4 + random() * speed * 0.4,
        life: 0.5 + random() * 0.5,
        maxLife: 1,
        color,
        size: 14 + random() * 22,
      });
    }
  }

  function spawnBirds() {
    const count = BIRDS.minFlock + Math.floor(random() * (BIRDS.maxFlock - BIRDS.minFlock + 1));
    // Spawned 6-8k ahead: a bird crosses the centre line just as the plane
    // arrives (crossing takes ~2.8 s from the wall, the plane takes 2.5-3.3 s
    // to cover the gap). Spawning 9-12k ahead let every bird clear the middle
    // before the plane got there, so a straight flight was never threatened.
    const z = state.distance + 6000 + random() * 2000;
    const fromLeft = random() < 0.5;
    for (let i = 0; i < count; i += 1) {
      state.birds.push({
        z: z + random() * 600,
        x: (fromLeft ? -1 : 1) * (CORRIDOR_HALF + 400) + (random() - 0.5) * 500,
        y: PLANE.hoverHeight - 200 + random() * 900,
        vx: (fromLeft ? 1 : -1) * BIRDS.crossSpeed * (0.8 + random() * 0.4),
        flap: random() * Math.PI * 2,
        hit: false,
        nearMissed: false,
      });
    }
  }

  function losePart() {
    const key = PART_KEYS[state.partsLost];
    if (!key) return;
    state.parts[key] = false;
    state.partsLost += 1;
    state.integrity = Math.max(0, state.integrity - DAMAGE.partLoss);
    state.fallingParts.push({
      kind: key,
      x: state.playerX + (key === 'leftWing' ? -500 : key === 'rightWing' ? 500 : 0),
      y: state.altitude,
      z: state.distance - 100,
      vx: (random() - 0.5) * 500,
      vy: -300 - random() * 300,
      vz: -200,
      angle: 0,
      spin: (random() - 0.5) * 9,
      life: 1.6,
    });
    burst(state.playerX, state.altitude, state.distance - 200, '#ffb703', 10, 500);
    addMessage(`PART LOST: ${DAMAGE.parts[state.partsLost - 1].toUpperCase()}`, '#ff5a4e', 2.6);
    audio.clatter();
  }

  function damage(amount, kind) {
    state.integrity = Math.max(0, state.integrity - amount);
    state.shake = 1;
    if (kind === 'bird') {
      burst(state.playerX, state.altitude, state.distance - 300, '#2b2d42', 14, 600);
      addMessage(`BIRD STRIKE! -${DAMAGE.birdHit}`, '#ff5a4e', 2);
      audio.thud();
    } else if (kind === 'wall') {
      burst(state.playerX, state.altitude, state.distance - 300, '#ffb703', 10, 500);
      addMessage(`WALL SCRAPE! -${DAMAGE.wallScrape}`, '#ffc53d', 1.6);
      audio.scrape();
    }
  }

  /**
   * One fixed step. `input` is { steer, climb, boost } in -1..1. `attract` runs
   * the title-screen demo: the plane flies itself and nothing can hurt it.
   * Returns an EVENT_* bitmask for sounds and announcements.
   */
  function step(dt, input, attract) {
    let events = EVENT_NONE;
    const playing = state.status === 'playing';

    // Wing failure: random, then a few seconds of soft controls.
    if (playing && !state.wingError.active && state.time >= state.wingError.nextAt) {
      state.wingError.active = true;
      state.wingError.until = state.time + WING_ERROR.duration;
      events |= EVENT_WING;
      addMessage('⚠ WING MALFUNCTION — CONTROLS DEGRADED', '#ff5a4e', WING_ERROR.duration);
      audio.alarm(true);
    }
    if (state.wingError.active && state.time >= state.wingError.until) {
      state.wingError.active = false;
      state.wingError.nextAt = state.time + WING_ERROR.minGap + random() * (WING_ERROR.maxGap - WING_ERROR.minGap);
      audio.alarm(false);
      if (playing) addMessage('WING RESTORED', '#7dffa8', 1.6);
    }

    // Speed: cruise, faster on boost. The skeleton flies no more.
    const targetSpeed = input.boost ? PLANE.boostSpeed : PLANE.cruiseSpeed;
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 1.5);
    state.throttle = (state.speed - PLANE.minSpeed) / (PLANE.boostSpeed - PLANE.minSpeed);

    // Steering and altitude, softened while the wing fails.
    const steerGain = state.wingError.active ? WING_ERROR.steeringLeft : 1;
    const steer = input.steer * steerGain;
    state.playerX += steer * PLANE.steerSpeed * dt;
    if (state.wingError.active) {
      state.playerX += Math.sin(state.time * 6.5) * 320 * dt;
    }
    state.altitude += input.climb * PLANE.climbSpeed * dt;
    state.altitude = clamp(state.altitude, PLANE.minAltitude, PLANE.maxAltitude);
    // The bank eases toward the steering (motion-design: never linear).
    const targetBank = steer * 0.55;
    state.bank += (targetBank - state.bank) * Math.min(1, dt * 7);

    // The canyon walls: scrape, spark, bounce back.
    if (playing && state.wallCooldown <= 0 && Math.abs(state.playerX) > CORRIDOR_HALF) {
      state.playerX = Math.sign(state.playerX) * CORRIDOR_HALF;
      damage(DAMAGE.wallScrape, 'wall');
      events |= EVENT_WALL;
      state.wallCooldown = 0.8;
    }
    state.wallCooldown = Math.max(0, state.wallCooldown - dt);

    state.distance += state.speed * dt;
    state.time += dt;
    if (playing) {
      state.timeLeft -= dt;
      state.score += SCORE.distancePerSecond * (state.speed / PLANE.cruiseSpeed) * dt;
    }

    // Heading follows the canyon's bend plus the steering.
    const segment = track.segmentAt(state.distance);
    state.heading = 90 - segment.curve * 6 - steer * 8;

    // Rings: crossing one is a pass only when the plane threads it.
    const prevIndex = Math.floor((state.distance - state.speed * dt) / SEGMENT_LENGTH);
    const nowIndex = Math.floor(state.distance / SEGMENT_LENGTH);
    for (let i = prevIndex + 1; i <= nowIndex && i < track.segments.length; i += 1) {
      const ring = track.segments[i].ring;
      if (!ring || ring.passed) continue;
      ring.passed = true;
      const dx = Math.abs(state.playerX - ring.x);
      const dy = Math.abs(state.altitude - ring.altitude);
      if (dx < 520 && dy < 480) {
        state.ringsPassed += 1;
        state.score += SCORE.ring;
        if (playing) {
          state.timeLeft += COURSE.ringTimeBonus;
          addMessage(`RING! +${SCORE.ring}  +${COURSE.ringTimeBonus}s`, '#ffd94d', 1.8);
        }
        burst(ring.x, ring.altitude, i * SEGMENT_LENGTH, '#ffd94d', 18, 700);
        events |= EVENT_RING;
        audio.chime();
      } else if (playing) {
        addMessage('RING MISSED', '#8b93a3', 1.4);
        events |= EVENT_MISS;
      }
    }

    // Birds: spawn flocks ahead, drift them across, check hits and near misses.
    if (playing || attract) {
      state.birdTimer -= dt;
      if (state.birdTimer <= 0) {
        spawnBirds();
        state.birdTimer = BIRDS.interval + (random() - 0.5) * BIRDS.intervalJitter * 2;
      }
    }
    for (const bird of state.birds) {
      bird.x += bird.vx * dt;
      bird.flap += dt * 9;
      const dz = bird.z - state.distance;
      const dx = bird.x - state.playerX;
      const dy = bird.y - state.altitude;
      if (playing && !bird.hit && Math.abs(dz) < 220 && Math.abs(dx) < BIRDS.hitRadius && Math.abs(dy) < BIRDS.hitRadius) {
        bird.hit = true;
        damage(DAMAGE.birdHit, 'bird');
        events |= EVENT_BIRD;
      } else if (playing && !bird.hit && !bird.nearMissed && dz < -220 && dz > -900 && Math.abs(dx) < 420 && Math.abs(dy) < 420) {
        bird.nearMissed = true;
        state.score += SCORE.nearMiss;
        addMessage(`NEAR MISS! +${SCORE.nearMiss}`, '#5fd4ff', 1.4);
        events |= EVENT_NEARMISS;
      }
    }
    state.birds = state.birds.filter((bird) => bird.z > state.distance - 3000 && Math.abs(bird.x) < CORRIDOR_HALF + 3000);

    // One part falls off per minute of flight.
    if (playing && state.time >= state.nextPartAt && state.partsLost < PART_KEYS.length) {
      losePart();
      state.nextPartAt += 60;
      events |= EVENT_PART;
    }

    // Particles and falling parts tumble on.
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 500 * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const f of state.fallingParts) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      f.vy -= 900 * dt;
      f.angle += f.spin * dt;
      f.life -= dt;
    }
    state.fallingParts = state.fallingParts.filter((f) => f.life > 0);

    state.messages = state.messages.filter((m) => m.until > state.time);
    state.shake = Math.max(0, state.shake - dt * 2.2);

    // Endings: finish the course, run out of time, or lose the airframe.
    if (playing && state.distance >= track.length - SEGMENT_LENGTH * 4) {
      state.status = 'won';
      state.won = true;
      state.score += SCORE.finishIntegrityBonus * (state.integrity / 100);
      events |= EVENT_WIN;
      audio.fanfare();
      audio.alarm(false);
    } else if (playing && state.timeLeft <= 0) {
      state.status = 'lost';
      state.cause = 'time';
      state.timeLeft = 0;
      events |= EVENT_OVER;
      audio.crash();
      audio.alarm(false);
    } else if (playing && state.integrity <= 0) {
      state.status = 'lost';
      state.cause = 'integrity';
      events |= EVENT_OVER;
      audio.crash();
      audio.alarm(false);
    }

    return events;
  }

  return { state, reset, step };
}

// Re-exported for the autopilot's ring lookahead (used by shots.js).
export { nextRing };
