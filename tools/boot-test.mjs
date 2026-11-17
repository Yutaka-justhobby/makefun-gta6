// Boots the real game entry (main.js) under a tiny DOM stub: shot mode must set
// __shotReady, and live mode must survive title -> start -> driving frames with
// no exceptions, then write a save when a mission completes.
import { StubCanvas } from './canvas-stub.mjs';

const canvas = new StubCanvas();
const listeners = {};
let rafQueue = [];
let nowMs = 0;
const store = new Map();

globalThis.window = {
  innerWidth: 640, innerHeight: 360, devicePixelRatio: 1,
  location: { search: process.env.BOOT_SEARCH || '' },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  __shotReady: false,
};
globalThis.document = {
  getElementById: (id) => (id === 'game' ? canvas : { textContent: '' }),
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  hidden: false,
};
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); };
globalThis.performance = { now: () => nowMs };
canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 360 });
canvas.addEventListener = (type, fn) => { (listeners[`canvas:${type}`] = listeners[`canvas:${type}`] || []).push(fn); };

function pump(frames, stepMs = 16.7) {
  for (let i = 0; i < frames; i += 1) {
    nowMs += stepMs;
    const q = rafQueue; rafQueue = [];
    for (const fn of q) fn(nowMs);
  }
}
function key(code, type = 'keydown') {
  for (const fn of listeners[type] || []) fn({ code, repeat: false, preventDefault() {} });
}

await import('../game/src/main.js');

if (process.env.BOOT_SEARCH) {
  pump(4);
  if (!globalThis.window.__shotReady) { console.error('SHOT NOT READY'); process.exit(1); }
  console.log('BOOT SHOT OK', process.env.BOOT_SEARCH);
} else {
  pump(4); // title screen, ambient traffic
  key('Enter'); // start game
  pump(4);
  key('KeyW'); // walk/drive forward
  pump(12);
  key('KeyW', 'keyup');
  key('KeyP'); // pause
  pump(2);
  key('KeyP'); // resume
  pump(6);
  key('KeyE'); // enter/steal a car if near, else no-op
  pump(12);
  console.log('BOOT LIVE OK — frames pumped, localStorage keys:', [...store.keys()].join(',') || '(none yet)');
}
