// Geometría de la carta L105 de enseñanza (Mercator). Sin dependencias del navegador.
// Una posición es {lat, lon} en grados decimales (N y E positivos). El «plano» es la
// proyección Mercator isótropa {x: lon·rad, y: ψ(lat)}: en él los rumbos son rectas y
// un compás traza circunferencias, igual que sobre el papel.
import { WARP } from './chart-warp.js';

const RAD = Math.PI / 180;
export const CHART = Object.freeze({
  width: 4963, height: 3508, tile: 1024,
  // Retícula impresa: esquinas del marco interior y sus píxeles nominales (cabecera del KAP).
  west: -(6 + 20 / 60), east: -(5 + 10 / 60), north: 36 + 20 / 60, south: 35 + 40 / 60,
  x0: 328, x1: 4687, y0: 220, y1: 3285
});
export const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2));
export const invMerc = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
const M_NORTH = merc(CHART.north), M_SOUTH = merc(CHART.south);

export const toPlane = p => ({ x: p.lon * RAD, y: merc(p.lat) });
export const fromPlane = q => ({ lat: invMerc(q.y), lon: q.x / RAD });

function nominalPixel(p) {
  return {
    x: CHART.x0 + (p.lon - CHART.west) / (CHART.east - CHART.west) * (CHART.x1 - CHART.x0),
    y: CHART.y0 + (M_NORTH - merc(p.lat)) / (M_NORTH - M_SOUTH) * (CHART.y1 - CHART.y0)
  };
}
function nominalGeo(px) {
  return {
    lon: CHART.west + (px.x - CHART.x0) / (CHART.x1 - CHART.x0) * (CHART.east - CHART.west),
    lat: invMerc(M_NORTH - (px.y - CHART.y0) / (CHART.y1 - CHART.y0) * (M_NORTH - M_SOUTH))
  };
}
// Deformación del escaneo medida sobre la retícula impresa (malla de 2′, bilineal).
function warp(p) {
  const u = Math.min(Math.max((p.lon - CHART.west) * 30, 0), WARP.nlon - 1);
  const v = Math.min(Math.max((CHART.north - p.lat) * 30, 0), WARP.nlat - 1);
  const i = Math.min(Math.floor(u), WARP.nlon - 2), j = Math.min(Math.floor(v), WARP.nlat - 2);
  const fu = u - i, fv = v - j, n = WARP.nlon;
  const at = a => ((a[j * n + i] * (1 - fu) + a[j * n + i + 1] * fu) * (1 - fv) + (a[(j + 1) * n + i] * (1 - fu) + a[(j + 1) * n + i + 1] * fu) * fv) / 10;
  return { x: at(WARP.dx), y: at(WARP.dy) };
}
/** Posición geográfica → píxel de la imagen a resolución completa. */
export function toPixel(p) {
  const n = nominalPixel(p), w = warp(p);
  return { x: n.x + w.x, y: n.y + w.y };
}
/** Píxel de la imagen → posición geográfica. */
export function toGeo(px) {
  let p = nominalGeo(px);
  for (let k = 0; k < 4; k++) { const w = warp(p); p = nominalGeo({ x: px.x - w.x, y: px.y - w.y }); }
  return p;
}

export const norm360 = a => ((a % 360) + 360) % 360;
/** Rumbo loxodrómico verdadero de a hacia b, en grados 0–360. */
export function bearing(a, b) {
  const A = toPlane(a), B = toPlane(b);
  return norm360(Math.atan2(B.x - A.x, B.y - A.y) / RAD);
}
// Relación Δlat/Δψ del tramo: cos(lat) cuando el rumbo es E–W.
function stretch(lat1, lat2) {
  const dPsi = merc(lat2) - merc(lat1);
  return Math.abs(dPsi) > 1e-12 ? (lat2 - lat1) * RAD / dPsi : Math.cos(lat1 * RAD);
}
/** Distancia loxodrómica en millas náuticas (1 milla = 1′ de latitud). */
export function distance(a, b) {
  const q = stretch(a.lat, b.lat);
  return Math.hypot(b.lat - a.lat, q * (b.lon - a.lon)) * 60;
}
/** Punto de llegada navegando `miles` millas al rumbo verdadero `course` desde `a`. */
export function destination(a, course, miles) {
  const lat = a.lat + miles / 60 * Math.cos(course * RAD);
  return { lat, lon: a.lon + miles / 60 * Math.sin(course * RAD) / stretch(a.lat, lat) };
}
/** Radio en el plano de un círculo de `miles` millas tomado en la escala de latitudes de su centro. */
export const planeRadius = (center, miles) => miles / 60 * RAD / Math.cos(center.lat * RAD);

