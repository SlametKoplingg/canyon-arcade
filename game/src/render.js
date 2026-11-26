// Canyon Arcade — the renderer. A pseudo-3D chase view: the canyon is a ribbon
// of segments projected onto a fixed 1280x720 canvas, near to far, with the
// classic hill clip (a segment hidden behind a nearer crest is skipped). The
// plane is a fixed sprite; the world slides around it. HUD and screens are
// drawn in screen space on top.
//
// Motion note (motion-design skill, Energetic archetype): nothing on screen
// is ever linear — the plane's bank eases in the world, rings shimmer on a
// sine, messages pop with ease-out-back, damage shakes, the wing-error banner
// pulses. Three layers everywhere: primary (plane, rings), secondary (birds,
// particles, HUD pops), ambient (clouds, giants breathing, sun glow).

import {
  CAMERA_DEPTH,
  CAMERA_HEIGHT,
  CORRIDOR_HALF,
  DRAW_DISTANCE,
  FIELD,
  FONT,
  PALETTE,
  PLANE,
  SEGMENT_LENGTH,
} from './config.js';
import {
  drawBird,
  drawBush,
  drawCloud,
  drawGodzilla,
  drawPlane,
  drawRing,
  drawRock,
  drawUltraman,
  easeOutBack,
} from './sprites.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_PAUSE = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'won';

const WALL_HEIGHT = 1500;
const WALL_FLARE = 1.7;
const PLANE_SCREEN_Y = 0.74;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Floor height under a distance along the course. */
function floorAt(track, z) {
  const segment = track.segmentAt(z);
  const frac = ((z % SEGMENT_LENGTH) + SEGMENT_LENGTH) % SEGMENT_LENGTH / SEGMENT_LENGTH;
  return lerp(segment.p1.world.y, segment.p2.world.y, frac);
}

function project(p, cameraX, cameraY, cameraZ) {
  p.camera.x = p.world.x - cameraX;
  p.camera.y = p.world.y - cameraY;
  p.camera.z = p.world.z - cameraZ;
  p.screen.scale = CAMERA_DEPTH / p.camera.z;
  p.screen.x = Math.round(FIELD.width / 2 + p.screen.scale * p.camera.x * FIELD.width / 2);
  p.screen.y = Math.round(FIELD.height / 2 - p.screen.scale * p.camera.y * FIELD.height / 2);
  p.screen.w = Math.round(p.screen.scale * CORRIDOR_HALF * FIELD.width / 2);
}

/** Project an arbitrary world point; null when behind the camera. */
function projectPoint(x, y, z, cameraX, cameraY, cameraZ) {
  const cz = z - cameraZ;
  if (cz <= CAMERA_DEPTH) return null;
  const scale = CAMERA_DEPTH / cz;
  return {
    x: FIELD.width / 2 + scale * (x - cameraX) * FIELD.width / 2,
    y: FIELD.height / 2 - scale * (y - cameraY) * FIELD.height / 2,
    scale,
  };
}

