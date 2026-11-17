import { createWorld, MISSIONS, POIS } from '../game/src/world.js';
import { createRandom } from '../game/src/random.js';
import { STEP } from '../game/src/config.js';

const world = createWorld(createRandom(1));
const s = world.state;
world.newGame();
const IDLE = { mx: 0, my: 0, run: false, interact: false, melee: false, shoot: false, aim: 0, handbrake: false };
let steps = 0;
function run(n, input = IDLE) { for (let i = 0; i < n; i++) { world.step(STEP, input); steps++; if (s.over) break; } }
function clearHeat(){ s.wantedPoints=0; s.stars=0; s.bustedT=0; s.cars=s.cars.filter(c=>!c.police); s.officers.length=0; }
function teleport(x, y) { s.player.x = x; s.player.y = y; if (s.player.car) { s.player.car.x = x; s.player.car.y = y; } s.camera.x = x; s.camera.y = y; }

console.log('city:', s.buildings.length, 'buildings,', s.parks.length, 'parks,', s.trees.length, 'trees,', s.cars.length, 'cars,', s.peds.length, 'peds');
run(600); // 10s idle ambient play
console.log('after idle: cars', s.cars.length, 'peds', s.peds.length, 'player hp', s.player.hp, 'over', s.over);

// drive the starter car
const car = s.cars.find(c => c.driver === 'parked');
teleport(car.x + 10, car.y);
world.step(STEP, { ...IDLE, interact: true });
console.log('in car:', !!s.player.car, 'stars', s.stars);
run(300, { ...IDLE, my: -1 }); // accelerate 5s
console.log('driving: speed', Math.round(s.player.car?.speed ?? -1), 'pos', Math.round(s.player.x), Math.round(s.player.y), 'over', s.over);
world.step(STEP, { ...IDLE, interact: true }); // exit (only if still in car)
run(60);

// Mission 1: goto garage
clearHeat();
teleport(POIS.garage.x, POIS.garage.y);
run(30);
console.log('mission now:', s.missionIndex, 'money', s.money);

// Mission 2: steal
const tc = s.targetCar;
console.log('target car at', tc && Math.round(tc.x), tc && Math.round(tc.y));
teleport(tc.x + 10, tc.y);
if (s.player.car) world.step(STEP, { ...IDLE, interact: true });
world.step(STEP, { ...IDLE, interact: true });
console.log('stole target:', s.player.car === tc, 'phase', s.missionPhase);
clearHeat();
teleport(POIS.garage.x, POIS.garage.y);
run(30);
console.log('mission now:', s.missionIndex, 'money', s.money, 'stars', s.stars);

// Mission 3: collect — exit car, teleport to each package then docks
if (s.player.car) world.step(STEP, { ...IDLE, interact: true });
for (const pk of s.pickups.filter(p => p.kind === 'package')) { teleport(pk.x, pk.y); run(10); }
console.log('packages got:', s.packagesGot, 'phase', s.missionPhase);
clearHeat();
teleport(POIS.docks.x, POIS.docks.y);
run(30);
console.log('mission now:', s.missionIndex, 'money', s.money);

// Mission 4: ambush
teleport(POIS.park.x, POIS.park.y);
run(30);
console.log('ambush phase', s.missionPhase, 'enemies', s.enemies.length);
for (const e of s.enemies) e.hp = 0; // test-only: simulate winning the fight
run(30);
console.log('ambush phase after kills', s.missionPhase, 'stars', s.stars, 'wanted', Math.round(s.wantedPoints));
s.wantedPoints = 0; // simulate a clean escape
run(30);
console.log('mission now:', s.missionIndex, 'money', s.money);

// Mission 5: heist
clearHeat();
teleport(POIS.bank.x, POIS.bank.y);
run(200); // channel 2.5s while guards attack
console.log('heist phase', s.missionPhase, 'channel', s.channelT?.toFixed(2), 'hp', Math.round(s.player.hp), 'over', s.over);
for (const e of s.enemies) e.hp = 0;
if (!s.over) {
  teleport(POIS.hideout.x, POIS.hideout.y);
  run(30);
}
console.log('FINAL: over =', s.over, 'money', s.money, 'mission', s.missionIndex);
console.log('total steps simulated:', steps);
if (s.over !== 'win') { console.error('EXPECTED WIN'); process.exit(1); }
console.log('SIMTEST PASS');
