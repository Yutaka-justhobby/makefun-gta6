// NEON HARBOR — boot and the one loop. The world advances in fixed 1/60 s steps; screens are
// title, play, paused, game over (wasted / busted) and victory. Progress (mission + cash) is
// saved to localStorage whenever a mission boundary is crossed.
//
// ?seed=N fixes the city. ?shot=start|play|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { SAVE_KEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_NEWGAME, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const state = world.state;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.missionIndex !== 'number' || typeof data.money !== 'number') return null;
    return data;
  } catch { return null; }
}

function writeSave() {
  try {
    if (state.over === 'win') window.localStorage.removeItem(SAVE_KEY);
    else window.localStorage.setItem(SAVE_KEY, JSON.stringify({ missionIndex: state.missionIndex, money: state.money }));
  } catch { /* storage can be off: progress then lasts this visit only */ }
}

function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, { hasSave: scene.hasSave });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  // the audio context may only start from a user gesture: unlock on any key or click
  window.addEventListener('keydown', () => audio.unlock());
  canvas.addEventListener('pointerdown', () => audio.unlock());
  let screen = SCREEN_TITLE;
  let save = readSave();
  let hasSave = !!(save && (save.missionIndex > 0 || save.money > 0));
  let accumulator = 0;
  let last = performance.now();
  let overSince = -1;

  world.newGame();
  state.bannerT = 0; state.subT = 0; // the title panel speaks for itself

  function announce(message) { status.textContent = message; }

  function startFresh() {
    clearSave();
    hasSave = false;
    world.newGame();
    screen = SCREEN_PLAY;
    overSince = -1;
    syncWatch();
    audio.click();
    announce('New game. Mission 1: reach Vince\'s garage.');
  }

  function startContinue() {
    world.loadProgress(save.missionIndex, save.money);
    screen = SCREEN_PLAY;
    overSince = -1;
    syncWatch();
    audio.click();
    announce(`Continuing at mission ${save.missionIndex + 1}.`);
  }

  function buildStepInput(actions) {
    const v = input.vector();
    const p = state.player;
    const rect = canvas.getBoundingClientRect();
    const logX = ((input.mouse.x) / Math.max(1, rect.width)) * VIEW.width;
    const logY = ((input.mouse.y) / Math.max(1, rect.height)) * VIEW.height;
    const aim = Math.atan2(logY - VIEW.height / 2, logX - VIEW.width / 2);
    return {
      mx: v.mx,
      my: v.my,
      run: input.run(),
      interact: !!(actions & ACTION_INTERACT),
      melee: !p.car && input.melee(),
      shoot: !p.car && input.mouse.down,
      aim,
      handbrake: !!p.car && input.brake(),
    };
  }

  // ---- sound: watch the world state each frame and play what changed ----
  const prev = { shots: 0, meleeT: 0, car: null, shake: 0, packages: 0, mission: 0, stars: 0, over: null };
  function syncWatch() {
    const p = state.player;
    prev.shots = state.shotsFired; prev.meleeT = p.meleeT; prev.car = p.car; prev.shake = state.shake;
    prev.packages = state.packagesGot; prev.mission = state.missionIndex; prev.stars = state.stars; prev.over = state.over;
  }
  function watchAudio() {
    const p = state.player;
    if (state.shotsFired > prev.shots) audio.gunshot();
    if (p.meleeT > prev.meleeT && p.meleeT > 0.3) audio.punch();
    if (p.car !== prev.car) audio.door();
    if (state.shake - prev.shake > 1.5) audio.thud((state.shake - prev.shake) / 6);
    if (state.packagesGot > prev.packages) audio.pickup();
    if (state.missionIndex > prev.mission) audio.jingle();
    if (state.stars > prev.stars) audio.alert();
    if (state.over !== prev.over && state.over) {
      if (state.over === 'win') audio.jingle();
      else audio.sting(state.over);
    }
    syncWatch();
    // looping voices: engine follows your car, the siren follows the nearest cruiser
    if (screen === SCREEN_PLAY && p.car && !state.over) {
      audio.setEngine(true, Math.abs(p.car.speed) / 430);
    } else audio.setEngine(false, 0);
    let sirenLevel = 0;
    if (screen === SCREEN_PLAY && state.stars > 0 && !state.over) {
      let nearest = Infinity;
      for (const c of state.cars) {
        if (c.police && !c.dead) nearest = Math.min(nearest, Math.hypot(c.x - p.x, c.y - p.y));
      }
      if (nearest < 560) sirenLevel = 1 - nearest / 700;
    }
    audio.setSiren(sirenLevel);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) announce(audio.toggleMute() ? 'Sound off.' : 'Sound on.');
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_NEWGAME) startFresh();
      else if (actions & ACTION_CONFIRM) { if (hasSave) startContinue(); else startFresh(); }
      return 0;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if ((actions & ACTION_CONFIRM) && overSince > 0.6) {
        audio.click();
        if (screen === SCREEN_WIN) startFresh();
        else { world.retryMission(); screen = SCREEN_PLAY; overSince = -1; syncWatch(); announce('Back on the street.'); }
      }
      return 0;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
      return actions;
    }
    if (screen === SCREEN_PAUSED && (actions & ACTION_CONFIRM)) screen = SCREEN_PLAY;
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();

    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) { world.stepAmbient(STEP); accumulator -= STEP; }
    } else if (screen === SCREEN_PLAY) {
      const stepInput = buildStepInput(actions);
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        world.step(STEP, first ? stepInput : { ...stepInput, interact: false });
        first = false;
        accumulator -= STEP;
        if (state.over) {
          screen = state.over === 'win' ? SCREEN_WIN : SCREEN_OVER;
          overSince = 0;
          if (state.saveDirty) { writeSave(); state.saveDirty = false; save = readSave(); }
          announce(screen === SCREEN_WIN ? 'You beat the game.' : state.over === 'busted' ? 'Busted.' : 'Wasted.');
          break;
        }
      }
      if (state.saveDirty) {
        writeSave();
        state.saveDirty = false;
        save = readSave();
        hasSave = !!(save && (save.missionIndex > 0 || save.money > 0));
      }
    } else {
      if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
        overSince += Math.min(0.05, accumulator);
        // the world keeps breathing behind the panels
        while (accumulator >= STEP) { world.stepAmbient(STEP); accumulator -= STEP; }
      } else accumulator = 0;
    }
    watchAudio();
    renderer.draw(state, screen, { hasSave });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Harbor. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
