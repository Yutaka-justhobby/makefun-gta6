// NEON HARBOR — world simulation: a 3600x3600 city with a road grid, buildings, parks and a
// harbour; traffic, pedestrians, police, gangs, carjacking, a wanted system and a five-mission
// story. No drawing and no browser APIs in here: step(dt, input) advances everything and the
// renderer reads `state`.
import { BUILDING_COLORS, CAR, CAR_COLORS, CITY, PED_COLORS, PLAYER, SIGNS } from './config.js';

export const roadCenter = (i) => 225 + i * CITY.pitch;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

export const POIS = {
  garage: { x: roadCenter(5), y: roadCenter(0) },
  stealCar: { x: roadCenter(2), y: roadCenter(6) },
  docks: { x: roadCenter(7), y: 3320 },
  park: { x: roadCenter(4), y: roadCenter(4) },
  bank: { x: roadCenter(1), y: roadCenter(3) },
  hideout: { x: roadCenter(0), y: 3320 },
  hospital: { x: roadCenter(3), y: roadCenter(1) },
  start: { x: roadCenter(1), y: roadCenter(2) },
};

export const MISSIONS = [
  {
    title: 'FIRST WHEELS', type: 'goto', reward: 150,
    intro: 'Vince: "New in Neon Harbor, kid? Get to my garage up north. We talk business there."',
    objective: 'Reach Vince\'s garage',
    target: POIS.garage,
  },
  {
    title: 'BORROWED RIDE', type: 'steal', reward: 400,
    intro: 'Vince: "A collector owes me. His red sports car sits by the south-west marina. Borrow it. Bring it here."',
    objective: 'Steal the marked sports car',
    target: POIS.stealCar,
  },
  {
    title: 'PACKAGE RUN', type: 'collect', reward: 650,
    intro: 'Vince: "Three packages got scattered across town. Pick them all up, drop them at the docks."',
    objective: 'Collect the packages (0/3)',
    target: null,
  },
  {
    title: 'AMBUSH', type: 'ambush', reward: 900,
    intro: 'Vince: "The Vultures gang wants a word in Central Park. Bad word. Go armed — then lose the heat."',
    objective: 'Meet the Vultures in Central Park',
    target: POIS.park,
  },
  {
    title: 'THE BIG SCORE', type: 'heist', reward: 2500,
    intro: 'Vince: "Last job. City Bank, west side. Grab the vault cash and vanish to the old hideout. Make us rich."',
    objective: 'Go to City Bank',
    target: POIS.bank,
  },
];

const PACKAGE_SPOTS = [
  { x: roadCenter(0), y: roadCenter(4) },
  { x: roadCenter(3), y: roadCenter(1) },
  { x: roadCenter(6), y: roadCenter(3) },
];

const PARK_BLOCKS = new Set(['3,3', '1,5', '5,5']);

