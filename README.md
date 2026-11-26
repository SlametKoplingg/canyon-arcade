# Canyon Arcade

An arcade ring-chase through a desert canyon, built for the make.fun
`best-flight-game-20261126-0057` competition ($500, top 50 share).

Fly low. Thread 30 golden rings in order to the runway at the end of the
canyon. Godzilla wades the river at the first bend; Ultraman watches from a
ledge at the second. The canyon is not polite:

- **Birds** cross the canyon in flocks. A hit costs 12% airframe integrity
  and knocks the plane sideways.
- **Wing malfunction** strikes every 22–38 seconds: steering drops to 38%
  for 4 seconds, with an alarm and a flashing red banner.
- **One part falls off every minute** — wingtip, tail fin, cowling, panel.
  Each costs 20% integrity. At 0% the plane is a skeleton and the flight
  ends. Finish before the 150-second clock runs out, or the canyon keeps you.

## Play

Open `game/index.html` in a desktop browser, or run the local server:

```sh
node serve.ts
# then open http://127.0.0.1:8080/
```

- **Arrows / WASD** — steer and climb
- **Shift** — boost
- **Space / Enter** — start, restart
- **P / Esc** — pause
- **M** — mute
- **Mouse** — move to steer, click to boost

## How it is built

Vanilla JavaScript and Canvas, no libraries, no CDN, no network requests.
All art is drawn in code (the plane, the giants, the birds, the canyon);
all sound is synthesised with WebAudio.

- `game/src/config.js` — course, plane, hazard and palette constants
- `game/src/random.js` — seeded RNG (the course is deterministic per seed)
- `game/src/track.js` — the canyon ribbon: bends, hills, rings, giants
- `game/src/world.js` — the flight model: rings, birds, wing errors, part loss
- `game/src/sprites.js` — every drawing: plane, Godzilla, Ultraman, birds, rings
- `game/src/render.js` — the pseudo-3D chase view, HUD, screens
- `game/src/shots.js` — the four screenshot scenes (real flights, staged)
- `game/src/main.js` — the game loop, input, screens, `?shot=` mode
- `game/src/audio.js` — WebAudio engine, alarms, chimes
- `game/src/input.js` — keyboard + mouse

`main.ts` copies the game and its screenshots into the submission output
and writes `dossier.json`. `serve.ts` is a stdlib static server for local
testing only.