function polygon(ctx, x1, y1, x2, y2, x3, y3, x4, y4, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

function drawSky(ctx, time) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.45, PALETTE.skyMid);
  g.addColorStop(0.62, PALETTE.skyLow);
  g.addColorStop(1, PALETTE.rockDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Sun: warm glow, top right (ambient layer).
  const sunX = FIELD.width * 0.82;
  const sunY = FIELD.height * 0.16;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  glow.addColorStop(0, PALETTE.sunCore);
  glow.addColorStop(0.35, 'rgba(255, 243, 196, 0.75)');
  glow.addColorStop(1, 'rgba(255, 243, 196, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // Clouds drift slowly across the sky (ambient layer).
  const clouds = [
    { x: 0.18, y: 0.12, w: 190, speed: 6 },
    { x: 0.48, y: 0.07, w: 150, speed: 9 },
    { x: 0.68, y: 0.2, w: 220, speed: 4 },
    { x: 0.9, y: 0.09, w: 130, speed: 11 },
  ];
  for (const cloud of clouds) {
    const cx = (((cloud.x * FIELD.width + time * cloud.speed) % (FIELD.width + 260)) + FIELD.width + 260) % (FIELD.width + 260) - 130;
    drawCloud(ctx, cx, cloud.y * FIELD.height, cloud.w, cloud.w * 0.38, 0.85);
  }
}

function drawSegment(ctx, segment, cameraY, fog) {
  const p1 = segment.p1.screen;
  const p2 = segment.p2.screen;
  const w1 = p1.w;
  const w2 = p2.w;
  const alt = segment.index % 2 === 0;

  ctx.globalAlpha = 1 - fog * 0.72;

  if (segment.finish) {
    // The runway: dark asphalt with a dashed centre line.
    polygon(ctx, p1.x - w1, p1.y, p1.x + w1, p1.y, p2.x + w2, p2.y, p2.x - w2, p2.y, '#3a3f4a');
    polygon(ctx, p1.x - w1 * 0.5, p1.y, p1.x + w1 * 0.5, p1.y, p2.x + w2 * 0.5, p2.y, p2.x - w2 * 0.5, p2.y, '#434a58');
    if (segment.index % 2 === 0) {
      const dash = 0.06;
      polygon(ctx, p1.x - w1 * dash, p1.y, p1.x + w1 * dash, p1.y, p2.x + w2 * dash, p2.y, p2.x - w2 * dash, p2.y, '#f4f1e8');
    }
  } else {
    // Canyon floor: warm sand, banded by segment so speed reads.
    polygon(ctx, p1.x - w1, p1.y, p1.x + w1, p1.y, p2.x + w2, p2.y, p2.x - w2, p2.y, alt ? PALETTE.sand : '#cfa66e');
    // The river down the middle: a blue strip that shimmers.
    const rw1 = w1 * 0.3;
    const rw2 = w2 * 0.3;
    polygon(ctx, p1.x - rw1, p1.y, p1.x + rw1, p1.y, p2.x + rw2, p2.y, p2.x - rw2, p2.y, alt ? PALETTE.river : PALETTE.riverLight);
  }

  // Walls: from the floor edge up and out, banded rock.
  const top1 = projectPoint(
    segment.p1.world.x - CORRIDOR_HALF * WALL_FLARE,
    segment.p1.world.y + WALL_HEIGHT,
    segment.p1.world.z,
    segment._cameraX1,
    cameraY,
    segment._cameraZ,
  );
  const top2 = projectPoint(
    segment.p2.world.x - CORRIDOR_HALF * WALL_FLARE,
    segment.p2.world.y + WALL_HEIGHT,
    segment.p2.world.z,
    segment._cameraX2,
    cameraY,
    segment._cameraZ,
  );
  const top1r = projectPoint(
    segment.p1.world.x + CORRIDOR_HALF * WALL_FLARE,
    segment.p1.world.y + WALL_HEIGHT,
    segment.p1.world.z,
    segment._cameraX1,
    cameraY,
    segment._cameraZ,
  );
  const top2r = projectPoint(
    segment.p2.world.x + CORRIDOR_HALF * WALL_FLARE,
    segment.p2.world.y + WALL_HEIGHT,
    segment.p2.world.z,
    segment._cameraX2,
    cameraY,
    segment._cameraZ,
  );
  if (top1 && top2) {
    polygon(ctx, p1.x - w1, p1.y, top1.x, top1.y, top2.x, top2.y, p2.x - w2, p2.y, alt ? PALETTE.rockMid : PALETTE.rockDark);
    // A lighter band near the top of the wall, for strata.
    polygon(ctx, top1.x, top1.y, p1.x - w1 * 1.35, lerp(p1.y, top1.y, 0.45), p2.x - w2 * 1.35, lerp(p2.y, top2.y, 0.45), top2.x, top2.y, alt ? PALETTE.rockLight : PALETTE.rockBand);
  }
  if (top1r && top2r) {
    polygon(ctx, p1.x + w1, p1.y, top1r.x, top1r.y, top2r.x, top2r.y, p2.x + w2, p2.y, alt ? PALETTE.rockDark : PALETTE.rockMid);
    polygon(ctx, top1r.x, top1r.y, p1.x + w1 * 1.35, lerp(p1.y, top1r.y, 0.45), p2.x + w2 * 1.35, lerp(p2.y, top2r.y, 0.45), top2r.x, top2r.y, alt ? PALETTE.rockBand : PALETTE.rockLight);
  }

  ctx.globalAlpha = 1;
}

function drawSegmentSprites(ctx, segment, state, cameraY, fog) {
  const p1 = segment.p1.screen;
  const p2 = segment.p2.screen;
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const midW = (p1.w + p2.w) / 2;
  const midScale = (segment.p1.screen.scale + segment.p2.screen.scale) / 2;

  ctx.globalAlpha = 1 - fog * 0.6;

  // Rocks and bushes pinned to this segment.
  for (const sprite of segment.sprites) {
    const wx = sprite.offset * CORRIDOR_HALF;
    const pt = projectPoint(wx, segment.p1.world.y, segment.p1.world.z + SEGMENT_LENGTH / 2, segment._cameraX1, cameraY, segment._cameraZ);
    if (!pt) continue;
    const w = pt.scale * 900 * sprite.scale;
    if (w < 2) continue;
    if (sprite.kind === 'rock') drawRock(ctx, pt.x, pt.y, w, w * 0.83);
    else drawBush(ctx, pt.x, pt.y, w * 0.8, w * 0.64);
  }

  // The target ring: gold, shimmering, ahead on the course.
  if (segment.ring) {
    const ring = segment.ring;
    const z = segment.p1.world.z + SEGMENT_LENGTH / 2;
    const pt = projectPoint(ring.x, segment.p1.world.y + ring.altitude, z, segment._cameraX1, cameraY, segment._cameraZ);
    if (pt) {
      const radius = pt.scale * ring.radius * FIELD.width * 0.5;
      if (radius > 2) {
        if (ring.passed) ctx.globalAlpha = 0.28;
        drawRing(ctx, pt.x, pt.y, radius, 0.5 + 0.5 * Math.sin(state.time * 3 + segment.index));
        ctx.globalAlpha = 1 - fog * 0.6;
      }
    }
  }

  // The giants: Godzilla wading the river right, Ultraman on a left ledge.
  if (segment.giant) {
    const isGodzilla = segment.giant === 'godzilla';
    const height = isGodzilla ? 2600 : 2400;
    const gx = isGodzilla ? CORRIDOR_HALF * 0.55 : -CORRIDOR_HALF * 1.05;
    const gy = segment.p1.world.y + (isGodzilla ? 0 : 320);
    const pt = projectPoint(gx, gy, segment.p1.world.z + SEGMENT_LENGTH / 2, segment._cameraX1, cameraY, segment._cameraZ);
    if (pt) {
      const h = pt.scale * height * FIELD.height * 0.5;
      const w = h * (200 / 260);
      if (h > 4) {
        if (isGodzilla) drawGodzilla(ctx, pt.x, pt.y, w, h, state.time);
        else drawUltraman(ctx, pt.x, pt.y, w, h, state.time);
      }
    }
  }

  ctx.globalAlpha = 1;
  void midX;
  void midY;
  void midW;
  void midScale;
}

function drawAirborne(ctx, state, track, cameraY) {
  // Birds, particles and falling parts: far first, so near ones draw over.
  const items = [];
  for (const bird of state.birds) items.push({ kind: 'bird', z: bird.z, bird });
  for (const p of state.particles) items.push({ kind: 'particle', z: p.z, p });
  for (const f of state.fallingParts) items.push({ kind: 'part', z: f.z, f });
  items.sort((a, b) => b.z - a.z);
  for (const item of items) {
    const segment = track.segmentAt(item.z);
    const cameraX = state.playerX - (segment.renderOffset || 0);
    if (item.kind === 'bird') {
      const pt = projectPoint(item.bird.x, item.bird.y, item.bird.z, cameraX, cameraY, state.distance);
      if (!pt) continue;
      const w = pt.scale * 340;
      if (w < 2 || pt.x < -60 || pt.x > FIELD.width + 60 || pt.y < -40 || pt.y > FIELD.height + 40) continue;
      drawBird(ctx, pt.x, pt.y, w, w / 2, item.bird.flap);
    } else if (item.kind === 'particle') {
      const pt = projectPoint(item.p.x, item.p.y, item.p.z, cameraX, cameraY, state.distance);
      if (!pt) continue;
      const size = pt.scale * item.p.size * FIELD.width * 0.5;
      if (size < 1) continue;
      ctx.globalAlpha = clamp(item.p.life / item.p.maxLife, 0, 1);
      ctx.fillStyle = item.p.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      const pt = projectPoint(item.f.x, item.f.y, item.f.z, cameraX, cameraY, state.distance);
      if (!pt) continue;
      const size = pt.scale * 420;
      if (size < 2) continue;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(item.f.angle);
      ctx.fillStyle = '#ff7a1a';
      ctx.fillRect(-size / 2, -size / 6, size, size / 3);
      ctx.fillStyle = '#1d3557';
      ctx.fillRect(-size / 2, -size / 6, size / 4, size / 3);
      ctx.restore();
    }
  }
}

function drawPlaneAndShadow(ctx, state, track, cameraY, time) {
  // Soft shadow on the canyon floor below the plane.
  const floorY = floorAt(track, state.distance + 700);
  const shadow = projectPoint(state.playerX, floorY + 30, state.distance + 700, state.playerX, cameraY, state.distance);
  if (shadow) {
    const rx = shadow.scale * 520;
    if (rx > 2) {
      ctx.fillStyle = 'rgba(10, 10, 20, 0.28)';
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, rx, rx * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The plane itself, chase view, banked with the steering.
  const px = FIELD.width / 2;
  const py = FIELD.height * PLANE_SCREEN_Y;
  drawPlane(ctx, px, py, 250, 148, state.bank, state.parts, time);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(238, 246, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHud(ctx, state, view) {
  const time = state.time;
  ctx.textBaseline = 'alphabetic';

  // Top-left: score, rings, best.
  panel(ctx, 16, 14, 250, 92);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `700 26px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${String(Math.floor(state.score)).padStart(6, '0')}`, 30, 46);
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.fillText(`◉ RINGS ${state.ringsPassed}/${state.ringsTotal}`, 30, 72);
  ctx.fillStyle = 'rgba(238, 246, 255, 0.75)';
  ctx.fillText(`BEST ${Math.floor(view.best)}`, 30, 96);

  // Top-centre: the clock — big, and red-pulsing under 20 seconds.
  const t = Math.max(0, Math.ceil(state.timeLeft));
  const mm = Math.floor(t / 60);
  const ss = String(t % 60).padStart(2, '0');
  panel(ctx, FIELD.width / 2 - 90, 14, 180, 64);
  ctx.textAlign = 'center';
  ctx.font = `700 34px ${FONT}`;
  if (state.timeLeft < 20 && state.status === 'playing') {
    ctx.fillStyle = (Math.sin(time * 8) > 0 ? PALETTE.hudRed : PALETTE.hudText);
  } else {
    ctx.fillStyle = PALETTE.hudText;
  }
  ctx.fillText(`${mm}:${ss}`, FIELD.width / 2, 58);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = 'rgba(238, 246, 255, 0.7)';
  ctx.fillText('TIME LEFT', FIELD.width / 2, 74);

  // Top-right: the instruments — speed, altitude, heading tape.
  // Three rows, no overlaps: numbers, labels, then the tape in its own band.
  panel(ctx, FIELD.width - 316, 14, 300, 124);
  const speedKnots = Math.round(state.speed * 0.11);
  const altFeet = Math.round(state.altitude * 3.2);
  ctx.textAlign = 'right';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.fillText(`${speedKnots} KT`, FIELD.width - 168, 46);
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(`${altFeet} FT`, FIELD.width - 30, 46);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = 'rgba(238, 246, 255, 0.7)';
  ctx.fillText('SPEED', FIELD.width - 168, 66);
  ctx.fillText('ALTITUDE', FIELD.width - 30, 66);
  // Heading tape: the exact heading in amber, a caret, then the tick band.
  const tapeX = FIELD.width - 316;
  const tapeW = 300;
  const tapeTop = 96;
  const tapeBottom = 120;
  const heading = ((Math.round(state.heading) % 360) + 360) % 360;
  ctx.textAlign = 'center';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.fillText(`${String(heading).padStart(3, '0')}°`, tapeX + tapeW / 2, 84);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(tapeX + tapeW / 2, tapeTop);
  ctx.lineTo(tapeX + tapeW / 2 - 5, tapeTop + 7);
  ctx.lineTo(tapeX + tapeW / 2 + 5, tapeTop + 7);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(tapeX, tapeTop, tapeW, tapeBottom - tapeTop);
  ctx.clip();
  ctx.strokeStyle = 'rgba(238, 246, 255, 0.5)';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'center';
  for (let d = -40; d <= 40; d += 10) {
    const h = ((heading + d) % 360 + 360) % 360;
    const x = tapeX + tapeW / 2 + d * 3.4;
    const major = h % 30 === 0;
    ctx.beginPath();
    ctx.moveTo(x, tapeTop + 8);
    ctx.lineTo(x, tapeTop + (major ? 18 : 13));
    ctx.stroke();
    if (major) ctx.fillText(String(h).padStart(3, '0'), x, tapeBottom - 2);
  }
  ctx.restore();

  // Bottom-left: airframe integrity + the five parts.
  panel(ctx, 16, FIELD.height - 92, 300, 78);
  ctx.textAlign = 'left';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('AIRFRAME', 30, FIELD.height - 66);
  const barW = 272;
  const barX = 30;
  const barY = FIELD.height - 56;
  ctx.fillStyle = 'rgba(238, 246, 255, 0.15)';
  ctx.fillRect(barX, barY, barW, 12);
  const integ = state.integrity / 100;
  ctx.fillStyle = integ > 0.5 ? PALETTE.hudGreen : integ > 0.25 ? PALETTE.hudAmber : PALETTE.hudRed;
  ctx.fillRect(barX, barY, barW * integ, 12);
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(`${Math.round(state.integrity)}%`, barX + barW + 8, barY + 11);
  const partNames = [['L-WING', state.parts.leftWing], ['R-WING', state.parts.rightWing], ['TAIL', state.parts.tailFin], ['COWL', state.parts.cowling], ['PANEL', state.parts.panel]];
  ctx.font = `600 12px ${FONT}`;
  partNames.forEach(([name, ok], i) => {
    const x = 30 + i * 56;
    ctx.fillStyle = ok ? PALETTE.hudGreen : PALETTE.hudRed;
    ctx.fillText(ok ? `● ${name}` : `✕ ${name}`, x, FIELD.height - 26);
  });

  // Bottom-right: throttle.
  panel(ctx, FIELD.width - 216, FIELD.height - 92, 200, 78);
  ctx.textAlign = 'left';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('THROTTLE', FIELD.width - 202, FIELD.height - 66);
  ctx.fillStyle = 'rgba(238, 246, 255, 0.15)';
  ctx.fillRect(FIELD.width - 202, FIELD.height - 56, 172, 12);
  ctx.fillStyle = state.speed > 3200 ? PALETTE.hudAmber : PALETTE.hudCyan;
  ctx.fillRect(FIELD.width - 202, FIELD.height - 56, 172 * clamp(state.throttle, 0, 1), 12);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = state.speed > 3200 ? PALETTE.hudAmber : 'rgba(238, 246, 255, 0.75)';
  ctx.fillText(state.speed > 3200 ? 'BOOST' : 'CRUISE', FIELD.width - 202, FIELD.height - 26);

  // Wing malfunction: a flashing red banner, never just text alone.
  if (state.wingError.active) {
    const pulse = 0.55 + 0.45 * Math.sin(time * 10);
    ctx.fillStyle = `rgba(255, 90, 78, ${0.22 + 0.2 * pulse})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = `rgba(120, 10, 8, ${0.75 * pulse})`;
    ctx.fillRect(FIELD.width / 2 - 300, 122, 600, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('⚠ WING MALFUNCTION — CONTROLS DEGRADED', FIELD.width / 2, 149);
  }

  // Transient messages, popping in with ease-out-back.
  ctx.textAlign = 'center';
  state.messages.forEach((message, i) => {
    const remain = message.until - time;
    const age = 2.2 - remain;
    const pop = easeOutBack(clamp(age / 0.28, 0, 1));
    const alpha = clamp(remain / 0.5, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${Math.round(22 * pop)}px ${FONT}`;
    ctx.fillStyle = message.color;
    ctx.fillText(message.text, FIELD.width / 2, 196 + i * 30);
    ctx.globalAlpha = 1;
  });
}

function overlay(ctx, title, lines, accent, blink) {
  ctx.fillStyle = 'rgba(6, 12, 22, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || PALETTE.title;
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(title, FIELD.width / 2, 250);
  ctx.font = `400 21px ${FONT}`;
  ctx.fillStyle = PALETTE.hudText;
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD.width / 2, 300 + i * 32);
  });
  if (blink) {
    if (Math.sin(Date.now() / 350) > -0.2) {
      ctx.font = `700 24px ${FONT}`;
      ctx.fillStyle = PALETTE.hudAmber;
      ctx.fillText(blink, FIELD.width / 2, 300 + lines.length * 32 + 30);
    }
  }
}

