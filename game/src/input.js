// Keyboard and mouse input. Held keys give a movement vector; one-shot presses (confirm,
// pause, interact) are queued as flags and taken once by the loop. The mouse position is kept
// in canvas pixels so the game can aim from the screen centre (where the camera puts the player).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_NEWGAME = 8;
export const ACTION_MUTE = 16;

const KEYS = {
  left: new Set(['ArrowLeft', 'KeyA']),
  right: new Set(['ArrowRight', 'KeyD']),
  up: new Set(['ArrowUp', 'KeyW']),
  down: new Set(['ArrowDown', 'KeyS']),
  run: new Set(['ShiftLeft', 'ShiftRight']),
  brake: new Set(['Space']),
  interact: new Set(['KeyE', 'KeyF']),
  melee: new Set(['KeyJ', 'KeyQ']),
  confirm: new Set(['Enter']),
  pause: new Set(['KeyP', 'Escape']),
  newgame: new Set(['KeyN']),
  mute: new Set(['KeyM']),
};

export function createInput(target) {
  const held = { left: false, right: false, up: false, down: false, run: false, brake: false, melee: false };
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  function bucket(code) {
    for (const name of Object.keys(KEYS)) if (KEYS[name].has(code)) return name;
    return null;
  }

  window.addEventListener('keydown', (event) => {
    const name = bucket(event.code);
    if (!name) return;
    if (name === 'newgame') { if (!event.repeat) actions |= ACTION_NEWGAME; }
    else if (name === 'mute') { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (name === 'confirm') { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (name === 'pause') { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (name === 'interact') { if (!event.repeat) actions |= ACTION_INTERACT; }
    else held[name] = true;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const name = bucket(event.code);
    if (name && held[name] !== undefined) held[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouse.down = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  target.addEventListener('pointerdown', (event) => {
    if (event.button === 0) { mouse.down = true; actions |= ACTION_CONFIRM; }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Movement vector: mx is steer on foot/in car, my is forward(-1)/back(+1) screen-style. */
    vector() {
      return {
        mx: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        my: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    run() { return held.run; },
    brake() { return held.brake; },
    melee() { return held.melee || held.brake; },
    mouse,
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
