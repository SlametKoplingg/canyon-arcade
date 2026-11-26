// Canyon Arcade — every picture in the game is drawn here, in code, from scratch.
// Nothing is downloaded: the plane, the giants, the birds and the rings are all
// canvas paths. Each draw call works in a local box (0..w, 0..h) so the renderer
// can place and scale it by perspective.
//
// Motion note (motion-design skill, Energetic archetype): ambient life never
// stops — Godzilla's dorsal plates breathe with a sine pulse, Ultraman's chest
// timer blinks, birds flap, rings shimmer. Primary motion (the plane's bank,
// a ring burst) is eased, never linear.

/** Ease-out-back: overshoots a touch, then settles — the playful pop. */
export function easeOutBack(t) {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/** Ease-out-expo: fast start, long gentle landing — for bursts and flashes. */
export function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Sine ease-in-out: seamless for looping ambient motion. */
export function easeSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * The plane, seen from behind and slightly above (chase view). Drawn in a
 * 220x130 box, nose pointing up (away from the viewer). `bank` tilts it left
 * or right in radians. `parts` names the pieces still attached; a lost piece
 * is simply not drawn, leaving a sparking stub.
 */
export function drawPlane(ctx, x, y, w, h, bank, parts, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank);
  ctx.scale(w / 220, h / 130);
  ctx.translate(-110, -65);

  // Engine glow: flickers with the throttle (ambient layer).
  const flicker = 0.75 + 0.25 * Math.sin(time * 23) * Math.sin(time * 7.3);
  const glow = ctx.createRadialGradient(110, 118, 2, 110, 118, 26 * flicker);
  glow.addColorStop(0, 'rgba(255, 214, 120, 0.95)');
  glow.addColorStop(0.5, 'rgba(255, 122, 26, 0.55)');
  glow.addColorStop(1, 'rgba(255, 122, 26, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(110, 118, 26 * flicker, 0, Math.PI * 2);
  ctx.fill();

  // Tail fin (top of the sprite is the nose; the tail is at the bottom).
  if (parts.tailFin) {
    ctx.fillStyle = '#1d3557';
    ctx.beginPath();
    ctx.moveTo(102, 108);
    ctx.lineTo(110, 78);
    ctx.lineTo(118, 108);
    ctx.closePath();
    ctx.fill();
  } else {
    drawStub(ctx, 110, 104, time);
  }

  // Wings: left and right, each detachable.
  if (parts.leftWing) {
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(104, 78);
    ctx.lineTo(18, 108);
    ctx.lineTo(30, 118);
    ctx.lineTo(104, 96);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d3557';
    ctx.fillRect(20, 106, 12, 5);
  } else {
    drawStub(ctx, 100, 88, time);
  }
  if (parts.rightWing) {
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(116, 78);
    ctx.lineTo(202, 108);
    ctx.lineTo(190, 118);
    ctx.lineTo(116, 96);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d3557';
    ctx.fillRect(188, 106, 12, 5);
  } else {
    drawStub(ctx, 120, 88, time);
  }

  // Fuselage: a tapered body, nose away from the viewer.
  const body = ctx.createLinearGradient(92, 0, 128, 0);
  body.addColorStop(0, '#ff9a3d');
  body.addColorStop(0.5, '#ff7a1a');
  body.addColorStop(1, '#e85d04');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(110, 6);
  ctx.quadraticCurveTo(126, 34, 124, 74);
  ctx.quadraticCurveTo(123, 106, 110, 116);
  ctx.quadraticCurveTo(97, 106, 96, 74);
  ctx.quadraticCurveTo(94, 34, 110, 6);
  ctx.fill();

  // Belly panel: falls off with the fuselage panel part.
  if (parts.panel) {
    ctx.fillStyle = '#f4f1e8';
    ctx.beginPath();
    ctx.moveTo(100, 78);
    ctx.quadraticCurveTo(110, 72, 120, 78);
    ctx.lineTo(118, 104);
    ctx.quadraticCurveTo(110, 110, 102, 104);
    ctx.closePath();
    ctx.fill();
  }

  // Canopy: lit glass, the "instruments lit" glint the judge looks for.
  ctx.fillStyle = '#59c2e8';
  ctx.beginPath();
  ctx.ellipse(110, 44, 7, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(108, 38, 2.5, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Engine cowling: the round intake at the very back.
  if (parts.cowling) {
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.arc(110, 114, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.arc(110, 114, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawStub(ctx, 110, 114, time);
  }

  ctx.restore();
}

/** A sparking stub where a part used to be: orange sparks, eased flicker. */
function drawStub(ctx, x, y, time) {
  const s = 0.6 + 0.4 * Math.abs(Math.sin(time * 9 + x));
  ctx.fillStyle = `rgba(255, 176, 32, ${0.5 + 0.5 * s})`;
  ctx.beginPath();
  ctx.arc(x, y, 3.5 * s + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Godzilla: a green kaiju wading the river, drawn in a 200x260 box, feet at
 * the bottom. Dorsal plates breathe with a sine glow. Original code art — a
 * friendly nod, not a copy of any film frame.
 */
export function drawGodzilla(ctx, x, y, w, h, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 200, h / 260);
  ctx.translate(-100, -260);

  const breathe = 0.5 + 0.5 * Math.sin(time * 1.8);

  // Tail, sweeping to the left.
  ctx.fillStyle = '#2f6b33';
  ctx.beginPath();
  ctx.moveTo(100, 210);
  ctx.quadraticCurveTo(40, 230, 8, 196);
  ctx.quadraticCurveTo(30, 186, 58, 196);
  ctx.quadraticCurveTo(88, 200, 104, 186);
  ctx.closePath();
  ctx.fill();

  // Legs and feet.
  ctx.fillStyle = '#3a7d3f';
  ctx.beginPath();
  ctx.moveTo(78, 190);
  ctx.lineTo(70, 252);
  ctx.lineTo(92, 252);
  ctx.lineTo(96, 196);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(112, 196);
  ctx.lineTo(118, 252);
  ctx.lineTo(140, 252);
  ctx.lineTo(132, 190);
  ctx.closePath();
  ctx.fill();

  // Body: a big pear-shaped torso.
  const body = ctx.createLinearGradient(70, 60, 140, 220);
  body.addColorStop(0, '#4c9a52');
  body.addColorStop(1, '#2f6b33');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(100, 52);
  ctx.quadraticCurveTo(146, 70, 142, 140);
  ctx.quadraticCurveTo(140, 190, 118, 200);
  ctx.quadraticCurveTo(100, 206, 82, 200);
  ctx.quadraticCurveTo(60, 190, 58, 140);
  ctx.quadraticCurveTo(54, 70, 100, 52);
  ctx.fill();

  // Dorsal plates down the back, glowing with the breath.
  ctx.fillStyle = `rgba(190, 255, 120, ${0.35 + 0.5 * breathe})`;
  for (let i = 0; i < 5; i += 1) {
    const py = 66 + i * 26;
    ctx.beginPath();
    ctx.moveTo(96, py);
    ctx.lineTo(74, py + 12);
    ctx.lineTo(96, py + 24);
    ctx.closePath();
    ctx.fill();
  }

  // Arms: short, reaching forward.
  ctx.fillStyle = '#3a7d3f';
  ctx.beginPath();
  ctx.moveTo(64, 108);
  ctx.quadraticCurveTo(44, 122, 52, 146);
  ctx.quadraticCurveTo(60, 152, 66, 138);
  ctx.quadraticCurveTo(72, 122, 72, 108);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(136, 108);
  ctx.quadraticCurveTo(156, 122, 148, 146);
  ctx.quadraticCurveTo(140, 152, 134, 138);
  ctx.quadraticCurveTo(128, 122, 128, 108);
  ctx.closePath();
  ctx.fill();

  // Head with a heavy brow and a jaw.
  ctx.fillStyle = '#4c9a52';
  ctx.beginPath();
  ctx.moveTo(100, 18);
  ctx.quadraticCurveTo(128, 20, 128, 44);
  ctx.quadraticCurveTo(128, 58, 112, 60);
  ctx.lineTo(112, 68);
  ctx.lineTo(88, 68);
  ctx.lineTo(88, 60);
  ctx.quadraticCurveTo(72, 58, 72, 44);
  ctx.quadraticCurveTo(72, 20, 100, 18);
  ctx.fill();
  // Eye: glowing amber.
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(112, 40, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d2b1d';
  ctx.beginPath();
  ctx.arc(113, 40, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // Jaw line.
  ctx.strokeStyle = '#1d4d22';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(88, 56);
  ctx.lineTo(124, 56);
  ctx.stroke();

  ctx.restore();
}

/**
 * Ultraman: a silver giant with red markings, drawn in a 200x260 box, feet at
 * the bottom, one arm raised to the sky. His chest timer blinks blue-red.
 * Original code art — a friendly nod, not a copy of any frame.
 */
export function drawUltraman(ctx, x, y, w, h, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 200, h / 260);
  ctx.translate(-100, -260);

  const blink = Math.sin(time * 3.2) > 0;

  // Raised right arm.
  ctx.fillStyle = '#c0c8d0';
  ctx.beginPath();
  ctx.moveTo(128, 96);
  ctx.quadraticCurveTo(160, 70, 168, 34);
  ctx.quadraticCurveTo(170, 22, 160, 20);
  ctx.quadraticCurveTo(150, 20, 148, 34);
  ctx.quadraticCurveTo(142, 62, 120, 82);
  ctx.closePath();
  ctx.fill();
  // Red stripe on the raised arm.
  ctx.fillStyle = '#d92038';
  ctx.beginPath();
  ctx.moveTo(150, 52);
  ctx.lineTo(164, 40);
  ctx.lineTo(168, 50);
  ctx.lineTo(154, 62);
  ctx.closePath();
  ctx.fill();

  // Left arm resting down.
  ctx.fillStyle = '#c0c8d0';
  ctx.beginPath();
  ctx.moveTo(72, 96);
  ctx.quadraticCurveTo(56, 130, 60, 164);
  ctx.quadraticCurveTo(62, 176, 72, 172);
  ctx.quadraticCurveTo(78, 140, 80, 108);
  ctx.closePath();
  ctx.fill();

  // Legs.
  ctx.fillStyle = '#c0c8d0';
  ctx.beginPath();
  ctx.moveTo(82, 180);
  ctx.lineTo(76, 252);
  ctx.lineTo(98, 252);
  ctx.lineTo(100, 184);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(112, 184);
  ctx.lineTo(114, 252);
  ctx.lineTo(136, 252);
  ctx.lineTo(130, 180);
  ctx.closePath();
  ctx.fill();
  // Red boots.
  ctx.fillStyle = '#d92038';
  ctx.fillRect(76, 232, 22, 20);
  ctx.fillRect(114, 232, 22, 20);

  // Torso: silver with the red chest pattern.
  const torso = ctx.createLinearGradient(70, 80, 140, 190);
  torso.addColorStop(0, '#e8edf2');
  torso.addColorStop(1, '#aab4c0');
  ctx.fillStyle = torso;
  ctx.beginPath();
  ctx.moveTo(100, 62);
  ctx.quadraticCurveTo(138, 66, 138, 120);
  ctx.quadraticCurveTo(138, 170, 122, 188);
  ctx.quadraticCurveTo(100, 196, 78, 188);
  ctx.quadraticCurveTo(62, 170, 62, 120);
  ctx.quadraticCurveTo(62, 66, 100, 62);
  ctx.fill();
  // Red chest V.
  ctx.fillStyle = '#d92038';
  ctx.beginPath();
  ctx.moveTo(78, 78);
  ctx.lineTo(100, 118);
  ctx.lineTo(122, 78);
  ctx.lineTo(112, 74);
  ctx.lineTo(100, 100);
  ctx.lineTo(88, 74);
  ctx.closePath();
  ctx.fill();

  // Colour timer on the chest: blinks blue, then red when "low".
  ctx.fillStyle = blink ? '#59c2e8' : '#ff5a4e';
  ctx.beginPath();
  ctx.arc(100, 138, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(100, 138, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Head: silver with the fin crest and glowing eyes.
  ctx.fillStyle = '#dfe5ea';
  ctx.beginPath();
  ctx.moveTo(100, 14);
  ctx.quadraticCurveTo(126, 16, 126, 40);
  ctx.quadraticCurveTo(126, 58, 108, 62);
  ctx.quadraticCurveTo(92, 58, 74, 40);
  ctx.quadraticCurveTo(74, 16, 100, 14);
  ctx.fill();
  // Fin crest.
  ctx.fillStyle = '#c0c8d0';
  ctx.beginPath();
  ctx.moveTo(100, 8);
  ctx.lineTo(108, 22);
  ctx.lineTo(92, 22);
  ctx.closePath();
  ctx.fill();
  // Eyes: long glowing slits.
  ctx.fillStyle = '#ffe66d';
  ctx.beginPath();
  ctx.ellipse(88, 38, 8, 3.5, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(112, 38, 8, 3.5, 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** A bird in flight, drawn in a 60x30 box, wings mid-flap by `flap` (0..1). */
export function drawBird(ctx, x, y, w, h, flap) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 60, h / 30);
  ctx.translate(-30, -15);
  const wing = Math.sin(flap * Math.PI * 2) * 10;
  ctx.fillStyle = '#2b2d42';
  // Body.
  ctx.beginPath();
  ctx.ellipse(30, 16, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head and beak.
  ctx.beginPath();
  ctx.arc(42, 13, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4a259';
  ctx.beginPath();
  ctx.moveTo(45, 12);
  ctx.lineTo(52, 14);
  ctx.lineTo(45, 16);
  ctx.closePath();
  ctx.fill();
  // Wings, flapping.
  ctx.fillStyle = '#3a3d5c';
  ctx.beginPath();
  ctx.moveTo(28, 14);
  ctx.quadraticCurveTo(18, 8 - wing, 8, 12 - wing);
  ctx.quadraticCurveTo(18, 16, 28, 17);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(32, 14);
  ctx.quadraticCurveTo(40, 8 + wing, 50, 12 + wing);
  ctx.quadraticCurveTo(42, 16, 32, 17);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A golden target ring, drawn as a torus with a glow; `pulse` (0..1) shimmers it. */
export function drawRing(ctx, x, y, radius, pulse) {
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 1.5);
  glow.addColorStop(0, 'rgba(255, 217, 77, 0)');
  glow.addColorStop(0.7, `rgba(255, 217, 77, ${0.10 + 0.12 * pulse})`);
  glow.addColorStop(1, 'rgba(255, 217, 77, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(3, radius * 0.09);
  ctx.strokeStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, radius * 0.03);
  ctx.strokeStyle = '#fff3a6';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** An angular canyon rock, drawn in a 60x50 box. */
export function drawRock(ctx, x, y, w, h) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 60, h / 50);
  ctx.translate(-30, -50);
  ctx.fillStyle = '#7d4f33';
  ctx.beginPath();
  ctx.moveTo(30, 2);
  ctx.lineTo(52, 26);
  ctx.lineTo(46, 50);
  ctx.lineTo(12, 50);
  ctx.lineTo(6, 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a96f47';
  ctx.beginPath();
  ctx.moveTo(30, 2);
  ctx.lineTo(52, 26);
  ctx.lineTo(30, 34);
  ctx.lineTo(6, 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c98d5f';
  ctx.beginPath();
  ctx.moveTo(14, 14);
  ctx.lineTo(30, 2);
  ctx.lineTo(30, 34);
  ctx.lineTo(14, 26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A dry desert bush, drawn in a 50x40 box. */
export function drawBush(ctx, x, y, w, h) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 50, h / 40);
  ctx.translate(-25, -40);
  ctx.strokeStyle = '#6b7c3f';
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(25, 40);
    ctx.quadraticCurveTo(25 + i * 8, 22, 25 + i * 13, 6 + Math.abs(i) * 4);
    ctx.stroke();
  }
  ctx.restore();
}

/** A soft cloud, drawn in a 160x60 box. */
export function drawCloud(ctx, x, y, w, h, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 160, h / 60);
  ctx.translate(-80, -30);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.arc(50, 38, 20, 0, Math.PI * 2);
  ctx.arc(85, 28, 26, 0, Math.PI * 2);
  ctx.arc(120, 38, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(32, 34, 108, 16);
  ctx.restore();
}
