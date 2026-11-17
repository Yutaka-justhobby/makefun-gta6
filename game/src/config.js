// NEON HARBOR — tuning and palette in one place.
// The view is a fixed 1280x720 logical area; the world itself is a 3600x3600 city
// seen through a camera that follows the player.

export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const CITY = {
  size: 3600,
  pitch: 450,          // distance between road centrelines
  roadWidth: 116,
  roads: 8,            // centrelines per axis: 225, 675, ..., 3375
  waterY: 3450,        // harbour water along the south edge
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  runSpeed: 265,
  maxHp: 100,
  meleeRange: 48,
  meleeDamage: 34,
  shotCooldown: 0.22,
  bulletSpeed: 780,
  bulletDamage: 26,
};

export const CAR = {
  width: 46,
  length: 92,
  radius: 24,
  maxHp: 220,
};

export const SAVE_KEY = 'neon-harbor.save.v1';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const PALETTE = {
  backdrop: '#07090f',
  grass: '#3d7a3a',
  grassDark: '#356b33',
  parkPath: '#9a8a68',
  sand: '#c9b078',
  water: '#14425e',
  waterLight: '#1d5a7d',
  sidewalk: '#8f9296',
  sidewalkEdge: '#6f7276',
  road: '#33363c',
  roadEdge: '#26282d',
  lane: '#d8c95a',
  crosswalk: '#cfd3d8',
  roofEdge: '#1c1e24',
  text: '#f2f4f8',
  muted: '#a7aebb',
  panel: 'rgba(10,13,20,0.82)',
  accent: '#ffb52e',
  danger: '#ff5348',
  good: '#51e07a',
  cop: '#2b5cff',
  marker: '#ffd83d',
};

export const BUILDING_COLORS = [
  '#b5563c', '#c96f4a', '#8c5a7a', '#4a6fa5', '#5a8c6f', '#c2a15a',
  '#7a7f8c', '#96504f', '#4f7d8c', '#a5713d', '#6b5b95', '#3f7f7a',
  '#bf7f3f', '#707a4f', '#8c4a5e', '#546e7a', '#d08c4a', '#5d7a3a',
  '#7a4a8c', '#3a6ea5',
];

export const CAR_COLORS = [
  '#d94f3d', '#3d7ad9', '#f2b035', '#57b368', '#e8e8ec', '#2e2e34',
  '#8e44ad', '#16a3a3', '#e67e22', '#d6336c', '#95a5a6', '#f5e663',
  '#4a90d9', '#c0392b', '#27ae60', '#fd79a8',
];

export const PED_COLORS = [
  '#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6',
  '#ecf0f1', '#fd79a8', '#00cec9', '#fdcb6e', '#6c5ce7', '#d63031',
  '#00b894', '#e17055', '#74b9ff', '#a29bfe',
];

export const SIGNS = [
  'RAMEN', 'HOTEL', 'PAWN SHOP', 'CLUB NEON', 'AUTO REPAIR', 'DINER 24H',
  'CITY BANK', 'GYM', 'LIQUOR', 'TATTOO', 'MART', 'PIZZA', 'JAZZ BAR',
  'CASINO', 'PHARMACY', 'GARAGE', 'BOOKS', 'SUSHI', 'MOTEL', 'CINEMA',
  'BAKERY', 'ARCADE', 'SALON', 'DEPOT', 'MARKET', 'COFFEE', 'DELIVERY',
  'RECORDS', 'LAUNDRY', 'FLORIST',
];
