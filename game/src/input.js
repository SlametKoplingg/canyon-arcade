// Canyon Arcade — keyboard and mouse input. Held keys give steering and climb;
// one-shot presses (start, restart, pause) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.
// Holding Shift or the mouse boosts the throttle.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const BOOST = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let boostKey = false;
  let boostMouse = false;
  let mouseX = 0;
  let mouseActive = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (BOOST.has(event.code)) boostKey = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (BOOST.has(event.code)) boostKey = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    boostKey = false;
    boostMouse = false;
    mouseActive = false;
  });

  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    boostMouse = true;
    mouseActive = true;
    mouseX = event.clientX / window.innerWidth;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX / window.innerWidth;
    mouseActive = true;
  });
  target.addEventListener('pointerup', () => {
    boostMouse = false;
  });
  target.addEventListener('pointerleave', () => {
    mouseActive = false;
    boostMouse = false;
  });

  return {
    /**
     * Steering this frame: -1 (full left) to 1 (full right). The mouse steers
     * toward its x position when no arrow key is held.
     */
    steer() {
      const keys = (right ? 1 : 0) - (left ? 1 : 0);
      if (keys !== 0) return keys;
      if (mouseActive) return Math.max(-1, Math.min(1, (mouseX - 0.5) * 2.4));
      return 0;
    },
    /** Climb this frame: 1 is up, -1 is down. */
    climb() {
      return (up ? 1 : 0) - (down ? 1 : 0);
    },
    /** True while Shift or the mouse button is held. */
    boost() {
      return boostKey || boostMouse;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