/**
 * Draw one frame. `view` is { screen, best }: screen is one of the SCREEN_*
 * constants, best is the saved best score to show on the HUD.
 */
export function render(ctx, world, track, view) {
  const { state } = world;
  const time = state.time;
  const baseIndex = track.indexAt(state.distance);
  const basePercent = ((state.distance % SEGMENT_LENGTH) + SEGMENT_LENGTH) % SEGMENT_LENGTH / SEGMENT_LENGTH;
  const cameraY = floorAt(track, state.distance) + state.altitude + (CAMERA_HEIGHT - PLANE.hoverHeight);

  ctx.save();
  if (state.shake > 0.01) {
    ctx.translate(Math.sin(time * 61) * 9 * state.shake, Math.cos(time * 53) * 7 * state.shake);
  }
  drawSky(ctx, time);

  // The canyon, near to far, with the classic hill clip: a segment whose far
  // end does not rise above the crest of nearer segments is hidden by it.
  const baseSegment = track.segments[baseIndex];
  let x = 0;
  let dx = -(baseSegment.curve * basePercent);
  let maxY = FIELD.height;
  for (let n = 0; n < DRAW_DISTANCE; n += 1) {
    const index = baseIndex + n;
    if (index >= track.segments.length) break;
    const segment = track.segments[index];
    const cameraX1 = state.playerX - x;
    const cameraX2 = state.playerX - x - dx;
    segment._cameraX1 = cameraX1;
    segment._cameraX2 = cameraX2;
    segment._cameraZ = state.distance;
    segment.renderOffset = x;
    project(segment.p1, cameraX1, cameraY, state.distance);
    project(segment.p2, cameraX2, cameraY, state.distance);
    x += dx;
    dx += segment.curve;
    if (segment.p1.camera.z <= CAMERA_DEPTH) continue;
    if (segment.p2.screen.y >= segment.p1.screen.y) continue;
    if (segment.p2.screen.y >= maxY) continue;
    const fog = n / DRAW_DISTANCE;
    drawSegment(ctx, segment, cameraY, fog);
    drawSegmentSprites(ctx, segment, state, cameraY, fog);
    maxY = segment.p1.screen.y;
  }

  drawAirborne(ctx, state, track, cameraY);
  drawPlaneAndShadow(ctx, state, track, cameraY, time);
  ctx.restore();

  // HUD on every screen except the title; overlays on top.
  if (view.screen !== SCREEN_TITLE) drawHud(ctx, state, view);

  if (view.screen === SCREEN_TITLE) {
    overlay(ctx, 'CANYON ARCADE', [
      'Thread the golden rings through the canyon — low, fast, alive.',
      'Mind the birds. Mind the wing. Mind the clock: one part falls off every minute.',
      'Godzilla wades the river at the first bend. Ultraman watches from the second.',
      '',
      '← → / A D steer    ↑ ↓ / W S climb    SHIFT boost    P pause    M mute',
      `BEST ${Math.floor(view.best)}`,
    ], PALETTE.title, 'PRESS SPACE OR CLICK TO FLY');
  } else if (view.screen === SCREEN_PAUSE) {
    overlay(ctx, 'PAUSED', ['The canyon waits. The clock does not — well, now it does.'], PALETTE.hudCyan, 'PRESS P TO RESUME');
  } else if (view.screen === SCREEN_OVER) {
    const cause = state.cause === 'time'
      ? 'Out of time — the runway was still ahead.'
      : 'Airframe lost — the plane is a skeleton, and skeletons do not fly.';
    overlay(ctx, 'GAME OVER', [
      cause,
      `SCORE ${Math.floor(state.score)}   ·   RINGS ${state.ringsPassed}/${state.ringsTotal}   ·   BEST ${Math.floor(Math.max(view.best, state.score))}`,
    ], PALETTE.hudRed, 'PRESS SPACE TO FLY AGAIN');
  } else if (view.screen === SCREEN_WIN) {
    overlay(ctx, 'COURSE COMPLETE!', [
      'Runway reached — Canyon Arcade conquered.',
      `SCORE ${Math.floor(state.score)}   ·   RINGS ${state.ringsPassed}/${state.ringsTotal}   ·   INTEGRITY ${Math.round(state.integrity)}%   ·   BEST ${Math.floor(Math.max(view.best, state.score))}`,
    ], PALETTE.hudGreen, 'PRESS SPACE TO FLY AGAIN');
  }
}
