// NEON HARBOR — drawing only. The camera follows the player through the city; everything is
// flat-shaded canvas shapes (polygons, circles, rects, text) so the game renders identically
// in a browser and in the headless screenshot harness.
import { CITY, FONT, PALETTE, PLAYER, VIEW } from './config.js';
import { MISSIONS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const roadCenter = (i) => 225 + i * CITY.pitch;

function shade(hex, f) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', bold = false) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function poly(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function rotatedRect(x, y, w, l, angle, color) {
    const c = Math.cos(angle); const s = Math.sin(angle);
    const pts = [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]]
      .map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
    poly(pts, color);
    return { c, s };
  }

  // ---------------- world ----------------
  function drawCity(state, vx, vy, vw, vh) {
    // base: block ground (sidewalk tone), then parks, water, roads
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(vx, vy, vw, vh);
    ctx.fillStyle = PALETTE.grass;
    for (const pk of state.parks) {
      if (pk.x + pk.w > vx && pk.x < vx + vw && pk.y + pk.h > vy && pk.y < vy + vh) {
        ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
        ctx.fillStyle = PALETTE.parkPath;
        ctx.fillRect(pk.x, pk.y + pk.h / 2 - 9, pk.w, 18);
        ctx.fillRect(pk.x + pk.w / 2 - 9, pk.y, 18, pk.h);
        ctx.fillStyle = PALETTE.grassDark;
        ctx.fillRect(pk.x + 14, pk.y + 14, 60, 40);
        ctx.fillStyle = PALETTE.grass;
      }
    }
    // harbour: sand then water
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(vx, CITY.waterY - 26, vw, 40);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(vx, CITY.waterY + 8, vw, vy + vh - CITY.waterY);
    ctx.fillStyle = PALETTE.waterLight;
    for (let x = Math.floor(vx / 90) * 90; x < vx + vw; x += 90) {
      const yy = CITY.waterY + 34 + ((x * 7) % 60);
      if (yy > vy && yy < vy + vh) ctx.fillRect(x, yy, 44, 4);
    }
    // pier
    ctx.fillStyle = '#7a6248';
    ctx.fillRect(POIS_PIER.x - 30, CITY.waterY - 60, 60, 130);

    // roads: dark strips over sidewalk borders
    ctx.fillStyle = PALETTE.road;
    for (let i = 0; i < CITY.roads; i += 1) {
      const c = roadCenter(i);
      if (c + 58 > vx && c - 58 < vx + vw) ctx.fillRect(c - 58, vy, 116, vh);
      if (c + 58 > vy && c - 58 < vy + vh) ctx.fillRect(vx, c - 58, vw, 116);
    }
    // lane dashes
    ctx.fillStyle = PALETTE.lane;
    for (let i = 0; i < CITY.roads; i += 1) {
      const c = roadCenter(i);
      for (let d = Math.floor(vy / 46) * 46; d < vy + vh; d += 46) {
        if (Math.abs(((d % (CITY.pitch)) + CITY.pitch) % CITY.pitch - 225) > 74) ctx.fillRect(c - 2, d, 4, 24);
      }
      for (let d = Math.floor(vx / 46) * 46; d < vx + vw; d += 46) {
        if (Math.abs(((d % (CITY.pitch)) + CITY.pitch) % CITY.pitch - 225) > 74) ctx.fillRect(d, c - 2, 24, 4);
      }
    }
    // crosswalks
    ctx.fillStyle = PALETTE.crosswalk;
    for (let i = 0; i < CITY.roads; i += 1) {
      for (let j = 0; j < CITY.roads; j += 1) {
        const cx = roadCenter(i); const cy = roadCenter(j);
        if (cx + 70 < vx || cx - 70 > vx + vw || cy + 70 < vy || cy - 70 > vy + vh) continue;
        for (let s = -44; s <= 44; s += 16) {
          ctx.fillRect(cx + s - 5, cy - 70, 10, 12);
          ctx.fillRect(cx + s - 5, cy + 58, 10, 12);
          ctx.fillRect(cx - 70, cy + s - 5, 12, 10);
          ctx.fillRect(cx + 58, cy + s - 5, 12, 10);
        }
      }
    }
  }

  const POIS_PIER = { x: roadCenter(7) };

  function drawBuildings(state, vx, vy, vw, vh) {
    for (const b of state.buildings) {
      if (b.x + b.w < vx || b.x > vx + vw || b.y + b.h < vy || b.y > vy + vh) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = shade(b.color, b.shade);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = PALETTE.roofEdge;
      ctx.fillRect(b.x, b.y, b.w, 5); ctx.fillRect(b.x, b.y + b.h - 5, b.w, 5);
      ctx.fillRect(b.x, b.y, 5, b.h); ctx.fillRect(b.x + b.w - 5, b.y, 5, b.h);
      ctx.fillStyle = shade(b.color, b.shade * 0.72);
      const iw = b.w * 0.52; const ih = b.h * 0.52;
      ctx.fillRect(b.x + (b.w - iw) / 2, b.y + (b.h - ih) / 2, iw, ih);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      for (const ac of b.ac) ctx.fillRect(b.x + ac.dx * b.w, b.y + ac.dy * b.h, ac.s, ac.s * 0.8);
      if (b.tower) circle(b.x + b.w * 0.78, b.y + b.h * 0.2, 10, '#6b4a2f');
      // rooftop sign, lettered along the top edge
      ctx.textBaseline = 'top';
      text(b.sign, b.x + 10, b.y + 8, Math.min(17, b.w / (b.sign.length * 0.62)), '#ffe9a8', 'left', true);
    }
  }

  function drawPropsTrees(state, vx, vy, vw, vh) {
    for (const t of state.trees) {
      if (t.x < vx - 30 || t.x > vx + vw + 30 || t.y < vy - 30 || t.y > vy + vh + 30) continue;
      circle(t.x + 3, t.y + 4, t.r, 'rgba(0,0,0,0.22)');
      circle(t.x, t.y, t.r, '#2e6b2a');
      circle(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.62, '#43a047');
    }
    for (const pr of state.props) {
      if (pr.x < vx - 40 || pr.x > vx + vw + 40 || pr.y < vy - 40 || pr.y > vy + vh + 40) continue;
      if (pr.kind === 'dumpster') {
        ctx.fillStyle = '#2e5e3a'; ctx.fillRect(pr.x - 20, pr.y - 11, 40, 22);
        ctx.fillStyle = '#3f7d4f'; ctx.fillRect(pr.x - 20, pr.y - 11, 40, 6);
      } else {
        ctx.fillStyle = '#9a6b35'; ctx.fillRect(pr.x - 13, pr.y - 13, 26, 26);
        ctx.fillStyle = '#7a5227'; ctx.fillRect(pr.x - 13, pr.y - 2, 26, 4);
      }
    }
    // traffic lights
    for (const l of state.lights) {
      if (l.x < vx - 20 || l.x > vx + vw + 20 || l.y < vy - 20 || l.y > vy + vh + 20) continue;
      const xGreen = Math.floor(state.time / 5) % 2 === 0;
      ctx.fillStyle = '#20232a';
      ctx.fillRect(l.x + 52, l.y - 66, 10, 20);
      ctx.fillRect(l.x - 62, l.y + 46, 10, 20);
      circle(l.x + 57, l.y - 61, 3.6, xGreen ? '#51e07a' : '#ff5348');
      circle(l.x - 57, l.y + 51, 3.6, xGreen ? '#ff5348' : '#51e07a');
    }
  }

  function drawCar(state, car) {
    const { x, y, angle } = car;
    const L = car.type === 'truck' ? 108 : car.type === 'van' ? 100 : 92;
    const W = car.type === 'truck' || car.type === 'van' ? 50 : 44;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rotatedRect(x + 4, y + 6, W, L, angle, 'rgba(0,0,0,0.28)');
    const body = car.police ? '#eef1f5' : car.color;
    rotatedRect(x, y, W, L, angle, shade(typeof body === 'string' && body.startsWith('#') ? body : '#888888', car.dead ? 0.4 : 1));
    const c = Math.cos(angle); const s = Math.sin(angle);
    const at = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c];
    // cabin & windows
    poly([at(6, -W * 0.36), at(24, -W * 0.36), at(24, W * 0.36), at(6, W * 0.36)], '#1d2733');
    poly([at(-22, -W * 0.36), at(-6, -W * 0.36), at(-6, W * 0.36), at(-22, W * 0.36)], '#263646');
    // wheels
    for (const [lx, ly] of [[L * 0.32, -W / 2], [L * 0.32, W / 2], [-L * 0.32, -W / 2], [-L * 0.32, W / 2]]) {
      const [wx, wy] = at(lx, ly);
      rotatedRect(wx, wy, 7, 15, angle, '#101216');
    }
    if (car.type === 'taxi') {
      const [tx, ty] = at(14, 0);
      rotatedRect(tx, ty, 16, 10, angle, '#ffe066');
    }
    if (car.police) {
      poly([at(-L * 0.1, -W / 2), at(L * 0.16, -W / 2), at(L * 0.16, W / 2), at(-L * 0.1, W / 2)], '#2b5cff');
      const flash = Math.floor(state.time * 6) % 2 === 0;
      const [lx1, ly1] = at(2, -9); const [lx2, ly2] = at(2, 9);
      circle(lx1, ly1, 5.5, flash ? '#ff3b30' : '#7a1610');
      circle(lx2, ly2, 5.5, flash ? '#1c46ff' : '#101f66');
      ctx.textBaseline = 'middle';
      const [tx2, ty2] = at(-30, 0);
      text('POLICE', tx2, ty2, 10, '#20306e', 'center', true);
    }
    if (car.target) {
      const pulse = 3 + Math.sin(state.time * 6) * 1.6;
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = pulse;
      ctx.beginPath(); ctx.arc(x, y, 44 + Math.sin(state.time * 6) * 4, 0, Math.PI * 2); ctx.stroke();
    }
    if (car.hp < 80 && !car.dead) {
      const rise = (state.time * 22 + x) % 26;
      circle(x - 8, y - L * 0.3 - rise * 0.4, 5 + rise * 0.22, 'rgba(90,90,90,0.45)');
    }
    if (car.dead) {
      circle(x, y, 16, 'rgba(30,30,30,0.55)');
      const [fx, fy] = at(L * 0.3, 0);
      circle(fx, fy, 8 + Math.sin(state.time * 11) * 2, '#ff8c3a');
      circle(fx, fy, 4.5, '#ffd83d');
    }
  }

  function drawPerson(x, y, angle, colorBody, skin, phase, opts = {}) {
    if (opts.down) {
      ctx.fillStyle = colorBody;
      ctx.beginPath(); ctx.ellipse(x, y, 16, 8, angle, 0, Math.PI * 2); ctx.fill();
      circle(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, 6.5, skin);
      return;
    }
    const bob = Math.sin(phase) * 1.6;
    circle(x + 2, y + 3, 11, 'rgba(0,0,0,0.25)');
    circle(x, y + bob * 0.3, 10.5, colorBody);
    circle(x, y + bob * 0.3, 6.4, skin);
    // facing tick (nose / gun direction)
    ctx.strokeStyle = colorBody;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * 13, y + Math.sin(angle) * 13);
    ctx.stroke();
    if (opts.cap) {
      ctx.fillStyle = opts.cap;
      ctx.beginPath(); ctx.arc(x, y + bob * 0.3, 6.8, Math.PI, Math.PI * 2); ctx.fill();
    }
  }

  function drawEntities(state, vx, vy, vw, vh) {
    const inView = (x, y, m = 90) => x > vx - m && x < vx + vw + m && y > vy - m && y < vy + vh + m;
    // pickups: packages & health
    for (const pk of state.pickups || []) {
      if (pk.kind !== 'package' || pk.taken || !inView(pk.x, pk.y)) continue;
      const bob = Math.sin(state.time * 4 + pk.x) * 4;
      circle(pk.x, pk.y + bob, 17 + Math.sin(state.time * 5) * 2.5, 'rgba(255,216,61,0.30)');
      ctx.fillStyle = '#b07a2e'; ctx.fillRect(pk.x - 11, pk.y - 9 + bob, 22, 18);
      ctx.fillStyle = '#8a5a1e'; ctx.fillRect(pk.x - 11, pk.y - 2 + bob, 22, 4);
      ctx.fillStyle = '#ffd83d'; ctx.fillRect(pk.x - 2, pk.y - 9 + bob, 4, 18);
    }
    for (const pk of state.packs || []) {
      if (pk.t > 0 || !inView(pk.x, pk.y)) continue;
      ctx.fillStyle = '#f5f7fa'; ctx.fillRect(pk.x - 12, pk.y - 12, 24, 24);
      ctx.fillStyle = '#e0332b'; ctx.fillRect(pk.x - 3, pk.y - 9, 6, 18); ctx.fillRect(pk.x - 9, pk.y - 3, 18, 6);
    }
    // mission marker beam
    if (state.marker) {
      const m = state.marker;
      if (inView(m.x, m.y, 200)) {
        const bob = Math.sin(state.time * 3.4) * 7;
        ctx.fillStyle = 'rgba(255,216,61,0.16)';
        ctx.fillRect(m.x - 13, vy, 26, m.y - vy);
        circle(m.x, m.y, 30 + Math.sin(state.time * 4) * 4, 'rgba(255,216,61,0.35)');
        poly([[m.x, m.y - 58 + bob], [m.x - 15, m.y - 82 + bob], [m.x + 15, m.y - 82 + bob]], PALETTE.marker);
        ctx.textBaseline = 'bottom';
        text(m.label, m.x, m.y - 88 + bob, 15, PALETTE.marker, 'center', true);
      }
    }
    // heist channel ring around the player
    const p = state.player;
    if (p.channeling) {
      ctx.strokeStyle = PALETTE.good;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, -Math.PI / 2, -Math.PI / 2 + (state.channelT / 2.5) * Math.PI * 2);
      ctx.stroke();
    }
    // cars under people
    for (const car of state.cars) if (inView(car.x, car.y, 120)) drawCar(state, car);
    // pedestrians
    for (const pd of state.peds) {
      if (!inView(pd.x, pd.y, 40)) continue;
      drawPerson(pd.x, pd.y, pd.angle, pd.color, pd.skin, pd.phase, { down: pd.state === 'down' });
    }
    // officers
    for (const o of state.officers) {
      if (!inView(o.x, o.y, 40)) continue;
      drawPerson(o.x, o.y, o.angle, '#274bdb', o.skin, o.phase, { down: o.state === 'down', cap: '#16296b' });
    }
    // enemies with hp bars
    for (const e of state.enemies) {
      if (!inView(e.x, e.y, 40)) continue;
      drawPerson(e.x, e.y, e.angle, e.hp <= 0 ? '#3a3a3a' : e.color, e.skin, e.phase, { down: e.hp <= 0 });
      if (e.hp > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - 16, e.y - 26, 32, 5);
        ctx.fillStyle = e.flashT > 0 ? '#ffffff' : PALETTE.danger;
        ctx.fillRect(e.x - 15, e.y - 25, 30 * Math.max(0, e.hp / e.maxHp), 3);
      }
    }
    // player
    if (!p.car) {
      circle(p.x, p.y, 17, 'rgba(255,255,255,0.85)');
      drawPerson(p.x, p.y, p.angle, '#ffb52e', '#c68863', p.walkPhase, {});
      if (p.meleeT > 0.22) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 30, p.angle - 0.7, p.angle + 0.7); ctx.stroke();
      }
    }
    // bullets
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 2.6;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // effects
    for (const f of state.effects) {
      const k = f.t / f.life;
      if (f.text) {
        ctx.globalAlpha = 1 - k;
        ctx.textBaseline = 'middle';
        text(f.text, f.x, f.y, 17, f.color === 'good' ? PALETTE.good : f.color, 'center', true);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.75 * (1 - k);
        circle(f.x, f.y, f.r + k * 15, f.color);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------------- HUD ----------------
  function star(x, y, r, color) {
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      pts.push([x + Math.cos(ang) * rad, y + Math.sin(ang) * rad]);
    }
    poly(pts, color);
  }

  function drawMinimap(state) {
    const W = 172; const H = 172;
    const x0 = VIEW.width - W - 18; const y0 = 64;
    ctx.fillStyle = 'rgba(8,10,16,0.78)';
    ctx.fillRect(x0 - 4, y0 - 4, W + 8, H + 8);
    ctx.fillStyle = '#22262e';
    ctx.fillRect(x0, y0, W, H);
    const sc = W / CITY.size;
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, y0 + CITY.waterY * sc, W, H - CITY.waterY * sc);
    ctx.strokeStyle = '#565b63';
    ctx.lineWidth = 2;
    for (let i = 0; i < CITY.roads; i += 1) {
      const c = x0 + roadCenter(i) * sc;
      ctx.beginPath(); ctx.moveTo(c, y0); ctx.lineTo(c, y0 + H); ctx.stroke();
      const r = y0 + roadCenter(i) * sc;
      ctx.beginPath(); ctx.moveTo(x0, r); ctx.lineTo(x0 + W, r); ctx.stroke();
    }
    const dot = (x, y, r, color) => circle(x0 + x * sc, y0 + y * sc, r, color);
    for (const car of state.cars) if (car.police && !car.dead) dot(car.x, car.y, 2.6, '#6ea8ff');
    for (const e of state.enemies) if (e.hp > 0) dot(e.x, e.y, 2.6, '#ff5348');
    if (state.targetCar && !state.targetCar.dead) dot(state.targetCar.x, state.targetCar.y, 3, '#ff9f2e');
    if (state.marker) {
      const blink = Math.floor(state.time * 2.4) % 2 === 0;
      if (blink) dot(state.marker.x, state.marker.y, 4.4, PALETTE.marker);
    }
    dot(state.player.x, state.player.y, 4, '#ffffff');
    dot(state.player.x, state.player.y, 2.2, PALETTE.accent);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PALETTE.accent;
    ctx.fillRect(x, y, w, 3);
  }

  function drawHud(state) {
    const p = state.player;
    ctx.textBaseline = 'alphabetic';
    // health
    panel(18, 16, 252, 58);
    text('HP', 30, 40, 15, PALETTE.muted, 'left', true);
    ctx.fillStyle = '#3a2020'; ctx.fillRect(64, 27, 190, 13);
    ctx.fillStyle = p.hp > 50 ? PALETTE.good : p.hp > 25 ? PALETTE.accent : PALETTE.danger;
    ctx.fillRect(64, 27, 190 * Math.max(0, p.hp / PLAYER.maxHp), 13);
    text(`$${state.money.toLocaleString('en-US')}`, 30, 66, 24, '#7be495', 'left', true);
    // wanted stars
    const sx = VIEW.width - 18 - 5 * 36;
    for (let i = 0; i < 5; i += 1) {
      const on = i < state.stars;
      const pulse = state.seenByCop && on && Math.floor(state.time * 5) % 2 === 0;
      star(sx + i * 36 + 15, 36, 15, on ? (pulse ? '#ffffff' : PALETTE.accent) : 'rgba(255,255,255,0.18)');
    }
    drawMinimap(state);
    // mission box
    if (state.objective && !state.over) {
      panel(18, VIEW.height - 92, 560, 74);
      const m = MISSIONS[state.missionIndex];
      text(m ? `MISSION ${state.missionIndex + 1} · ${m.title}` : 'FREE ROAM', 32, VIEW.height - 62, 14, PALETTE.accent, 'left', true);
      text(state.objective, 32, VIEW.height - 34, 19, PALETTE.text, 'left', false);
      if (state.marker) {
        const d = Math.round(Math.hypot(state.marker.x - p.x, state.marker.y - p.y) / 10);
        text(`${d}m`, 564, VIEW.height - 34, 19, PALETTE.marker, 'right', true);
      }
    }
    // vehicle box
    if (p.car) {
      panel(VIEW.width - 218, VIEW.height - 92, 200, 74);
      const kmh = Math.round(Math.abs(p.car.speed) * 0.62);
      text(p.car.police ? 'POLICE CRUISER' : p.car.target ? 'TARGET CAR' : 'YOUR RIDE', VIEW.width - 32, VIEW.height - 76, 11, PALETTE.muted, 'right', true);
      text(`${kmh} km/h`, VIEW.width - 32, VIEW.height - 46, 27, PALETTE.text, 'right', true);
      ctx.fillStyle = '#333'; ctx.fillRect(VIEW.width - 202, VIEW.height - 34, 168, 8);
      ctx.fillStyle = p.car.hp > 90 ? PALETTE.good : PALETTE.danger;
      ctx.fillRect(VIEW.width - 202, VIEW.height - 34, 168 * Math.max(0, p.car.hp / 220), 8);
    }
    // toast
    if (state.msgT > 0 && state.msg) {
      ctx.globalAlpha = Math.min(1, state.msgT);
      const w = 30 + state.msg.length * 10.5;
      panel(VIEW.width / 2 - w / 2, 86, w, 44);
      text(state.msg, VIEW.width / 2, 115, 19, PALETTE.text, 'center', true);
      ctx.globalAlpha = 1;
    }
    // mission banner + story subtitle
    if (state.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, state.bannerT / 1.2);
      ctx.textBaseline = 'middle';
      text(state.banner, VIEW.width / 2, 150, 34, PALETTE.accent, 'center', true);
      ctx.globalAlpha = 1;
    }
    if (state.subT > 0 && state.sub) {
      ctx.globalAlpha = Math.min(1, state.subT / 1.5);
      panel(VIEW.width / 2 - 430, VIEW.height - 168, 860, 56);
      text(state.sub, VIEW.width / 2, VIEW.height - 133, 17.5, PALETTE.text, 'center', false);
      ctx.globalAlpha = 1;
    }
    // busted meter
    if (state.bustedT > 0.12 && !state.over) {
      const w = 340;
      panel(VIEW.width / 2 - w / 2, 196, w, 52);
      text('THE POLICE ARE GRABBING YOU — MOVE!', VIEW.width / 2, 218, 15, PALETTE.danger, 'center', true);
      ctx.fillStyle = '#3a2020'; ctx.fillRect(VIEW.width / 2 - w / 2 + 16, 228, w - 32, 9);
      ctx.fillStyle = PALETTE.danger; ctx.fillRect(VIEW.width / 2 - w / 2 + 16, 228, (w - 32) * Math.min(1, state.bustedT / 2.2), 9);
    }
    // controls hint
    text(p.car ? 'W A S D drive · SPACE handbrake · E get out' : 'W A S D move · SHIFT run · E steal car · CLICK shoot · J punch', 20, VIEW.height - 6, 13, 'rgba(255,255,255,0.55)', 'left', false);
    // low hp vignette
    if (p.hp < 30 && !state.over) {
      ctx.fillStyle = `rgba(200,30,20,${0.16 + 0.1 * Math.sin(state.time * 6)})`;
      ctx.fillRect(0, 0, VIEW.width, 14); ctx.fillRect(0, VIEW.height - 14, VIEW.width, 14);
      ctx.fillRect(0, 0, 14, VIEW.height); ctx.fillRect(VIEW.width - 14, 0, 14, VIEW.height);
    }
  }

  function drawBigPanel(state, screen, best) {
    ctx.fillStyle = 'rgba(4,6,10,0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textBaseline = 'middle';
    if (screen === SCREEN_TITLE) {
      text('NEON HARBOR', VIEW.width / 2, 168, 92, PALETTE.marker, 'center', true);
      text('— S T R E E T S   O F   F O R T U N E —', VIEW.width / 2, 232, 24, '#7be495', 'center', true);
      const lines = [
        'You are Kai, a wheelman fresh off the boat in a city that never pays honest.',
        'Fixer Vince has five jobs. Steal cars, run packages, dodge the law,',
        'crack the City Bank vault — and the harbour is yours.',
        '',
        'W A S D move / drive · SHIFT run · E enter & steal cars · MOUSE aim',
        'CLICK shoot · J punch · SPACE handbrake · P pause',
      ];
      lines.forEach((ln, i) => text(ln, VIEW.width / 2, 300 + i * 30, 19, i < 3 ? PALETTE.text : PALETTE.muted, 'center', false));
      if (best.hasSave) {
        text('ENTER / CLICK — Continue your story', VIEW.width / 2, 540, 26, PALETTE.good, 'center', true);
        text('Press N for a fresh start', VIEW.width / 2, 580, 18, PALETTE.muted, 'center', false);
      } else {
        const blink = Math.floor(state.time * 1.6) % 2 === 0;
        if (blink) text('PRESS ENTER OR CLICK TO START', VIEW.width / 2, 548, 27, PALETTE.good, 'center', true);
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      text('PAUSED', VIEW.width / 2, 300, 54, PALETTE.text, 'center', true);
      text('Press P to get back to the streets', VIEW.width / 2, 360, 20, PALETTE.muted, 'center', false);
      return;
    }
    if (screen === SCREEN_WIN) {
      text('CITY CONQUERED', VIEW.width / 2, 210, 64, PALETTE.marker, 'center', true);
      text('The Big Score is yours. Neon Harbor belongs to Kai now.', VIEW.width / 2, 272, 21, PALETTE.text, 'center', false);
      drawStats(state, 330);
      text('PRESS ENTER — Play again from the top', VIEW.width / 2, 540, 23, PALETTE.good, 'center', true);
      return;
    }
    // game over
    const busted = state.over === 'busted';
    text(busted ? 'BUSTED' : 'WASTED', VIEW.width / 2, 218, 76, busted ? '#6ea8ff' : PALETTE.danger, 'center', true);
    text(busted ? 'The Neon Harbor PD got their hands on you. Bail posted: $100.' : 'You flatlined on the asphalt. The hospital patch you up — for $100.', VIEW.width / 2, 282, 20, PALETTE.text, 'center', false);
    drawStats(state, 340);
    text('PRESS ENTER — Back on the street, same job', VIEW.width / 2, 540, 23, PALETTE.good, 'center', true);
  }

  function drawStats(state, y) {
    const rows = [
      `Cash on hand   $${state.money.toLocaleString('en-US')}`,
      `Missions done   ${state.over === 'win' ? MISSIONS.length : state.missionIndex} / ${MISSIONS.length}`,
      `Cars stolen   ${state.carsStolen}      Shots fired   ${state.shotsFired}`,
    ];
    rows.forEach((ln, i) => text(ln, VIEW.width / 2, y + i * 34, 20, PALETTE.muted, 'center', false));
  }

  /** Paint one frame. `screen` is one of the SCREEN_* values; `opts` carries {hasSave}. */
  function draw(state, screen, opts = {}) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.textBaseline = 'alphabetic';

    const camX = Math.min(CITY.size - VIEW.width, Math.max(0, state.camera.x - VIEW.width / 2));
    const camY = Math.min(CITY.size + 60 - VIEW.height, Math.max(0, state.camera.y - VIEW.height / 2));
    const shX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const shY = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    ctx.save();
    ctx.translate(-camX + shX, -camY + shY);
    drawCity(state, camX - 80, camY - 80, VIEW.width + 160, VIEW.height + 160);
    drawBuildings(state, camX - 40, camY - 40, VIEW.width + 80, VIEW.height + 80);
    drawPropsTrees(state, camX - 40, camY - 40, VIEW.width + 80, VIEW.height + 80);
    drawEntities(state, camX - 40, camY - 40, VIEW.width + 80, VIEW.height + 80);
    ctx.restore();

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen !== SCREEN_PLAY) drawBigPanel(state, screen, opts);
    else if (state.bannerT > 0 || state.subT > 0) { /* banner drawn in HUD */ }
  }

  if (typeof window !== 'undefined') {
    resize();
    window.addEventListener('resize', resize);
  } else {
    canvas.width = VIEW.width; canvas.height = VIEW.height;
    view.scale = 1; view.x = 0; view.y = 0;
  }
  return { draw };
}