// ── Intersecciones en el plano ────────────────────────────────────────────────
// Recta: {a, b, min, max} con P = a + t·(b − a), t ∈ [min, max]. Círculo: {c, r}.
const inRange = (t, s) => t >= s.min - 1e-9 && t <= s.max + 1e-9;
export function lineLine(s1, s2) {
  const d1 = { x: s1.b.x - s1.a.x, y: s1.b.y - s1.a.y }, d2 = { x: s2.b.x - s2.a.x, y: s2.b.y - s2.a.y };
  const den = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(den) < 1e-18) return [];
  const t = ((s2.a.x - s1.a.x) * d2.y - (s2.a.y - s1.a.y) * d2.x) / den;
  const u = ((s2.a.x - s1.a.x) * d1.y - (s2.a.y - s1.a.y) * d1.x) / den;
  return inRange(t, s1) && inRange(u, s2) ? [{ x: s1.a.x + t * d1.x, y: s1.a.y + t * d1.y }] : [];
}
export function lineCircle(s, k) {
  const d = { x: s.b.x - s.a.x, y: s.b.y - s.a.y }, f = { x: s.a.x - k.c.x, y: s.a.y - k.c.y };
  const A = d.x * d.x + d.y * d.y, B = 2 * (f.x * d.x + f.y * d.y), C = f.x * f.x + f.y * f.y - k.r * k.r;
  const disc = B * B - 4 * A * C;
  if (A === 0 || disc < 0) return [];
  const root = Math.sqrt(disc);
  return [...new Set([(-B - root) / (2 * A), (-B + root) / (2 * A)])].filter(t => inRange(t, s)).map(t => ({ x: s.a.x + t * d.x, y: s.a.y + t * d.y }));
}
export function circleCircle(k1, k2) {
  const dx = k2.c.x - k1.c.x, dy = k2.c.y - k1.c.y, d = Math.hypot(dx, dy);
  if (d === 0 || d > k1.r + k2.r || d < Math.abs(k1.r - k2.r)) return [];
  const a = (k1.r * k1.r - k2.r * k2.r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, k1.r * k1.r - a * a));
  const mx = k1.c.x + a * dx / d, my = k1.c.y + a * dy / d;
  return h === 0 ? [{ x: mx, y: my }] : [{ x: mx + h * dy / d, y: my - h * dx / d }, { x: mx - h * dy / d, y: my + h * dx / d }];
}

// ── Formato y lectura de coordenadas ──────────────────────────────────────────
const comma = (n, digits) => n.toFixed(digits).replace('.', ',');
/** Grados y minutos con décimas, como en los enunciados: 36°05,1′ N. */
export function formatAngle(value, positive, negative, width) {
  let tenths = Math.round(Math.abs(value) * 600);
  const deg = Math.floor(tenths / 600); tenths -= deg * 600;
  return `${String(deg).padStart(width, '0')}°${comma(tenths / 10, 1).padStart(4, '0')}′ ${value < 0 ? negative : positive}`;
}
export const formatLat = lat => formatAngle(lat, 'N', 'S', 2);
export const formatLon = lon => formatAngle(lon, 'E', 'W', 3);
export const formatPosition = p => `${formatLat(p.lat)} · ${formatLon(p.lon)}`;
export const formatBearing = (deg, digits = 1) => { const v = comma(norm360(deg), digits); return (v.startsWith('360') ? comma(0, digits) : v).padStart(digits ? 4 + digits : 3, '0') + '°'; };
export const formatMiles = (miles, digits = 1) => comma(miles, digits);
/** Lee un número con coma o punto decimal; devuelve NaN si no es válido. */
export function parseNumber(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN;
}
/** Grados + minutos (+ hemisferio) → grados decimales con signo, o NaN. */
export function fromDegMin(deg, min, negative) {
  const d = parseNumber(deg), m = min === '' || min == null ? 0 : parseNumber(min);
  if (!Number.isFinite(d) || !Number.isFinite(m) || d < 0 || m < 0 || m >= 60) return NaN;
  return (d + m / 60) * (negative ? -1 : 1);
}
