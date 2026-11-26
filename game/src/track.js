// Canyon Arcade — the course builder. The canyon is a ribbon of segments; each
// one carries a curve (how hard the canyon bends) and a height (the floor's
// elevation). Rings, giants and rocks are pinned to segments. The renderer walks
// the segments and integrates the curves into the canyon's centre line, so the
// track itself only stores a curve and a height per segment.
import { CORRIDOR_HALF, COURSE, GIANTS, SEGMENT_LENGTH } from './config.js';

function easeIn(a, b, percent) {
  return a + (b - a) * percent * percent;
}

function easeInOut(a, b, percent) {
  return a + (b - a) * (-Math.cos(percent * Math.PI) / 2 + 0.5);
}

/** A ring the plane threads: lateral offset and height above the canyon floor. */
function makeRing(x, altitude) {
  return { x, altitude, radius: 430, passed: false };
}

export function buildTrack(random) {
  const segments = [];

  function lastY() {
    return segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y;
  }

  function addSegment(curve, y) {
    const n = segments.length;
    segments.push({
      index: n,
      curve,
      p1: {
        world: { x: 0, y: lastY(), z: n * SEGMENT_LENGTH },
        camera: { x: 0, y: 0, z: 0 },
        screen: { x: 0, y: 0, w: 0, scale: 0 },
      },
      p2: {
        world: { x: 0, y, z: (n + 1) * SEGMENT_LENGTH },
        camera: { x: 0, y: 0, z: 0 },
        screen: { x: 0, y: 0, w: 0, scale: 0 },
      },
      sprites: [],
      ring: null,
      giant: null,
      finish: false,
    });
  }

  /** A run of segments: ease into the bend and the hill, hold, ease out. */
  function addSection(enter, hold, leave, curve, hill) {
    const startY = lastY();
    const endY = startY + hill;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n += 1) {
      addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    }
    for (let n = 0; n < hold; n += 1) {
      addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    }
    for (let n = 0; n < leave; n += 1) {
      addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
    }
  }

  // The takeoff straight: flat, calm, so the player learns the controls.
  addSection(20, 40, 20, 0, 0);

  // The canyon proper: bends and hills in seeded variety until the finish straight.
  const finishAt = COURSE.segments - 60;
  while (segments.length < finishAt) {
    // Cap the last section so the canyon ends exactly at finishAt: an
    // uncapped section overshoots by up to a whole section (seed-dependent),
    // and then track.length, the win line and the runway disagree — the
    // runway ends up mid-canyon and sand shows past it.
    let length = 60 + Math.floor(random() * 90);
    length = Math.min(length, finishAt - segments.length);
    const curve = (random() < 0.5 ? -1 : 1) * (1.5 + random() * 3.5);
    const hill = (random() - 0.45) * 1400;
    addSection(
      Math.floor(length / 3),
      Math.floor(length / 3),
      length - 2 * Math.floor(length / 3),
      curve,
      hill,
    );
  }

  // The finish straight: flat, with the runway at its end.
  while (segments.length < COURSE.segments) {
    addSegment(0, lastY());
  }
  for (let n = COURSE.segments - 20; n < COURSE.segments; n += 1) {
    segments[n].finish = true;
  }

  // Rings: one every stretch, drifting gently so the line through them is flyable.
  let ringX = 0;
  let ringAlt = 700;
  for (let i = 0; i < COURSE.rings; i += 1) {
    const at = 80 + i * 56;
    if (at >= COURSE.segments - 30) break;
    ringX = Math.max(-0.55, Math.min(0.55, ringX + (random() - 0.5) * 0.9));
    ringAlt = Math.max(380, Math.min(1700, ringAlt + (random() - 0.5) * 1100));
    segments[at].ring = makeRing(ringX * CORRIDOR_HALF, ringAlt);
  }

  // The giants: Godzilla wading the river on the right, Ultraman on a left ledge.
  const godzillaAt = Math.floor(COURSE.segments * GIANTS.godzillaAt);
  const ultramanAt = Math.floor(COURSE.segments * GIANTS.ultramanAt);
  segments[godzillaAt].giant = 'godzilla';
  segments[ultramanAt].giant = 'ultraman';

  // Rocks and dry bushes along the walls, for depth and speed feel.
  for (let n = 12; n < COURSE.segments - 10; n += 1) {
    if (random() < 0.22) {
      const side = random() < 0.5 ? -1 : 1;
      segments[n].sprites.push({
        kind: random() < 0.6 ? 'rock' : 'bush',
        offset: side * (1.25 + random() * 1.1),
        height: 0,
        scale: 0.5 + random() * 0.9,
      });
    }
  }

  return {
    segments,
    length: COURSE.segments * SEGMENT_LENGTH,
    /** The segment under a distance along the course, in world units. */
    segmentAt(z) {
      const index = Math.floor(z / SEGMENT_LENGTH) % segments.length;
      return segments[index];
    },
    /** The segment index for a distance along the course. */
    indexAt(z) {
      return Math.floor(z / SEGMENT_LENGTH) % segments.length;
    },
  };
}
