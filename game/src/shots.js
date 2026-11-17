// Screenshot scenes behind ?shot=start|play|end. Each stages the real game state
// deterministically from the seeded world, so the same seed always gives the same frame:
// start = the title over a busy downtown junction, play = a three-star chase mid-mission,
// end = the victory screen at the harbour hideout.
import { STEP } from './config.js';
import { POIS } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const IDLE = { mx: 0, my: 0, run: false, interact: false, melee: false, shoot: false, aim: 0, handbrake: false };

function snapCamera(world, x, y) {
  world.state.camera.x = x;
  world.state.camera.y = y;
}

function crowdAround(world, cx, cy) {
  const s = world.state;
  // extra pedestrians on the sidewalks near the camera
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    s.peds.push({
      x: cx + Math.cos(a) * (120 + (i % 3) * 60), y: cy + Math.sin(a) * (120 + (i % 3) * 60),
      angle: a + Math.PI / 2, speed: 50, color: ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#fd79a8'][i % 5],
      skin: '#f2c79b', axis: 'x', laneC: cy, side: 1, s: 0, hp: 30, state: 'walk', fleeT: 0, downT: 0, phase: i * 1.3,
    });
  }
}

export function stageShot(name, world) {
  const s = world.state;
  world.newGame();

  if (name === 'play') {
    world.setMission(2); // PACKAGE RUN
    s.bannerT = 0; s.subT = 5.5; s.money = 875;
    s.player.hp = 82;
    // put the player in the starter car at a central junction, rolling north
    const car = s.cars.find((c) => c.driver === 'parked' && !c.target);
    const px = 2025; const py = 1700;
    if (car) {
      car.x = px; car.y = py; car.angle = -Math.PI / 2; car.speed = 190; car.driver = 'player';
      s.player.car = car;
    }
    s.player.x = px; s.player.y = py; s.player.angle = -Math.PI / 2;
    snapCamera(world, px, py - 60);
    // three stars and two cruisers on the tail
    s.wantedPoints = 262; s.crimeT = 0;
    world.spawnCopAt(px - 130, py + 250);
    world.spawnCopAt(px + 150, py + 330);
    crowdAround(world, px, py - 120);
    for (let i = 0; i < 90; i += 1) world.step(STEP, { ...IDLE, my: -1 });
    snapCamera(world, s.player.x, s.player.y);
    return { screen: SCREEN_PLAY, hasSave: false };
  }

  if (name === 'end') {
    s.money = 5860; s.carsStolen = 6; s.shotsFired = 47;
    s.missionIndex = 4;
    s.player.x = POIS.hideout.x + 60; s.player.y = POIS.hideout.y - 40;
    snapCamera(world, s.player.x, s.player.y - 80);
    crowdAround(world, s.player.x, s.player.y);
    for (let i = 0; i < 120; i += 1) world.stepAmbient(STEP);
    s.over = 'win';
    return { screen: SCREEN_WIN, hasSave: false };
  }

  // start: title over the Central Park junction, traffic flowing
  s.player.x = 2025; s.player.y = 2090;
  snapCamera(world, 2025, 1960);
  crowdAround(world, 2025, 1960);
  for (let i = 0; i < 240; i += 1) world.stepAmbient(STEP);
  snapCamera(world, 2025, 1960);
  s.bannerT = 0; s.subT = 0; s.msgT = 0;
  return { screen: SCREEN_TITLE, hasSave: true };
}

export { SCREEN_OVER };
