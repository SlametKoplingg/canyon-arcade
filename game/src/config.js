// Canyon Arcade — every tuning number and colour in one place.
// The world is a pseudo-3D canyon: the plane flies forward along a course of
// segments, each 200 world units long. The renderer projects world space onto
// a fixed 1280x720 logical canvas and scales it to the window.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** How far ahead the renderer draws, in segments. */
export const DRAW_DISTANCE = 220;

/** Length of one course segment, in world units. */
export const SEGMENT_LENGTH = 200;

/** Half-width of the flyable canyon corridor, in world units. */
export const CORRIDOR_HALF = 2100;

/** Camera height above the canyon floor at the plane, in world units. */
export const CAMERA_HEIGHT = 1050;

/** Camera depth: 1 / tan(field-of-view / 2). */
export const CAMERA_DEPTH = 0.84;

/** The whole course: segments, rings, giants, and the finish runway. */
export const COURSE = {
  segments: 1800,
  /** Seconds allowed to reach the finish runway. Rings add time. */
  timeLimit: 150,
  /** Seconds added per ring flown through. */
  ringTimeBonus: 4,
  /** Rings on the course. */
  rings: 30,
};

/** The plane's flight envelope. */
export const PLANE = {
  /** Cruise speed, world units per second. */
  cruiseSpeed: 2400,
  /** Boost speed while Shift or the mouse is held. */
  boostSpeed: 3700,
  /** Slowest speed, at full back-throttle. */
  minSpeed: 1500,
  /** Lateral speed across the corridor, units per second. */
  steerSpeed: 2600,
  /** Vertical speed, units per second. */
  climbSpeed: 1500,
  /** Hover height above the canyon floor when level. */
  hoverHeight: 620,
  /** Highest the plane can climb above the floor. */
  maxAltitude: 2600,
  /** Lowest the plane can sink. */
  minAltitude: 160,
};

/** Damage, in integrity points (the plane starts at 100). */
export const DAMAGE = {
  // Tuned 26 Nov after the first headless play-test: the autopilot (a decent
  // player) died at 80% of the course on the old numbers (12/8/20). At 8/5/15
  // it finishes with ~25% integrity to spare; a careless player still dies.
  birdHit: 8,
  wallScrape: 5,
  /** One part falls off per minute of flight. */
  partLoss: 15,
  /** Parts that can fall off, in order: the plane is a skeleton after the last. */
  parts: ['left wingtip', 'right wingtip', 'tail fin', 'engine cowling', 'fuselage panel'],
};

/** Wing malfunction: a random control failure mid-flight. */
export const WING_ERROR = {
  /** Earliest seconds between malfunctions. */
  minGap: 22,
  /** Latest seconds between malfunctions. */
  maxGap: 38,
  /** How long the failure lasts, in seconds. */
  duration: 4,
  /** Steering strength left while the wing is failing (0..1). */
  steeringLeft: 0.38,
};

/** Bird flocks crossing the canyon. */
export const BIRDS = {
  /** Seconds between flocks. */
  interval: 5,
  intervalJitter: 2.5,
  /** Birds per flock. */
  minFlock: 3,
  maxFlock: 5,
  /** Lateral speed of a crossing bird, units per second. */
  crossSpeed: 900,
  /** Collision box half-size around a bird, in world units. */
  hitRadius: 150,
};

/** Scoring. */
export const SCORE = {
  ring: 100,
  /** Per second of flight, scaled by speed. */
  distancePerSecond: 12,
  /** A bird that passes within a hair of the plane. */
  nearMiss: 25,
  /** Bonus for finishing with integrity to spare. */
  finishIntegrityBonus: 250,
};

/** The two giants standing in the canyon, as fractions of the course. */
export const GIANTS = {
  godzillaAt: 0.34,
  ultramanAt: 0.66,
  /** Height of each giant, in world units. */
  godzillaHeight: 2600,
  ultramanHeight: 2400,
};

export const PALETTE = {
  skyTop: '#2e6fb0',
  skyMid: '#7fb6dd',
  skyLow: '#f6c98f',
  sun: '#fff3c4',
  sunCore: '#fffbe8',
  cloud: '#ffffff',
  mesaFar: '#b98a68',
  mesaNear: '#8a5f45',
  rockLight: '#c98d5f',
  rockMid: '#a96f47',
  rockDark: '#7d4f33',
  rockBand: '#8f5a3d',
  river: '#3f9db5',
  riverLight: '#7fd0dd',
  sand: '#d9b078',
  ring: '#ffd94d',
  ringGlow: '#fff3a6',
  planeBody: '#ff7a1a',
  planeBelly: '#f4f1e8',
  planeCanopy: '#59c2e8',
  planeTrim: '#1d3557',
  hudPanel: 'rgba(8, 18, 30, 0.62)',
  hudText: '#eef6ff',
  hudAmber: '#ffc53d',
  hudCyan: '#5fd4ff',
  hudRed: '#ff5a4e',
  hudGreen: '#7dffa8',
  title: '#fff6d8',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'canyon-arcade.best';