export function createWorld(random) {
  const state = {
    time: 0,
    buildings: [], parks: [], trees: [], props: [], lights: [],
    cars: [], peds: [], officers: [], enemies: [], bullets: [], effects: [], pickups: [],
    player: null, camera: { x: 0, y: 0 },
    wantedPoints: 0, stars: 0, seenByCop: false, crimeT: 99, bustedT: 0,
    money: 0, missionIndex: 0, missionPhase: 0, packagesGot: 0, channelT: 0,
    objective: '', marker: null, msg: '', msgT: 0, banner: '', bannerT: 0, sub: '',
    over: null, overT: 0, saveDirty: false, shake: 0, shotsFired: 0, carsStolen: 0,
  };

  // ---------- city generation ----------
  function genCity() {
    state.buildings.length = 0; state.parks.length = 0; state.trees.length = 0; state.props.length = 0; state.lights.length = 0;
    let signIdx = Math.floor(random() * SIGNS.length);
    for (let bx = 0; bx < CITY.roads - 1; bx += 1) {
      for (let by = 0; by < CITY.roads - 1; by += 1) {
        const x0 = roadCenter(bx) + CITY.roadWidth / 2 + 14;
        const y0 = roadCenter(by) + CITY.roadWidth / 2 + 14;
        const size = CITY.pitch - CITY.roadWidth - 28;
        if (PARK_BLOCKS.has(`${bx},${by}`)) {
          state.parks.push({ x: x0, y: y0, w: size, h: size });
          for (let t = 0; t < 14; t += 1) {
            state.trees.push({ x: x0 + 20 + random() * (size - 40), y: y0 + 20 + random() * (size - 40), r: 12 + random() * 10 });
          }
          continue;
        }
        const lots = random() < 0.45 ? 1 : 4;
        const cols = lots === 1 ? 1 : 2;
        const lotW = size / cols;
        for (let lx = 0; lx < cols; lx += 1) {
          for (let ly = 0; ly < cols; ly += 1) {
            const inset = 6 + random() * 10;
            const bw = lotW - inset * 2;
            const bh = lotW - inset * 2;
            const color = BUILDING_COLORS[Math.floor(random() * BUILDING_COLORS.length)];
            const sign = SIGNS[signIdx % SIGNS.length]; signIdx += 1 + Math.floor(random() * 3);
            state.buildings.push({
              x: x0 + lx * lotW + inset, y: y0 + ly * lotW + inset, w: bw, h: bh,
              color, sign, floors: 2 + Math.floor(random() * 9),
              shade: 0.82 + random() * 0.36,
              ac: Array.from({ length: 1 + Math.floor(random() * 3) }, () => ({
                dx: random() * 0.7 + 0.1, dy: random() * 0.7 + 0.1, s: 12 + random() * 16,
              })),
              tower: random() < 0.3,
            });
          }
        }
        // street trees along the block's sidewalk
        for (let t = 0; t < 4; t += 1) {
          const side = Math.floor(random() * 4);
          const along = random() * size;
          state.trees.push({
            x: side === 0 ? x0 + along : side === 1 ? x0 + along : x0 - 8 + (side === 2 ? 0 : size + 16),
            y: side === 0 ? y0 - 8 : side === 1 ? y0 + size + 8 : y0 + along,
            r: 9 + random() * 6,
          });
        }
        if (random() < 0.7) state.props.push({ x: x0 + random() * size, y: y0 - 4, kind: 'dumpster' });
      }
    }
    for (let i = 0; i < CITY.roads; i += 1) {
      for (let j = 0; j < CITY.roads; j += 1) {
        state.lights.push({ x: roadCenter(i), y: roadCenter(j), phase: (i + j) % 2 });
      }
    }
    // pier props at the harbour
    for (let i = 0; i < 9; i += 1) state.props.push({ x: 200 + i * 400 + random() * 60, y: 3408, kind: 'crate' });
  }

  function buildingAt(x, y, pad) {
    for (const b of state.buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  }

  /** Push a circle out of every building; returns impact speed absorbed (0 when none). */
  function collideBuildings(e, r) {
    let hit = 0;
    for (const b of state.buildings) {
      const nx = clamp(e.x, b.x, b.x + b.w);
      const ny = clamp(e.y, b.y, b.y + b.h);
      const d2 = (e.x - nx) ** 2 + (e.y - ny) ** 2;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        if (d2 > 0.01) { e.x = nx + ((e.x - nx) / d) * r; e.y = ny + ((e.y - ny) / d) * r; }
        else { e.x = b.x - r; }
        hit = 1;
      }
    }
    e.x = clamp(e.x, 16, CITY.size - 16);
    e.y = clamp(e.y, 16, CITY.waterY + 30);
    return hit;
  }

  // ---------- entities ----------
  function makeCar(x, y, opts = {}) {
    const type = opts.type || ['sedan', 'sedan', 'hatch', 'taxi', 'van', 'sports', 'truck'][Math.floor(random() * 7)];
    const car = {
      x, y, angle: opts.angle || 0, speed: 0, steerVis: 0,
      color: opts.color || (type === 'taxi' ? '#f2b035' : CAR_COLORS[Math.floor(random() * CAR_COLORS.length)]),
      type, hp: CAR.maxHp, police: !!opts.police, driver: opts.driver || 'parked',
      axis: opts.axis || 'x', dir: opts.dir || 1, lane: opts.lane ?? 0, decidedAt: -1,
      cruise: 120 + random() * 90, wobble: random() * Math.PI * 2, officerT: 2 + random() * 3,
      target: !!opts.target, dead: false,
    };
    if (car.police) { car.color = '#eef1f5'; car.type = 'cop'; car.cruise = 330; }
    return car;
  }

  function lanePos(car) {
    // right-hand traffic: lane offset from the road centreline
    const off = 29;
    if (car.axis === 'x') return { x: car.s, y: car.lane + (car.dir > 0 ? off : -off) };
    return { x: car.lane + (car.dir > 0 ? -off : off), y: car.s };
  }

  function spawnTraffic() {
    for (let i = 0; i < 26; i += 1) {
      const axis = random() < 0.5 ? 'x' : 'y';
      const lane = roadCenter(Math.floor(random() * CITY.roads));
      const dir = random() < 0.5 ? 1 : -1;
      const car = makeCar(0, 0, { driver: 'traffic', axis, dir, lane });
      car.s = 200 + random() * 3200;
      const p = lanePos(car); car.x = p.x; car.y = p.y;
      car.angle = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.speed = car.cruise;
      state.cars.push(car);
    }
    // parked cars along kerbs — stealable
    for (let i = 0; i < 16; i += 1) {
      const axis = random() < 0.5 ? 'x' : 'y';
      const c = roadCenter(Math.floor(random() * CITY.roads));
      const along = 120 + random() * 3300;
      const side = random() < 0.5 ? 1 : -1;
      const car = makeCar(
        axis === 'x' ? along : c + side * 46,
        axis === 'x' ? c + side * 46 : along,
        { driver: 'parked', angle: axis === 'x' ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2) },
      );
      if (!buildingAt(car.x, car.y, 26)) state.cars.push(car);
    }
  }

  function spawnPeds() {
    for (let i = 0; i < 42; i += 1) {
      const axis = random() < 0.5 ? 'x' : 'y';
      const c = roadCenter(Math.floor(random() * CITY.roads));
      const side = random() < 0.5 ? 1 : -1;
      state.peds.push({
        x: axis === 'x' ? 100 + random() * 3400 : c + side * 76,
        y: axis === 'x' ? c + side * 76 : 100 + random() * 3400,
        angle: random() * Math.PI * 2, speed: 46 + random() * 40,
        color: PED_COLORS[Math.floor(random() * PED_COLORS.length)],
        skin: ['#f2c79b', '#c68863', '#8d5524', '#ffdbac'][Math.floor(random() * 4)],
        axis, laneC: c, side, s: 0, hp: 30, state: 'walk', fleeT: 0, downT: 0, phase: random() * 9,
      });
      const p = state.peds[state.peds.length - 1];
      p.s = axis === 'x' ? p.x : p.y;
    }
  }

  function resetPlayer(x, y) {
    state.player = {
      x, y, angle: -Math.PI / 2, hp: PLAYER.maxHp, car: null,
      shotT: 0, meleeT: 0, speedNow: 0, walkPhase: 0, channeling: false,
    };
  }

  // ---------- missions ----------
  function setMission(i) {
    state.missionIndex = i;
    state.missionPhase = 0;
    state.packagesGot = 0;
    state.channelT = 0;
    const m = MISSIONS[i];
    if (!m) { state.objective = ''; state.marker = null; return; }
    state.banner = `MISSION ${i + 1} — ${m.title}`;
    state.bannerT = 4.2;
    state.sub = m.intro;
    state.subT = 7;
    if (m.type === 'collect') {
      state.pickups = PACKAGE_SPOTS.map((p) => ({ x: p.x, y: p.y, kind: 'package', taken: false }));
      state.marker = { ...state.pickups[0], label: 'PACKAGE' };
      state.objective = 'Collect the packages (0/3)';
    } else {
      state.marker = { ...m.target, label: m.title };
      state.objective = m.objective;
    }
    if (m.type === 'steal') {
      const car = makeCar(POIS.stealCar.x + 20, POIS.stealCar.y - 46, { type: 'sports', color: '#e01b2f', driver: 'parked', target: true, angle: 0 });
      state.cars.push(car);
      state.targetCar = car;
    }
    state.saveDirty = true;
  }

  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    state.money += m.reward;
    toast(`Mission complete  +$${m.reward}`);
    addEffect(state.player.x, state.player.y - 30, 'good', `+$${m.reward}`);
    if (state.missionIndex + 1 >= MISSIONS.length) {
      state.over = 'win';
      state.overT = 0;
      state.saveDirty = true;
      return;
    }
    setMission(state.missionIndex + 1);
  }

  function toast(text) { state.msg = text; state.msgT = 3.2; }
  function addEffect(x, y, color, text) { state.effects.push({ x, y, t: 0, life: 0.9, color, text: text || null, r: text ? 0 : 5 + random() * 5 }); }
  function crime(points) {
    state.wantedPoints = clamp(state.wantedPoints + points, 0, 500);
    state.crimeT = 0;
  }

  function newGame() {
    state.cars.length = 0; state.peds.length = 0; state.officers.length = 0;
    state.enemies.length = 0; state.bullets.length = 0; state.effects.length = 0; state.pickups = [];
    state.money = 0; state.wantedPoints = 0; state.stars = 0; state.bustedT = 0;
    state.over = null; state.overT = 0; state.targetCar = null;
    genCity();
    spawnTraffic();
    spawnPeds();
    resetPlayer(POIS.start.x, POIS.start.y + 70);
    state.camera.x = state.player.x; state.camera.y = state.player.y;
    // a starter car waits by the kerb
    state.cars.push(makeCar(POIS.start.x + 46, POIS.start.y + 20, { driver: 'parked', type: 'hatch', color: '#3d7ad9', angle: Math.PI / 2 }));
    setMission(0);
    state.bannerT = 4.2;
  }

  function retryMission() {
    state.over = null; state.overT = 0;
    state.wantedPoints = 0; state.stars = 0; state.bustedT = 0;
    state.enemies.length = 0; state.bullets.length = 0; state.officers.length = 0;
    state.cars = state.cars.filter((c) => !c.police);
    if (state.player.car) { state.player.car.driver = 'parked'; state.player.car = null; }
    resetPlayer(POIS.hospital.x, POIS.hospital.y + 70);
    state.money = Math.max(0, state.money - 100);
    const idx = state.missionIndex;
    if (MISSIONS[idx] && MISSIONS[idx].type === 'steal' && state.targetCar) {
      state.cars = state.cars.filter((c) => c !== state.targetCar);
      state.targetCar = null;
    }
    setMission(idx);
    toast('Back on the street. The job is still on.');
  }

  function loadProgress(missionIndex, money) {
    newGame();
    state.money = money | 0;
    if (missionIndex > 0 && missionIndex < MISSIONS.length) setMission(missionIndex);
  }

  // ---------- combat ----------
  function fireBullet(x, y, angle, from) {
    state.bullets.push({
      x, y, vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed,
      from, life: 0.55, dmg: from === 'player' ? PLAYER.bulletDamage : 7 + random() * 4,
    });
    addEffect(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, '#ffd83d', null);
  }

  function hurtPlayer(dmg) {
    const p = state.player;
    if (state.over) return;
    if (p.car) { p.car.hp -= dmg * 0.6; if (p.car.hp <= 0) wreckCar(p.car); p.hp -= dmg * 0.25; }
    else p.hp -= dmg;
    state.shake = Math.min(9, state.shake + 2.5);
    if (p.hp <= 0) { p.hp = 0; state.over = 'wasted'; state.overT = 0; }
  }

  function wreckCar(car) {
    car.dead = true; car.hp = 0; car.speed = 0;
    addEffect(car.x, car.y, '#ff8c3a', null);
    addEffect(car.x, car.y, '#555', 'WRECKED');
    if (state.player.car === car) {
      state.player.car = null;
      state.player.x = car.x + 34; state.player.y = car.y;
      hurtPlayer(6);
    }
    if (car.driver === 'traffic') car.driver = 'parked';
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0 || buildingAt(b.x, b.y, 0);
      if (!dead && b.from !== 'player') {
        const p = state.player;
        const target = p.car || p;
        const r = p.car ? CAR.radius : PLAYER.radius;
        if (dist2(b.x, b.y, target.x, target.y) < r * r) { hurtPlayer(b.dmg); dead = true; }
      }
      if (!dead && b.from === 'player') {
        for (const e of state.enemies) {
          if (e.hp > 0 && dist2(b.x, b.y, e.x, e.y) < 15 * 15) {
            e.hp -= b.dmg; e.flashT = 0.1; dead = true;
            addEffect(e.x, e.y - 14, '#ff5348', null);
            if (e.hp <= 0) { state.money += 40; addEffect(e.x, e.y - 24, 'good', '+$40'); }
            break;
          }
        }
        if (!dead) for (const o of state.officers) {
          if (o.hp > 0 && dist2(b.x, b.y, o.x, o.y) < 14 * 14) {
            o.hp -= b.dmg; dead = true; crime(90);
            if (o.hp <= 0) { o.state = 'down'; o.downT = 8; crime(60); }
            break;
          }
        }
        if (!dead) for (const pd of state.peds) {
          if (pd.state !== 'down' && dist2(b.x, b.y, pd.x, pd.y) < 12 * 12) {
            pd.hp -= b.dmg; dead = true; crime(110);
            if (pd.hp <= 0) { pd.state = 'down'; pd.downT = 9; state.money += 8; }
            break;
          }
        }
        if (!dead) for (const c of state.cars) {
          if (c !== state.player.car && !c.dead && dist2(b.x, b.y, c.x, c.y) < CAR.radius * CAR.radius) {
            c.hp -= b.dmg; dead = true;
            if (c.hp <= 0) wreckCar(c);
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  // ---------- player ----------
  function nearestCar(x, y, maxD) {
    let best = null; let bd = maxD * maxD;
    for (const c of state.cars) {
      if (c.dead) continue;
      const d = dist2(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    const wasTraffic = car.driver === 'traffic';
    car.driver = 'player'; car.speed = 0;
    p.car = car;
    state.carsStolen += car.target || wasTraffic || car.wasParked === false ? 1 : 0;
    if (wasTraffic) {
      // the driver bails out and runs
      state.peds.push({
        x: car.x + 30, y: car.y + 10, angle: random() * 6.28, speed: 120,
        color: PED_COLORS[Math.floor(random() * PED_COLORS.length)], skin: '#f2c79b',
        axis: 'x', laneC: 0, side: 1, s: 0, hp: 30, state: 'flee', fleeT: 3, downT: 0, phase: 0,
      });
    }
    const witnessed = state.officers.length > 0 || state.peds.some((pd) => dist2(pd.x, pd.y, p.x, p.y) < 230 * 230);
    if (!car.wasPlayers) crime(witnessed ? 55 : 18);
    if (car.target) toast('Got the car! Take it to Vince\'s garage.');
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    car.driver = 'parked'; car.wasPlayers = true; car.speed = 0;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 36;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 36;
    collideBuildings(p, PLAYER.radius);
    p.car = null;
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (p.shotT > 0) p.shotT -= dt;
    if (p.meleeT > 0) p.meleeT -= dt;

    if (input.interact) {
      if (p.car) exitCar();
      else {
        const car = nearestCar(p.x, p.y, 58);
        if (car) enterCar(car);
      }
    }

    if (p.car) {
      const car = p.car;
      const accel = 300;
      if (input.my < 0) car.speed += accel * dt * (car.speed < 0 ? 1.6 : 1);
      else if (input.my > 0) car.speed -= (car.speed > 10 ? 420 : 190) * dt;
      car.speed -= car.speed * 0.55 * dt;
      if (input.handbrake) car.speed -= car.speed * 2.4 * dt;
      const top = car.type === 'sports' ? 430 : car.type === 'cop' ? 400 : car.type === 'truck' || car.type === 'van' ? 265 : 345;
      car.speed = clamp(car.speed, -130, top);
      const steer = input.mx * 1.9 * clamp(car.speed / 120, -1, 1) * (Math.abs(car.speed) > 4 ? 1 : 0);
      car.angle += steer * dt * (car.speed < 0 ? -1 : 1);
      car.steerVis = input.mx;
      const px = car.x; const py = car.y;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.hitT = Math.max(0, (car.hitT || 0) - dt);
      if (collideBuildings(car, CAR.radius - 6)) {
        if (Math.abs(car.speed) > 130 && car.hitT <= 0) {
          car.hp -= 14; crime(15); state.shake = 6; car.hitT = 0.6;
          addEffect(car.x, car.y, '#ffb52e', null);
        }
        car.speed *= -0.25;
      }
      // car vs car
      for (const o of state.cars) {
        if (o === car || o.dead) continue;
        const d2 = dist2(car.x, car.y, o.x, o.y);
        if (d2 < 46 * 46 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (46 - d) / 2;
          const nx = (car.x - o.x) / d; const ny = (car.y - o.y) / d;
          car.x += nx * push; car.y += ny * push; o.x -= nx * push; o.y -= ny * push;
          if (Math.abs(car.speed) > 110 && car.hitT <= 0) {
            o.hp -= 12; car.hp -= 6; crime(25); state.shake = Math.max(state.shake, 4); car.hitT = 0.6;
            addEffect(o.x, o.y, '#ffb52e', null);
            if (o.hp <= 0) wreckCar(o);
            car.speed *= 0.55;
          }
          if (o.driver === 'traffic') { o.speed = Math.min(o.speed, 40); }
        }
      }
      // car vs people
      for (const pd of state.peds) {
        if (pd.state === 'down') continue;
        if (dist2(car.x, car.y, pd.x, pd.y) < 34 * 34 && Math.abs(car.speed) > 45) {
          pd.hp -= 40; pd.state = 'down'; pd.downT = 9; crime(120);
          state.money += 5; addEffect(pd.x, pd.y - 16, '#ff5348', null);
        }
      }
      for (const e of state.enemies) {
        if (e.hp > 0 && dist2(car.x, car.y, e.x, e.y) < 36 * 36 && Math.abs(car.speed) > 45) {
          e.hp -= 60; addEffect(e.x, e.y - 16, '#ff5348', null);
          if (e.hp <= 0) state.money += 40;
        }
      }
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      p.speedNow = Math.abs(car.speed);
      if (car.hp <= 0 && !car.dead) wreckCar(car);
      void px; void py;
    } else {
      const sp = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const mx = input.mx; const my = input.my;
      const len = Math.hypot(mx, my) || 1;
      const moving = mx !== 0 || my !== 0;
      if (moving) {
        p.x += (mx / len) * sp * dt * (mx !== 0 && my !== 0 ? 1 : 1);
        p.y += (my / len) * sp * dt;
        p.angle = Math.atan2(my, mx);
        p.walkPhase += dt * (input.run ? 13 : 9);
      }
      p.speedNow = moving ? sp : 0;
      collideBuildings(p, PLAYER.radius);
      // aim overrides facing while shooting
      if (input.shoot || input.melee) p.angle = input.aim;
      if (input.shoot && p.shotT <= 0) {
        p.shotT = PLAYER.shotCooldown;
        state.shotsFired += 1;
        fireBullet(p.x, p.y, input.aim + (random() - 0.5) * 0.03, 'player');
        crime(22);
        scarePeds(p.x, p.y, 240);
      }
      if (input.melee && p.meleeT <= 0) {
        p.meleeT = 0.38;
        const tx = p.x + Math.cos(input.aim) * PLAYER.meleeRange;
        const ty = p.y + Math.sin(input.aim) * PLAYER.meleeRange;
        addEffect(tx, ty, '#ffffff', null);
        for (const e of state.enemies) if (e.hp > 0 && dist2(tx, ty, e.x, e.y) < 30 * 30) { e.hp -= PLAYER.meleeDamage; e.flashT = 0.1; if (e.hp <= 0) state.money += 40; }
        for (const o of state.officers) if (o.hp > 0 && dist2(tx, ty, o.x, o.y) < 28 * 28) { o.hp -= PLAYER.meleeDamage; crime(80); if (o.hp <= 0) { o.state = 'down'; o.downT = 8; } }
        for (const pd of state.peds) if (pd.state !== 'down' && dist2(tx, ty, pd.x, pd.y) < 26 * 26) { pd.hp -= PLAYER.meleeDamage; crime(70); if (pd.hp <= 0) { pd.state = 'down'; pd.downT = 9; } else { pd.state = 'flee'; pd.fleeT = 3; pd.angle = Math.atan2(pd.y - p.y, pd.x - p.x); } }
      }
    }
  }

  function scarePeds(x, y, r) {
    for (const pd of state.peds) {
      if (pd.state === 'walk' && dist2(pd.x, pd.y, x, y) < r * r) {
        pd.state = 'flee'; pd.fleeT = 2 + random() * 2;
        pd.angle = Math.atan2(pd.y - y, pd.x - x);
      }
    }
  }

  // ---------- traffic & pedestrians ----------
  function lightGreenX() { return Math.floor(state.time / 5) % 2 === 0; }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.driver !== 'traffic' || car.dead) continue;
      // find car ahead in same lane
      let ahead = Infinity;
      for (const o of state.cars) {
        if (o === car || o.dead) continue;
        if (o.driver !== 'traffic' && o.driver !== 'player' && o.driver !== 'parked' && !o.police) continue;
        const along = car.axis === 'x' ? (o.x - car.x) * car.dir : (o.y - car.y) * car.dir;
        const cross = car.axis === 'x' ? Math.abs(o.y - car.y) : Math.abs(o.x - car.x);
        if (along > 0 && along < ahead && cross < 26) ahead = along;
      }
      let target = car.cruise;
      if (ahead < 95) target = Math.min(target, Math.max(0, (ahead - 55) * 2.2));
      // red light ahead?
      const sNow = car.axis === 'x' ? car.x : car.y;
      const nextJunction = roadCenter(Math.round((sNow + car.dir * 60 - 225) / CITY.pitch));
      const toJunction = (nextJunction - sNow) * car.dir;
      const greenForMe = car.axis === 'x' ? lightGreenX() : !lightGreenX();
      if (!greenForMe && toJunction > 0 && toJunction < 52) target = 0;
      car.speed += clamp(target - car.speed, -280 * dt, 150 * dt);
      if (car.speed < 0) car.speed = 0;
      car.s += car.speed * dt;
      // turn at junctions
      const nearest = roadCenter(Math.round(( (car.axis === 'x' ? car.x : car.y) - 225) / CITY.pitch));
      const alongNow = car.axis === 'x' ? car.x : car.y;
      if (Math.abs(alongNow - nearest) < 8 && car.decidedAt !== nearest + (car.axis === 'x' ? 100000 : 0)) {
        car.decidedAt = nearest + (car.axis === 'x' ? 100000 : 0);
        if (random() < 0.34) {
          const crossLane = car.axis === 'x' ? car.y : car.x;
          const newAxis = car.axis === 'x' ? 'y' : 'x';
          // snap: new lane is the junction road we're on; new s is our cross position
          car.axis = newAxis;
          car.lane = nearest;
          car.s = crossLane;
          if (random() < 0.5) car.dir = -car.dir;
        }
      }
      if (car.s > CITY.size - 60) { car.s = CITY.size - 60; car.dir = -1; }
      if (car.s < 60) { car.s = 60; car.dir = 1; }
      const p = lanePos(car);
      car.x = p.x; car.y = p.y;
      const targetAngle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.angle = targetAngle;
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    for (let i = state.peds.length - 1; i >= 0; i -= 1) {
      const pd = state.peds[i];
      if (pd.state === 'down') {
        pd.downT -= dt;
        if (pd.downT <= 0) state.peds.splice(i, 1);
        continue;
      }
      if (pd.state === 'flee') {
        pd.fleeT -= dt;
        pd.x += Math.cos(pd.angle) * 150 * dt;
        pd.y += Math.sin(pd.angle) * 150 * dt;
        collideBuildings(pd, 10);
        if (pd.fleeT <= 0) { pd.state = 'walk'; pd.axis = random() < 0.5 ? 'x' : 'y'; pd.laneC = roadCenter(clamp(Math.round(((pd.axis === 'x' ? pd.y : pd.x) - 225) / CITY.pitch), 0, 7)); pd.side = random() < 0.5 ? 1 : -1; }
        continue;
      }
      // stroll along a sidewalk: move along axis, occasionally switch at junctions
      const dirVec = pd.axis === 'x' ? { x: pd.side, y: 0 } : { x: 0, y: pd.side };
      pd.x += dirVec.x * pd.speed * dt;
      pd.y += dirVec.y * pd.speed * dt;
      pd.angle = Math.atan2(dirVec.y, dirVec.x);
      pd.phase += dt * 7;
      if (random() < dt * 0.12) {
        // turn onto a crossing sidewalk or reverse
        if (random() < 0.5) { pd.axis = pd.axis === 'x' ? 'y' : 'x'; pd.laneC = roadCenter(clamp(Math.round(((pd.axis === 'x' ? pd.y : pd.x) - 225) / CITY.pitch), 0, 7)); }
        else pd.side = -pd.side;
      }
      // keep on the sidewalk band of the current street
      if (pd.axis === 'x') pd.y += clamp((pd.laneC + pd.side * 76) - pd.y, -60 * dt, 60 * dt);
      else pd.x += clamp((pd.laneC + pd.side * 76) - pd.x, -60 * dt, 60 * dt);
      pd.x = clamp(pd.x, 20, CITY.size - 20); pd.y = clamp(pd.y, 20, CITY.waterY + 20);
      if (buildingAt(pd.x, pd.y, 4)) { pd.side = -pd.side; pd.x += dirVec.x * -8; pd.y += dirVec.y * -8; }
      // flee from a fast nearby car
      const threat = p.car && Math.abs(p.car.speed) > 150 && dist2(pd.x, pd.y, p.x, p.y) < 110 * 110;
      if (threat) { pd.state = 'flee'; pd.fleeT = 1.6; pd.angle = Math.atan2(pd.y - p.y, pd.x - p.x); }
    }
    // keep the streets populated near the player
    if (state.peds.length < 34 && random() < dt * 0.7) {
      const a = random() * Math.PI * 2; const d = 480 + random() * 120;
      const x = clamp(p.x + Math.cos(a) * d, 30, CITY.size - 30);
      const y = clamp(p.y + Math.sin(a) * d, 30, CITY.waterY);
      if (!buildingAt(x, y, 6)) state.peds.push({
        x, y, angle: random() * 6.28, speed: 46 + random() * 40,
        color: PED_COLORS[Math.floor(random() * PED_COLORS.length)],
        skin: ['#f2c79b', '#c68863', '#8d5524', '#ffdbac'][Math.floor(random() * 4)],
        axis: random() < 0.5 ? 'x' : 'y', laneC: roadCenter(Math.floor(random() * 8)), side: 1, s: 0,
        hp: 30, state: 'walk', fleeT: 0, downT: 0, phase: random() * 9,
      });
    }
  }

  // ---------- police ----------
  function spawnCopCar() {
    const p = state.player;
    const a = random() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(a) * 620, 60, CITY.size - 60);
    const y = clamp(p.y + Math.sin(a) * 620, 60, CITY.waterY);
    const car = makeCar(x, y, { police: true, driver: 'cop' });
    car.speed = 200;
    state.cars.push(car);
  }

  function spawnCopAt(x, y) {
    const car = makeCar(x, y, { police: true, driver: 'cop' });
    car.speed = 240;
    car.angle = Math.atan2(state.player.y - y, state.player.x - x);
    state.cars.push(car);
    return car;
  }

  function stepPolice(dt) {
    const p = state.player;
    const copCars = state.cars.filter((c) => c.police && !c.dead);
    const wantCars = state.stars === 0 ? 0 : Math.min(1 + state.stars, 5);
    state.copSpawnT = (state.copSpawnT || 0) - dt;
    if (copCars.length < wantCars && state.copSpawnT <= 0) { spawnCopCar(); state.copSpawnT = 2.5; }
    // despawn far cops when the heat is off
    if (state.stars === 0) {
      for (let i = state.cars.length - 1; i >= 0; i -= 1) {
        const c = state.cars[i];
        if (c.police && dist2(c.x, c.y, p.x, p.y) > 700 * 700) state.cars.splice(i, 1);
      }
      for (let i = state.officers.length - 1; i >= 0; i -= 1) state.officers.splice(i, 1);
    }

    state.seenByCop = false;
    for (const car of copCars) {
      const d = Math.hypot(p.x - car.x, p.y - car.y);
      if (d < 340) state.seenByCop = true;
      if (d > 1100) { car.x = clamp(p.x + (car.x - p.x) * 0.4, 40, CITY.size - 40); car.y = clamp(p.y + (car.y - p.y) * 0.4, 40, CITY.waterY); }
      // chase steering
      const lead = p.car ? 0.35 : 0.12;
      const tx = p.x + Math.cos(p.angle) * (p.speedNow || 0) * lead;
      const ty = p.y + Math.sin(p.angle) * (p.speedNow || 0) * lead;
      const want = Math.atan2(ty - car.y, tx - car.x);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const top = 295 + state.stars * 26;
      const goal = d > 46 ? top : top * 0.25;
      car.speed += clamp(goal - car.speed, -300 * dt, 190 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (collideBuildings(car, CAR.radius - 6)) car.speed *= 0.45;
      car.ramT = Math.max(0, (car.ramT || 0) - dt);
      if (d < 52 && Math.abs(car.speed) > 120 && !p.car && car.ramT <= 0) { hurtPlayer(8); car.ramT = 0.9; }
      // officers pile out when close to a player on foot
      car.officerT -= dt;
      if (!p.car && d < 120 && car.officerT <= 0 && state.officers.length < 6) {
        car.officerT = 5;
        state.officers.push({
          x: car.x + 30, y: car.y, angle: 0, hp: 45, shootT: 1 + random(), state: 'chase', downT: 0,
          color: '#274bdb', skin: '#f2c79b', phase: random() * 9,
        });
      }
    }
    for (let i = state.officers.length - 1; i >= 0; i -= 1) {
      const o = state.officers[i];
      if (o.state === 'down') { o.downT -= dt; if (o.downT <= 0) state.officers.splice(i, 1); continue; }
      const d = Math.hypot(p.x - o.x, p.y - o.y);
      if (d < 340) state.seenByCop = true;
      o.phase += dt * 9;
      if (d > 34) {
        o.angle = Math.atan2(p.y - o.y, p.x - o.x);
        o.x += Math.cos(o.angle) * 172 * dt;
        o.y += Math.sin(o.angle) * 172 * dt;
        collideBuildings(o, 11);
      }
      o.shootT -= dt;
      if (state.stars >= 3 && d < 250 && d > 40 && o.shootT <= 0) {
        o.shootT = 0.9 + random() * 0.5;
        fireBullet(o.x, o.y, Math.atan2(p.y - o.y, p.x - o.x) + (random() - 0.5) * 0.16, 'cop');
      }
      if (d > 950) state.officers.splice(i, 1);
    }

    // wanted decay & busted
    if (!state.seenByCop && state.crimeT > 3.5 && state.stars > 0) {
      state.wantedPoints = Math.max(0, state.wantedPoints - 8 * dt);
    }
    const nearCop = state.stars > 0 && (
      copCars.some((c) => dist2(c.x, c.y, p.x, p.y) < 78 * 78) ||
      state.officers.some((o) => o.state !== 'down' && dist2(o.x, o.y, p.x, p.y) < 58 * 58)
    );
    const slow = p.car ? Math.abs(p.car.speed) < 26 : p.speedNow < 24;
    if (nearCop && slow && !state.over) state.bustedT += dt;
    else state.bustedT = Math.max(0, state.bustedT - dt * 1.6);
    if (state.bustedT > 2.2) { state.over = 'busted'; state.overT = 0; }
  }

  // ---------- enemies (gang) ----------
  function spawnEnemy(x, y, tough) {
    state.enemies.push({
      x, y, angle: 0, hp: tough ? 110 : 55 + random() * 25, maxHp: tough ? 110 : 70,
      shootT: 0.6 + random() * 0.9, meleeT: 0, flashT: 0, deadT: 0, phase: random() * 9,
      color: tough ? '#111111' : ['#7a1f1f', '#26324f', '#3d3d3d', '#5b2a6e'][Math.floor(random() * 4)],
      skin: ['#f2c79b', '#c68863', '#8d5524'][Math.floor(random() * 3)], gun: true,
    });
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.flashT > 0) e.flashT -= dt;
      if (e.hp <= 0) { e.deadT += dt; if (e.deadT > 5) state.enemies.splice(i, 1); continue; }
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.phase += dt * 8;
      if (d > 175) {
        e.x += Math.cos(e.angle) * 128 * dt;
        e.y += Math.sin(e.angle) * 128 * dt;
        collideBuildings(e, 12);
      }
      e.shootT -= dt;
      if (d < 265 && d > 44 && e.shootT <= 0) {
        e.shootT = 1.0 + random() * 0.6;
        fireBullet(e.x, e.y, e.angle + (random() - 0.5) * 0.13, 'enemy');
        scarePeds(e.x, e.y, 190);
      }
      e.meleeT -= dt;
      if (d < 42 && e.meleeT <= 0) { e.meleeT = 0.85; hurtPlayer(7); }
    }
  }

  // ---------- missions ----------
  function stepMission(dt) {
    const m = MISSIONS[state.missionIndex];
    if (!m || state.over) return;
    const p = state.player;
    const at = (t, r) => dist2(p.x, p.y, t.x, t.y) < r * r;

    if (m.type === 'goto') {
      if (at(m.target, 68)) completeMission();
    } else if (m.type === 'steal') {
      const car = state.targetCar;
      if (state.missionPhase === 0) {
        if (car && car.dead) {
          state.cars = state.cars.filter((c) => c !== car);
          const nc = makeCar(POIS.stealCar.x + 20, POIS.stealCar.y - 46, { type: 'sports', color: '#e01b2f', driver: 'parked', target: true, angle: 0 });
          state.cars.push(nc); state.targetCar = nc;
          toast('The car is wrecked — the collector has a spare. Go again.');
        } else if (car) {
          state.marker = { x: car.x, y: car.y, label: 'TARGET CAR' };
          if (p.car === car) {
            state.missionPhase = 1;
            state.marker = { ...POIS.garage, label: 'GARAGE' };
            state.objective = 'Deliver the car to Vince\'s garage';
            crime(70);
          }
        }
      } else if (p.car === car && at(POIS.garage, 85)) completeMission();
    } else if (m.type === 'collect') {
      if (state.missionPhase === 0) {
        for (const pk of state.pickups) {
          if (pk.kind !== 'package' || pk.taken) continue;
          if (dist2(p.x, p.y, pk.x, pk.y) < 44 * 44) {
            pk.taken = true; state.packagesGot += 1; state.money += 25;
            addEffect(pk.x, pk.y - 20, 'good', 'PACKAGE +$25');
            crime(15);
          }
        }
        const left = state.pickups.filter((pk) => pk.kind === 'package' && !pk.taken);
        state.objective = `Collect the packages (${state.packagesGot}/3)`;
        if (left.length === 0) {
          state.missionPhase = 1;
          state.marker = { ...POIS.docks, label: 'DOCKS' };
          state.objective = 'Deliver the packages to the docks';
        } else state.marker = { x: left[0].x, y: left[0].y, label: 'PACKAGE' };
      } else if (at(POIS.docks, 75)) completeMission();
    } else if (m.type === 'ambush') {
      if (state.missionPhase === 0 && at(POIS.park, 80)) {
        state.missionPhase = 1;
        for (let k = 0; k < 5; k += 1) {
          const a = (k / 5) * Math.PI * 2;
          spawnEnemy(POIS.park.x + Math.cos(a) * 130, POIS.park.y + Math.sin(a) * 130, k === 0);
        }
        state.marker = null;
        state.objective = 'Defeat the Vultures (0/5)';
        toast('Ambush! The Vultures are on you!');
        crime(90);
      } else if (state.missionPhase === 1) {
        const alive = state.enemies.filter((e) => e.hp > 0).length;
        state.objective = `Defeat the Vultures (${5 - alive}/5)`;
        if (alive === 0) {
          state.missionPhase = 2;
          if (state.wantedPoints < 210) state.wantedPoints = 210;
          state.objective = 'Lose the heat — break line of sight and let the stars fade';
          toast('Now shake the police!');
        }
      } else if (state.missionPhase === 2 && state.stars === 0) completeMission();
    } else if (m.type === 'heist') {
      if (state.missionPhase === 0) {
        if (at(POIS.bank, 60) && !p.car) {
          state.missionPhase = 1;
          state.channelT = 0;
          spawnEnemy(POIS.bank.x - 90, POIS.bank.y + 60, false);
          spawnEnemy(POIS.bank.x + 90, POIS.bank.y + 60, false);
          spawnEnemy(POIS.bank.x, POIS.bank.y - 110, true);
          state.objective = 'Crack the vault — stay in the circle!';
          toast('Guards! Hold your ground and crack the vault!');
        } else if (at(POIS.bank, 90)) state.objective = 'Get out of the car and enter the bank circle';
      } else if (state.missionPhase === 1) {
        if (!p.car && at(POIS.bank, 62)) {
          p.channeling = true;
          state.channelT += dt;
          if (state.channelT >= 2.5) {
            state.missionPhase = 2;
            state.money += 500;
            if (state.wantedPoints < 320) state.wantedPoints = 320;
            state.crimeT = 0;
            state.marker = { ...POIS.hideout, label: 'HIDEOUT' };
            state.objective = 'Escape to the harbour hideout!';
            toast('You have the cash! RUN!');
          }
        } else { p.channeling = false; state.channelT = Math.max(0, state.channelT - dt * 0.7); }
      } else if (state.missionPhase === 2 && at(POIS.hideout, 80)) completeMission();
    }
  }

  // ---------- main step ----------
  function stepEffects(dt) {
    for (let i = state.effects.length - 1; i >= 0; i -= 1) {
      const f = state.effects[i];
      f.t += dt; f.y -= f.text ? 34 * dt : 0;
      if (f.t > f.life) state.effects.splice(i, 1);
    }
    if (state.msgT > 0) state.msgT -= dt;
    if (state.bannerT > 0) state.bannerT -= dt;
    if (state.subT > 0) state.subT -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 16);
  }

  function stepHealthPacks(dt) {
    if (!state.packs) {
      state.packs = [
        { x: POIS.hospital.x + 40, y: POIS.hospital.y - 60, t: 0 },
        { x: roadCenter(6), y: roadCenter(5) - 60, t: 0 },
      ];
    }
    const p = state.player;
    for (const pk of state.packs) {
      if (pk.t > 0) { pk.t -= dt; continue; }
      if (!p.car && dist2(p.x, p.y, pk.x, pk.y) < 30 * 30 && p.hp < PLAYER.maxHp) {
        p.hp = Math.min(PLAYER.maxHp, p.hp + 45);
        pk.t = 25;
        addEffect(pk.x, pk.y - 18, 'good', '+HEALTH');
      }
    }
  }

  function step(dt, input) {
    state.time += dt;
    if (state.over) {
      state.overT += dt;
      stepTraffic(dt); stepPeds(dt); stepEffects(dt);
      return;
    }
    state.crimeT += dt;
    state.stars = state.wantedPoints <= 0 ? 0 : Math.min(5, 1 + Math.floor(state.wantedPoints / 100));
    stepPlayer(dt, input);
    stepTraffic(dt);
    stepPeds(dt);
    stepPolice(dt);
    state.stars = state.wantedPoints <= 0 ? 0 : Math.min(5, 1 + Math.floor(state.wantedPoints / 100));
    stepEnemies(dt);
    stepBullets(dt);
    stepMission(dt);
    stepHealthPacks(dt);
    stepEffects(dt);
    // camera follows the player (or their car)
    const p = state.player;
    state.camera.x += (p.x - state.camera.x) * Math.min(1, dt * 7);
    state.camera.y += (p.y - state.camera.y) * Math.min(1, dt * 7);
  }

  function stepAmbient(dt) {
    state.time += dt;
    stepTraffic(dt);
    stepPeds(dt);
    stepEffects(dt);
  }

  return { state, newGame, retryMission, loadProgress, step, stepAmbient, setMission, spawnCopAt };
}
