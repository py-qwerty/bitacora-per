// Mesa de trazado: la carta L105 de enseñanza a pantalla completa con útiles virtuales
// (puntos, regla, demoras y compás). Todo lo trazado se guarda como posiciones geográficas.
import { CHART, toPixel, toGeo, toPlane, fromPlane, bearing, distance, destination, planeRadius, lineLine, lineCircle, circleCircle, formatLat, formatLon, formatPosition, formatBearing, formatMiles, parseNumber, fromDegMin, norm360 } from './chart-geo.js?v=1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LEVELS = [null, { width: 2482, height: 1754 }, { width: CHART.width, height: CHART.height }, { width: CHART.width * 2, height: CHART.height * 2 }];
const TILES_VERSION = 2, NOTES_MAX = 5000;
const MAX_SCALE = 4, TAP_SLOP = 6, SNAP_RADIUS = 16, HIT_RADIUS = 13, TOUCH_LIFT = 52;
const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], ALIGN_DEGREES = 3.5;
const offCardinal = brg => Math.abs(((brg - Math.round(brg / 45) * 45 + 540) % 360) - 180);
const cardinalOf = brg => offCardinal(brg) < .05 ? CARDINALS[Math.round(brg / 45) % 8] : '';
const bearingText = brg => { const c = cardinalOf(brg); return formatBearing(brg) + (c ? ' ' + c : ''); };
const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const TOOLS = [
  ['select', 'Mover', icon('M6 3l12 9-5.5 1.2L15 19l-2.2 1-2.6-5.7L6 18z')],
  ['point', 'Punto', icon('M12 3v6m0 6v6M3 12h6m6 0h6M12 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z')],
  ['line', 'Regla', icon('M5 19L19 5M3.5 19a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM17.5 5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z')],
  ['bearing', 'Demora', icon('M5 19L18 6m0 0h-6m6 0v6M3.5 19a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM5 11a8 8 0 018-8')],
  ['protractor', 'Transportador', icon('M3 17a9 9 0 0118 0zM12 17v-2M12 17l5.5-6.5M6.5 17v-1.5M17.5 17v-1.5M12 8v1.5')],
  ['circle', 'Compás', icon('M4 12a8 8 0 1016 0 8 8 0 00-16 0zM12 11a1 1 0 100 2 1 1 0 000-2zM12 12h8')]
];
const HINTS = {
  select: 'Toca un trazo para ver sus medidas y corregirlo. Los cruces muestran su situación. Arrastra para mover la carta; pellizca o usa la rueda para ampliar.',
  line: 'Toca el primer punto y después el segundo: obtendrás el rumbo verdadero y la distancia. Con el imán, la recta se alinea sola a N, S, E, W y cuadrantales.',
  bearing: 'Toca el punto de origen (un faro, tu situación…) y escribe el rumbo o la demora verdadera.',
  circle: ''
};

const DEG = Math.PI / 180, AUTO_KEY = 'bitacora-per:v1:chartAuto';
let autoMeasures = true;
try { autoMeasures = localStorage.getItem(AUTO_KEY) !== '0'; } catch { /* Sin almacenamiento: se queda activado. */ }
let dlg, view, world, ink, panel, readout, notesBox, st = null, options = null, lastView = null, frame = 0;
const tiles = new Map(), shapes = new Map(), pointers = new Map();
let gesture = null;

// ── Vista ─────────────────────────────────────────────────────────────────────
const screenOf = p => { const q = toPixel(p); return { x: q.x * st.s + st.tx, y: q.y * st.s + st.ty }; };
const geoAt = (x, y) => toGeo({ x: (x - st.tx) / st.s, y: (y - st.ty) / st.s });
const PLANE_BOX = (() => { const nw = toPlane(toGeo({ x: 0, y: 0 })), se = toPlane(toGeo({ x: CHART.width, y: CHART.height })); return { x0: nw.x, x1: se.x, y0: se.y, y1: nw.y }; })();
const inChart = p => { const q = toPixel(p); return q.x >= 0 && q.x <= CHART.width && q.y >= 0 && q.y <= CHART.height; };
function fitScale() { return Math.min(view.clientWidth / CHART.width, view.clientHeight / CHART.height); }
function clampView() {
  const w = view.clientWidth, h = view.clientHeight;
  st.s = Math.min(MAX_SCALE, Math.max(fitScale() * .9, st.s));
  const cw = CHART.width * st.s, ch = CHART.height * st.s, keep = 80;
  st.tx = cw <= w ? (w - cw) / 2 : Math.min(w - keep, Math.max(keep - cw, st.tx));
  st.ty = ch <= h ? (h - ch) / 2 : Math.min(h - keep, Math.max(keep - ch, st.ty));
}
function fitView() { st.s = fitScale(); st.tx = st.ty = 0; applyView(); }
function zoomAt(factor, x = view.clientWidth / 2, y = view.clientHeight / 2) {
  const before = { x: (x - st.tx) / st.s, y: (y - st.ty) / st.s };
  st.s = Math.min(MAX_SCALE, Math.max(fitScale() * .9, st.s * factor));
  st.tx = x - before.x * st.s; st.ty = y - before.y * st.s;
  applyView();
}
function centerOn(p) { const q = toPixel(p); st.tx = view.clientWidth / 2 - q.x * st.s; st.ty = view.clientHeight / 2 - q.y * st.s; applyView(); }
function applyView() {
  clampView();
  world.style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.s})`;
  updateTiles();
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (st) draw(); });
}
function updateTiles() {
  const sharp = st.s * (window.devicePixelRatio || 1), level = sharp > 1.05 ? 3 : sharp > .5 ? 2 : sharp > .25 ? 1 : 0;
  const wanted = new Set();
  if (level) {
    const L = LEVELS[level], f = CHART.width / L.width, size = CHART.tile * f;
    const c0 = Math.max(0, Math.floor(-st.tx / st.s / size)), c1 = Math.min(Math.ceil(L.width / CHART.tile) - 1, Math.floor((view.clientWidth - st.tx) / st.s / size));
    const r0 = Math.max(0, Math.floor(-st.ty / st.s / size)), r1 = Math.min(Math.ceil(L.height / CHART.tile) - 1, Math.floor((view.clientHeight - st.ty) / st.s / size));
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
      const key = `${level}-${c}-${r}`; wanted.add(key);
      if (tiles.has(key)) continue;
      const img = new Image();
      img.alt = ''; img.draggable = false; img.decoding = 'async'; img.className = `chart-tile level-${level}`;
      img.style.cssText = `left:${c * size}px;top:${r * size}px;width:${Math.min(CHART.tile, L.width - c * CHART.tile) * f}px;height:${Math.min(CHART.tile, L.height - r * CHART.tile) * f}px`;
      img.src = `assets/chart/${key}.webp?v=${TILES_VERSION}`;
      world.append(img); tiles.set(key, img);
    }
  }
  for (const [key, img] of tiles) if (!wanted.has(key)) { img.remove(); tiles.delete(key); }
}

// ── Geometría de los trazos ───────────────────────────────────────────────────
const segmentOf = el => ({ a: toPlane(el.a), b: toPlane(el.b), min: el.ext ? -Infinity : 0, max: el.ext ? Infinity : 1 });
const circleOf = el => ({ c: toPlane(el.c), r: planeRadius(el.c, el.r) });
function drawnRange(seg) {
  if (Number.isFinite(seg.min)) return [0, 1];
  let lo = -Infinity, hi = Infinity;
  for (const [o, d, min, max] of [[seg.a.x, seg.b.x - seg.a.x, PLANE_BOX.x0, PLANE_BOX.x1], [seg.a.y, seg.b.y - seg.a.y, PLANE_BOX.y0, PLANE_BOX.y1]]) {
    if (Math.abs(d) < 1e-15) continue;
    const t1 = (min - o) / d, t2 = (max - o) / d;
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
  }
  return Number.isFinite(lo) && hi > lo ? [Math.min(lo, 0), Math.max(hi, 1)] : [0, 1];
}
function linePoints(el) {
  const seg = segmentOf(el), [lo, hi] = drawnRange(seg), n = el.ext ? 28 : 10, pts = [];
  for (let i = 0; i <= n; i++) { const t = lo + (hi - lo) * i / n; pts.push(screenOf(fromPlane({ x: seg.a.x + t * (seg.b.x - seg.a.x), y: seg.a.y + t * (seg.b.y - seg.a.y) }))); }
  return pts;
}
function circlePoints(el) {
  const k = circleOf(el), pts = [];
  for (let i = 0; i <= 96; i++) { const a = i / 96 * 2 * Math.PI; pts.push(screenOf(fromPlane({ x: k.c.x + k.r * Math.sin(a), y: k.c.y + k.r * Math.cos(a) }))); }
  return pts;
}
function intersections() {
  const lines = st.els.filter(e => e.t === 'l').map(segmentOf), circles = st.els.filter(e => e.t === 'c').map(circleOf), out = [];
  lines.forEach((s, i) => { for (const o of lines.slice(i + 1)) out.push(...lineLine(s, o)); for (const k of circles) out.push(...lineCircle(s, k)); });
  circles.forEach((k, i) => { for (const o of circles.slice(i + 1)) out.push(...circleCircle(k, o)); });
  return out.map(fromPlane).filter(inChart);
}
function snapAt(x, y, exceptId = null, instruments = true) {
  if (!st.snap) return null;
  const candidates = intersections();
  if (instruments && st.pro) candidates.push(st.pro.c);
  for (const el of st.els) {
    if (el.id === exceptId) continue;
    if (el.t === 'p') candidates.push(el.p); else if (el.t === 'l') candidates.push(el.a, el.b); else candidates.push(el.c);
  }
  let best = null, bestD = SNAP_RADIUS;
  for (const p of candidates) { const q = screenOf(p), d = Math.hypot(q.x - x, q.y - y); if (d < bestD) { bestD = d; best = p; } }
  return best ? { lat: best.lat, lon: best.lon } : null;
}
// Con el imán activo, una recta casi N–S, E–W o cuadrantal desde `from` queda exactamente alineada.
function aligned(from, pos) {
  if (!st.snap || distance(from, pos) < 1e-4) return pos;
  const brg = bearing(from, pos);
  return offCardinal(brg) < ALIGN_DEGREES ? destination(from, (Math.round(brg / 45) * 45) % 360, distance(from, pos)) : pos;
}
function distanceToPath(pts, x, y) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(a.x + t * dx - x, a.y + t * dy - y));
  }
  return best;
}
function elementAt(x, y) {
  let best = null, bestD = HIT_RADIUS;
  for (const el of st.els) if (el.t === 'p') { const q = screenOf(el.p), d = Math.hypot(q.x - x, q.y - y) - 4; if (d < bestD) { bestD = d; best = el; } }
  if (best) return best;
  for (const el of st.els) if (el.t !== 'p') { const d = distanceToPath(shapes.get(el.id) ?? [], x, y); if (d < bestD) { bestD = d; best = el; } }
  return best;
}

// ── Dibujo ────────────────────────────────────────────────────────────────────
const f1 = n => n.toFixed(1);
const pathOf = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p.x)} ${f1(p.y)}`).join('');
// Transportador: círculo graduado con el 000° al norte verdadero, de tamaño fijo en pantalla.
const proRadius = () => Math.min(230, Math.max(110, .38 * Math.min(view.clientWidth, view.clientHeight)));
function protractorSvg() {
  const c = screenOf(st.pro.c), R = proRadius(), every = R >= 140 ? 10 : 30;
  let fine = '', bold = '', labels = '';
  for (let d = 0; d < 360; d++) {
    const sx = Math.sin(d * DEG), sy = -Math.cos(d * DEG), len = d % 10 === 0 ? 14 : d % 5 === 0 ? 9 : 5;
    const tick = `M${f1(c.x + sx * R)} ${f1(c.y + sy * R)}L${f1(c.x + sx * (R - len))} ${f1(c.y + sy * (R - len))}`;
    if (d % 5) fine += tick; else bold += tick;
    if (d % every === 0) labels += `<text text-anchor="middle" x="${f1(c.x + sx * (R - 24))}" y="${f1(c.y + sy * (R - 24) + 3.5)}">${String(d).padStart(3, '0')}</text>`;
  }
  return `<g class="pro"><circle class="band" cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(R - 17)}"/><circle class="rim" cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(R)}"/><path class="fine" d="${fine}"/><path d="${bold}M${f1(c.x - 14)} ${f1(c.y)}H${f1(c.x + 14)}M${f1(c.x)} ${f1(c.y - 14)}V${f1(c.y + 14)}"/>${labels}<text class="north" text-anchor="middle" x="${f1(c.x)}" y="${f1(c.y - R - 7)}">N</text></g>`;
}
// Compás de puntas: la abertura es una longitud sobre el papel, como en la carta real.
function dividerOpening() { const A = toPlane(st.div.a), B = toPlane(st.div.b); return Math.hypot(B.x - A.x, B.y - A.y); }
const dividerMiles = () => dividerOpening() * Math.cos(st.div.a.lat * DEG) * 60 / DEG;
function dividerSvg() {
  const a = screenOf(st.div.a), b = screenOf(st.div.b), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
  const leg = Math.max(d * .75, 130), h = Math.sqrt(Math.max(leg * leg - d * d / 4, 900));
  let nx = -dy / d, ny = dx / d; if (ny > 0) { nx = -nx; ny = -ny; }
  const hx = (a.x + b.x) / 2 + nx * h, hy = (a.y + b.y) / 2 + ny * h;
  return `<g class="div${st.div.locked ? ' locked' : ''}"><path class="leg" d="M${f1(a.x)} ${f1(a.y)}L${f1(hx)} ${f1(hy)}L${f1(b.x)} ${f1(b.y)}"/><circle class="hinge" cx="${f1(hx)}" cy="${f1(hy)}" r="7"/><circle class="tip" cx="${f1(a.x)}" cy="${f1(a.y)}" r="2.5"/><circle class="tip" cx="${f1(b.x)}" cy="${f1(b.y)}" r="2.5"/></g>`;
}
function moveDivider(handle, x, y) {
  const dv = st.div, A = toPlane(dv.a), B = toPlane(dv.b);
  if (handle === 'da') {
    const pos = snapAt(x, y) ?? geoAt(x, y), P = toPlane(pos);
    if (dv.locked) dv.b = fromPlane({ x: P.x + B.x - A.x, y: P.y + B.y - A.y });
    dv.a = pos;
  } else if (dv.locked) {
    const q = toPlane(geoAt(x, y)), r = Math.hypot(B.x - A.x, B.y - A.y), d = Math.hypot(q.x - A.x, q.y - A.y) || 1;
    dv.b = fromPlane({ x: A.x + (q.x - A.x) * r / d, y: A.y + (q.y - A.y) * r / d });
  } else dv.b = snapAt(x, y) ?? geoAt(x, y);
}
const lineSummary = el => !st.auto ? '' : `${bearingText(bearing(el.a, el.b))}${el.ext ? '' : ` · ${formatMiles(distance(el.a, el.b))} M`}`;
function draw() {
  const out = [], handles = [];
  shapes.clear();
  if (st.pro) { out.push(protractorSvg()); if (st.tool === 'protractor' && !st.pro.pinned) handles.push(['pc', screenOf(st.pro.c)]); }
  for (const el of st.els) {
    const cls = `ink${el.id === st.sel ? ' sel' : ''}`;
    if (el.t === 'p') {
      const q = screenOf(el.p);
      out.push(`<g class="${cls}"><path d="M${f1(q.x - 10)} ${f1(q.y)}H${f1(q.x + 10)}M${f1(q.x)} ${f1(q.y - 10)}V${f1(q.y + 10)}"/><circle class="dot" cx="${f1(q.x)}" cy="${f1(q.y)}" r="3.5"/><text x="${f1(q.x + 9)}" y="${f1(q.y - 9)}">${esc(el.name)}</text></g>`);
      if (el.id === st.sel) handles.push(['p', q]);
    } else if (el.t === 'l') {
      const pts = linePoints(el), a = screenOf(el.a), b = screenOf(el.b), angle = Math.atan2(b.y - a.y, b.x - a.x), steep = Math.abs(Math.sin(angle)) > .6;
      shapes.set(el.id, pts);
      const head = [2.6, -2.6].map(k => `${f1(b.x - 11 * Math.cos(angle + k / 6.5))} ${f1(b.y - 11 * Math.sin(angle + k / 6.5))}`);
      out.push(`<g class="${cls}"><path d="${pathOf(pts)}"/><path class="solid" d="M${head[0]}L${f1(b.x)} ${f1(b.y)}L${head[1]}Z"/><circle class="dot" cx="${f1(a.x)}" cy="${f1(a.y)}" r="2.5"/><text text-anchor="${steep ? 'start' : 'middle'}" x="${f1((a.x + b.x) / 2 + (steep ? 10 : 0))}" y="${f1((a.y + b.y) / 2 + (steep ? 4 : -10 - 22 * Math.abs(Math.sin(angle))))}">${lineSummary(el)}</text></g>`);
      if (el.id === st.sel) handles.push(['a', a], ['b', b]);
    } else {
      const pts = circlePoints(el), c = screenOf(el.c), r = screenOf(destination(el.c, 90, el.r));
      shapes.set(el.id, pts);
      out.push(`<g class="${cls}"><path d="${pathOf(pts)}Z"/><path d="M${f1(c.x - 6)} ${f1(c.y)}H${f1(c.x + 6)}M${f1(c.x)} ${f1(c.y - 6)}V${f1(c.y + 6)}"/><text x="${f1(pts[0].x + 6)}" y="${f1(pts[0].y - 7)}">${st.auto ? formatMiles(el.r) + ' M' : ''}</text></g>`);
      if (el.id === st.sel) handles.push(['c', c], ['r', r]);
    }
  }
  for (const p of intersections()) {
    const q = screenOf(p);
    out.push(`<g class="cross"><circle cx="${f1(q.x)}" cy="${f1(q.y)}" r="4.5"/>${st.auto ? `<text x="${f1(q.x + 9)}" y="${f1(q.y + 15)}">${formatLat(p.lat)}<tspan x="${f1(q.x + 9)}" dy="13">${formatLon(p.lon)}</tspan></text>` : ''}</g>`);
  }
  if (st.pending) {
    const q = screenOf(st.pending);
    if (st.tool === 'line' && st.hover) { const h = screenOf(st.hover); out.push(`<path class="preview" d="M${f1(q.x)} ${f1(q.y)}L${f1(h.x)} ${f1(h.y)}"/>`); }
    out.push(`<circle class="pending" cx="${f1(q.x)}" cy="${f1(q.y)}" r="8"/><circle class="pending-dot" cx="${f1(q.x)}" cy="${f1(q.y)}" r="2.5"/>`);
  }
  if (st.div && st.tool === 'circle') { out.push(dividerSvg()); handles.push(['da', screenOf(st.div.a)], ['db', screenOf(st.div.b)]); }
  for (const [name, q] of handles) out.push(`<circle class="handle" data-h="${name}" cx="${f1(q.x)}" cy="${f1(q.y)}" r="11"/>`);
  ink.innerHTML = out.join('');
}

// ── Estado, historial y guardado ──────────────────────────────────────────────
const validPos = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) < 80 && Math.abs(p.lon) < 180;
function sanitize(saved) {
  const els = (Array.isArray(saved?.els) ? saved.els : []).filter(e => e && (e.t === 'p' ? validPos(e.p) && typeof e.name === 'string' : e.t === 'l' ? validPos(e.a) && validPos(e.b) : e.t === 'c' && validPos(e.c) && Number.isFinite(e.r) && e.r > 0)).slice(0, 200);
  els.forEach((e, i) => { e.id = i + 1; });
  const pos = p => ({ lat: p.lat, lon: p.lon });
  return { els, letter: Number.isInteger(saved?.letter) && saved.letter >= 0 ? saved.letter : els.filter(e => e.t === 'p').length,
    pro: validPos(saved?.pro?.c) ? { c: pos(saved.pro.c), pinned: !!saved.pro.pinned } : null,
    div: validPos(saved?.div?.a) && validPos(saved?.div?.b) ? { a: pos(saved.div.a), b: pos(saved.div.b), locked: !!saved.div.locked } : null,
    notes: typeof saved?.notes === 'string' ? saved.notes.slice(0, NOTES_MAX) : '' };
}
const snapshot = () => JSON.stringify({ els: st.els, letter: st.letter });
function save() { options.store.save({ els: st.els, letter: st.letter, pro: st.pro, div: st.div, notes: st.notes }); }
function commit(change) {
  st.history.push(snapshot()); if (st.history.length > 60) st.history.shift();
  change(); save(); refresh();
}
function undo() {
  const previous = st.history.pop(); if (!previous) return;
  const data = JSON.parse(previous);
  st.els = data.els; st.letter = data.letter; st.nextId = Math.max(0, ...st.els.map(e => e.id)) + 1;
  st.sel = null; st.pending = null; save(); refresh();
}
function add(el) { el.id = st.nextId++; st.els.push(el); st.sel = el.id; return el; }
function addPoint(p) { commit(() => add({ t: 'p', p, name: LETTERS[st.letter % 26] + (st.letter >= 26 ? Math.floor(st.letter / 26) + 1 : '') }) && st.letter++); }
const selected = () => st.els.find(e => e.id === st.sel) ?? null;
function refresh() { draw(); renderPanel(); syncControls(); }
function syncControls() {
  dlg.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === st.tool)));
  dlg.querySelector('[data-c="undo"]').disabled = !st.history.length;
  dlg.querySelector('[data-c="clear"]').disabled = !st.els.length;
  dlg.querySelector('[data-c="snap"]').setAttribute('aria-pressed', String(st.snap));
  dlg.querySelector('[data-c="auto"]').setAttribute('aria-pressed', String(st.auto));
  view.dataset.mode = st.tool;
}
function setTool(tool) {
  st.tool = tool; st.pending = null; st.hover = null; if (tool !== 'select') st.sel = null;
  const center = geoAt(view.clientWidth / 2, view.clientHeight / 2);
  if (tool === 'protractor' && !st.pro) { st.pro = { c: center, pinned: false }; save(); }
  if (tool === 'circle' && !st.div) { st.div = { a: center, b: destination(center, 90, 5), locked: false }; save(); }
  refresh();
}
function showPosition(p) { readout.textContent = p && st.auto && inChart(p) ? formatPosition(p) : 'Estrecho de Gibraltar · L105 enseñanza'; }

// ── Panel contextual ──────────────────────────────────────────────────────────
const field = (name, label, value, unit, width = 4, placeholder = '') => `<label class="chart-field"><span>${label}</span><span class="chart-input"><input name="${name}" inputmode="decimal" autocomplete="off" size="${width}" value="${esc(value)}" placeholder="${placeholder}"><i>${unit}</i></span></label>`;
function coordFields(p) {
  const parts = v => { let tenths = Math.round(Math.abs(v) * 600); const d = Math.floor(tenths / 600); return [d, ((tenths - d * 600) / 10).toFixed(1).replace('.', ',').padStart(4, '0')]; };
  const [latD, latM] = p ? parts(p.lat) : ['36', ''], [lonD, lonM] = p ? parts(p.lon) : ['5', ''];
  return `<div class="chart-coords"><span class="chart-coord">${field('latD', 'Latitud', latD, '°', 2)}${field('latM', '<span class="sr-only">Minutos de latitud</span>', latM, '′ N', 4, '00,0')}</span><span class="chart-coord">${field('lonD', 'Longitud', lonD, '°', 3)}${field('lonM', '<span class="sr-only">Minutos de longitud</span>', lonM, '′ W', 4, '00,0')}</span></div>`;
}
const error = '<p class="chart-error" role="alert" hidden></p>';
function renderPanel() {
  const el = selected(); let html;
  if (st.pending && st.tool === 'bearing') html = `<form data-f="bearing"><p class="chart-what"><b>Desde</b> ${formatPosition(st.pending)}</p><div class="chart-row">${field('brg', 'Rumbo o demora verdadera', '', '°', 5, '000')}${field('dist', 'Distancia (opcional)', '', 'M', 5)}</div><div class="chart-cardinals" role="group" aria-label="Rumbos cardinales">${CARDINALS.map((c, i) => `<button type="button" data-c="cardinal" data-v="${String(i * 45).padStart(3, '0')}">${c}</button>`).join('')}</div><label class="chart-check"><input type="checkbox" name="opp"><span>Trazar la opuesta: es la demora tomada desde el barco hacia este punto</span></label>${error}<div class="chart-actions"><button class="btn" type="submit">Trazar</button><button class="btn text" type="button" data-c="cancel">Cancelar</button></div></form>`;
  else if (st.pending && st.tool === 'circle') html = `<form data-f="circle"><p class="chart-what"><b>Centro</b> ${formatPosition(st.pending)}</p><div class="chart-row">${field('r', 'Distancia', '', 'millas', 5)}</div>${error}<div class="chart-actions"><button class="btn" type="submit">Trazar círculo</button><button class="btn text" type="button" data-c="cancel">Cancelar</button></div></form>`;
  else if (st.pending) html = `<p class="chart-what"><b>Desde</b> ${formatPosition(st.pending)}</p><p class="chart-hint">Ahora toca el segundo punto.</p><div class="chart-actions"><button class="btn text" type="button" data-c="cancel">Cancelar</button></div>`;
  else if (el && !st.auto) html = `<p class="chart-what"><b>${el.t === 'p' ? 'Punto ' + esc(el.name) : el.t === 'l' ? 'Recta' : 'Círculo'}</b></p><p class="chart-hint">Medidas ocultas: lee el ángulo en el transportador, la distancia con el compás sobre la escala de latitudes y la situación en los márgenes.</p>${el.t === 'l' ? `<label class="chart-check"><input type="checkbox" data-c="extend" ${el.ext ? 'checked' : ''}><span>Prolongar la recta hasta los bordes</span></label>` : ''}<div class="chart-actions">${el.t === 'l' ? '<button class="btn text" type="button" data-c="reverse">Invertir sentido</button>' : ''}<button class="btn text danger" type="button" data-c="delete">Eliminar</button></div>`;
  else if (el?.t === 'p') html = `<form data-f="move-point"><p class="chart-what"><b>Punto ${esc(el.name)}</b> ${formatPosition(el.p)}</p>${coordFields(el.p)}${error}<div class="chart-actions"><button class="btn secondary" type="submit">Mover aquí</button><button class="btn text danger" type="button" data-c="delete">Eliminar</button></div></form>`;
  else if (el?.t === 'l') {
    const brg = bearing(el.a, el.b), dist = distance(el.a, el.b);
    html = `<form data-f="edit-line"><dl class="chart-measures"><div><dt>Rumbo / demora verdadera</dt><dd>${bearingText(brg)}</dd></div><div><dt>Opuesta</dt><dd>${bearingText(norm360(brg + 180))}</dd></div><div><dt>Distancia</dt><dd>${formatMiles(dist, 2)} M</dd></div></dl><div class="chart-row">${field('brg', 'Rumbo', formatBearing(brg).slice(0, -1), '°', 5)}${field('dist', 'Distancia', formatMiles(dist, 2), 'M', 5)}</div><label class="chart-check"><input type="checkbox" name="ext" data-c="extend" ${el.ext ? 'checked' : ''}><span>Prolongar la recta hasta los bordes</span></label>${error}<div class="chart-actions"><button class="btn secondary" type="submit">Aplicar</button><button class="btn text" type="button" data-c="reverse">Invertir sentido</button><button class="btn text danger" type="button" data-c="delete">Eliminar</button></div></form>`;
  } else if (el?.t === 'c') html = `<form data-f="edit-circle"><p class="chart-what"><b>Círculo de ${formatMiles(el.r, 2)} millas</b> Centro ${formatPosition(el.c)}</p><div class="chart-row">${field('r', 'Distancia', formatMiles(el.r, 2), 'millas', 5)}</div>${error}<div class="chart-actions"><button class="btn secondary" type="submit">Aplicar</button><button class="btn text danger" type="button" data-c="delete">Eliminar</button></div></form>`;
  else if (st.tool === 'point') html = `<form data-f="add-point"><p class="chart-hint">Toca la carta para marcar un punto y leer su situación, o sitúalo por coordenadas:</p>${coordFields(null)}${error}<div class="chart-actions"><button class="btn secondary" type="submit">Situar punto</button></div></form>`;
  else if (st.tool === 'protractor') html = `<p class="chart-hint">El transportador queda sobre la carta con el 000° al norte verdadero. Arrastra su centro (o toca la carta) hasta un faro o tu situación, fíjalo y traza con la Regla desde el centro: el ángulo se lee donde la recta corta la graduación. Prolonga la recta si no llega.</p><div class="chart-actions"><button class="btn secondary" type="button" data-c="pro-pin" aria-pressed="${st.pro.pinned}">${st.pro.pinned ? 'Soltar' : 'Fijar en la carta'}</button><button class="btn text" type="button" data-c="pro-center">Traer aquí</button><button class="btn text danger" type="button" data-c="pro-remove">Quitar</button></div>`;
  else if (st.tool === 'circle') html = `<form data-f="divider"><p class="chart-hint">Abre el compás llevando sus dos puntas a la escala de latitudes del margen (1′ = 1 milla), fija la abertura, lleva la punta a un faro o a tu situación y traza.</p>${st.auto ? `<div class="chart-row">${field('r', 'Abertura', formatMiles(dividerMiles(), 2), 'millas', 5)}</div>` : ''}<label class="chart-check"><input type="checkbox" data-c="div-lock" ${st.div.locked ? 'checked' : ''}><span>Fijar la abertura: al mover una punta, el compás conserva la distancia</span></label>${error}<div class="chart-actions"><button class="btn" type="button" data-c="div-circle">Trazar círculo</button>${st.auto ? '<button class="btn secondary" type="submit">Aplicar abertura</button>' : ''}<button class="btn text" type="button" data-c="div-center">Traer aquí</button></div></form>`;
  else html = `<p class="chart-hint">${HINTS[st.tool]}</p>`;
  panel.innerHTML = html;
}
function fail(form, message) { const p = form.querySelector('.chart-error'); p.textContent = message; p.hidden = false; }
function readCoords(form) {
  const v = name => form.elements[name].value;
  const p = { lat: fromDegMin(v('latD'), v('latM'), false), lon: fromDegMin(v('lonD'), v('lonM'), true) };
  if (!validPos(p)) return fail(form, 'Escribe grados y minutos, por ejemplo 36° 05,0′ N y 005° 11,0′ W.');
  if (!inChart(p)) return fail(form, 'Esa situación queda fuera de la carta.');
  return p;
}
function readBearing(form) { const v = parseNumber(form.elements.brg.value); return Number.isFinite(v) && v >= 0 && v <= 360 ? v : fail(form, 'El rumbo o la demora debe estar entre 000° y 360°.'); }
function readMiles(form, name, optional = false) {
  const text = form.elements[name].value.trim(); if (optional && !text) return null;
  const v = parseNumber(text); return Number.isFinite(v) && v > 0 && v <= 120 ? v : fail(form, 'Escribe una distancia en millas mayor que 0.');
}
function onSubmit(e) {
  e.preventDefault();
  const form = e.target, kind = form.dataset.f, el = selected();
  if (kind === 'add-point') { const p = readCoords(form); if (!p) return; addPoint(p); reveal(p); }
  if (kind === 'move-point') { const p = readCoords(form); if (!p) return; commit(() => { el.p = p; }); reveal(p); }
  if (kind === 'bearing') {
    const brg = readBearing(form); if (brg === undefined) return;
    const dist = readMiles(form, 'dist', true); if (dist === undefined) return;
    const course = norm360(brg + (form.elements.opp.checked ? 180 : 0)), a = st.pending;
    commit(() => { add({ t: 'l', a, b: destination(a, course, dist ?? 5), ext: dist === null }); st.pending = null; });
  }
  if (kind === 'circle') { const r = readMiles(form, 'r'); if (r === undefined) return; const c = st.pending; commit(() => { add({ t: 'c', c, r }); st.pending = null; }); }
  if (kind === 'edit-line') { const brg = readBearing(form); if (brg === undefined) return; const dist = readMiles(form, 'dist'); if (dist === undefined) return; commit(() => { el.b = destination(el.a, brg, dist); }); }
  if (kind === 'divider') {
    const r = readMiles(form, 'r'); if (r === undefined) return;
    const A = toPlane(st.div.a), B = toPlane(st.div.b), d = Math.hypot(B.x - A.x, B.y - A.y), R = planeRadius(st.div.a, r);
    st.div.b = d ? fromPlane({ x: A.x + (B.x - A.x) * R / d, y: A.y + (B.y - A.y) * R / d }) : destination(st.div.a, 90, r);
    save(); refresh();
  }
  if (kind === 'edit-circle') { const r = readMiles(form, 'r'); if (r === undefined) return; commit(() => { el.r = r; }); }
}
function reveal(p) { const q = screenOf(p); if (q.x < 30 || q.y < 30 || q.x > view.clientWidth - 30 || q.y > view.clientHeight - 30) centerOn(p); }
function onControl(e) {
  const tool = e.target.closest('[data-tool]'); if (tool) { setTool(tool.dataset.tool); return; }
  const control = e.target.closest('[data-c]'); if (!control || control.disabled) return;
  const c = control.dataset.c, el = selected();
  if (c === 'close') closeChart();
  if (c === 'notes') { const open = !notesBox.classList.contains('open'); notesBox.classList.toggle('open', open); control.setAttribute('aria-expanded', String(open)); if (open) notesBox.querySelector('textarea').focus(); }
  if (c === 'undo') undo();
  if (c === 'clear') options.confirm('¿Borrar todos los trazos?', 'Se eliminarán los puntos, rectas y círculos de esta carta. Podrás recuperarlos con Deshacer mientras no la cierres.', 'Borrar todo', () => commit(() => { st.els = []; st.sel = null; st.pending = null; st.letter = 0; }), 'Cancelar');
  if (c === 'snap') { st.snap = !st.snap; syncControls(); }
  if (c === 'zoom-in') zoomAt(1.6);
  if (c === 'zoom-out') zoomAt(1 / 1.6);
  if (c === 'fit') fitView();
  if (c === 'auto') { st.auto = autoMeasures = !st.auto; try { localStorage.setItem(AUTO_KEY, st.auto ? '1' : '0'); } catch { /* Preferencia solo para esta sesión. */ } showPosition(null); refresh(); }
  if (c === 'pro-pin') { st.pro.pinned = !st.pro.pinned; save(); refresh(); }
  if (c === 'pro-remove') { st.pro = null; st.tool = 'select'; save(); refresh(); }
  if (c === 'pro-center') { st.pro.c = geoAt(view.clientWidth / 2, view.clientHeight / 2); st.pro.pinned = false; save(); refresh(); }
  if (c === 'div-lock') { st.div.locked = control.checked; save(); refresh(); }
  if (c === 'div-center') { const a = geoAt(view.clientWidth / 2, view.clientHeight / 2), A = toPlane(st.div.a), B = toPlane(st.div.b), P = toPlane(a); st.div.b = fromPlane({ x: P.x + B.x - A.x, y: P.y + B.y - A.y }); st.div.a = a; save(); refresh(); }
  if (c === 'div-circle') { const c0 = { ...st.div.a }, r = dividerMiles(); if (r > .01) commit(() => { add({ t: 'c', c: c0, r }); st.sel = null; }); }
  if (c === 'cardinal') { const input = control.form.elements.brg; input.value = control.dataset.v; input.focus({ preventScroll: true }); }
  if (c === 'cancel') { st.pending = null; st.hover = null; refresh(); }
  if (c === 'delete' && el) commit(() => { st.els = st.els.filter(x => x !== el); st.sel = null; });
  if (c === 'reverse' && el?.t === 'l') commit(() => { [el.a, el.b] = [el.b, el.a]; });
  if (c === 'extend' && el?.t === 'l') commit(() => { el.ext = control.checked; });
}

// ── Gestos sobre la carta ─────────────────────────────────────────────────────
const local = e => { const r = view.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function onTap(x, y) {
  const pos = snapAt(x, y) ?? (st.tool === 'line' && st.pending ? aligned(st.pending, geoAt(x, y)) : geoAt(x, y));
  showPosition(pos);
  if (st.tool === 'select') { st.sel = elementAt(x, y)?.id ?? null; refresh(); return; }
  if (!inChart(pos)) return;
  if (st.tool === 'protractor') { if (!st.pro.pinned) { st.pro.c = pos; save(); refresh(); } return; }
  if (st.tool === 'circle') { const A = toPlane(st.div.a), B = toPlane(st.div.b), P = toPlane(pos); st.div.b = fromPlane({ x: P.x + B.x - A.x, y: P.y + B.y - A.y }); st.div.a = pos; save(); refresh(); return; }
  if (st.tool === 'point') addPoint(pos);
  else if (st.tool === 'line' && st.pending) {
    const a = st.pending; if (distance(a, pos) < 1e-4) return;
    commit(() => { add({ t: 'l', a, b: pos, ext: false }); st.pending = null; st.hover = null; });
  } else { st.pending = pos; st.sel = null; refresh(); if (st.tool !== 'line') panel.querySelector('input')?.focus({ preventScroll: true }); }
}
function dragHandle(x, y) {
  if (gesture.touch) y -= TOUCH_LIFT;
  if (gesture.h === 'pc') { st.pro.c = snapAt(x, y, null, false) ?? geoAt(x, y); gesture.instrument = true; showPosition(st.pro.c); draw(); return; }
  if (gesture.h === 'da' || gesture.h === 'db') { moveDivider(gesture.h, x, y); gesture.instrument = true; readout.textContent = st.auto ? `Abertura ${formatMiles(dividerMiles(), 2)} millas` : 'Compás'; draw(); return; }
  const el = selected(); if (!el) return;
  const other = gesture.h === 'a' ? el.b : gesture.h === 'b' ? el.a : null;
  const pos = (gesture.h === 'r' ? null : snapAt(x, y, el.id)) ?? (other ? aligned(other, geoAt(x, y)) : geoAt(x, y));
  if (!gesture.changed) { st.history.push(snapshot()); gesture.changed = true; }
  if (gesture.h === 'p') { el.p = pos; readout.textContent = formatPosition(pos); }
  if (gesture.h === 'a' || gesture.h === 'b') { el[gesture.h] = pos; readout.textContent = `${bearingText(bearing(el.a, el.b))} · ${formatMiles(distance(el.a, el.b), 2)} M`; }
  if (gesture.h === 'c') { el.c = pos; readout.textContent = formatPosition(pos); }
  if (gesture.h === 'r') { el.r = Math.max(.05, distance(el.c, pos)); readout.textContent = `${formatMiles(el.r, 2)} millas`; }
  if (!st.auto) showPosition(null);
  draw();
}
function pinchState() { const [a, b] = [...pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function onPointerDown(e) {
  if (e.target.closest('.chart-zoom') || (e.pointerType === 'mouse' && e.button !== 0)) return;
  try { view.setPointerCapture(e.pointerId); } catch { /* El puntero ya no existe. */ }
  const p = local(e); pointers.set(e.pointerId, p);
  if (pointers.size === 1) gesture = { type: e.target.dataset?.h ? 'handle' : 'tap', h: e.target.dataset?.h, x: p.x, y: p.y, touch: e.pointerType === 'touch', changed: false };
  else if (pointers.size === 2) { if (gesture?.changed) { save(); renderPanel(); } gesture = { type: 'pinch', last: pinchState() }; }
}
function onPointerMove(e) {
  const p = local(e);
  if (!pointers.has(e.pointerId)) {
    if (e.pointerType !== 'mouse') return;
    const lining = st.tool === 'line' && st.pending, pos = snapAt(p.x, p.y) ?? (lining ? aligned(st.pending, geoAt(p.x, p.y)) : geoAt(p.x, p.y));
    if (lining) { st.hover = pos; if (st.auto) readout.textContent = `${bearingText(bearing(st.pending, pos))} · ${formatMiles(distance(st.pending, pos), 2)} M`; draw(); }
    else showPosition(pos);
    return;
  }
  const previous = pointers.get(e.pointerId); pointers.set(e.pointerId, p);
  if (!gesture) return;
  if (gesture.type === 'pinch' && pointers.size >= 2) {
    const now = pinchState(), before = { x: (gesture.last.x - st.tx) / st.s, y: (gesture.last.y - st.ty) / st.s };
    st.s = Math.min(MAX_SCALE, Math.max(fitScale() * .9, st.s * now.d / gesture.last.d));
    st.tx = now.x - before.x * st.s; st.ty = now.y - before.y * st.s; gesture.last = now; applyView();
  } else if (gesture.type === 'handle') {
    if (gesture.changed || Math.hypot(p.x - gesture.x, p.y - gesture.y) > 3) dragHandle(p.x, p.y);
  } else {
    if (gesture.type === 'tap' && Math.hypot(p.x - gesture.x, p.y - gesture.y) > TAP_SLOP) gesture.type = 'pan';
    if (gesture.type === 'pan') { st.tx += p.x - previous.x; st.ty += p.y - previous.y; applyView(); }
  }
}
function onPointerUp(e) {
  if (!pointers.has(e.pointerId)) return;
  const p = local(e); pointers.delete(e.pointerId);
  const g = gesture;
  if (pointers.size) { gesture = { type: 'pan' }; return; }
  gesture = null;
  if (!g || e.type === 'pointercancel') { if (g?.changed || g?.instrument) { save(); refresh(); } return; }
  if (g.type === 'tap') onTap(p.x, p.y);
  if (g.type === 'handle') { if (g.changed || g.instrument) { save(); refresh(); } }
}
function onWheel(e) {
  e.preventDefault();
  const p = local(e);
  zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .012 : e.deltaMode ? .05 : .0018)), p.x, p.y);
}
function onKey(e) {
  if (e.target.closest('input,textarea')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const step = 60;
  if (e.key === '+' || e.key === '=') zoomAt(1.4);
  else if (e.key === '-') zoomAt(1 / 1.4);
  else if (e.key === '0') fitView();
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selected() && !e.target.closest('button')) { const el = selected(); commit(() => { st.els = st.els.filter(x => x !== el); st.sel = null; }); }
  else if (e.target === view && e.key.startsWith('Arrow')) { st.tx += e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0; st.ty += e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0; applyView(); }
  else return;
  e.preventDefault();
}

// ── Montaje ───────────────────────────────────────────────────────────────────
function mount() {
  dlg = document.createElement('dialog');
  dlg.id = 'chart'; dlg.className = 'chart'; dlg.setAttribute('aria-label', 'Carta del Estrecho de Gibraltar');
  dlg.innerHTML = `<header class="chart-bar"><button type="button" class="btn secondary" data-c="close">← Volver</button><div class="chart-title"><b></b><span class="chart-readout" aria-live="off"></span></div><button type="button" class="btn text" data-c="undo" aria-label="Deshacer el último cambio">↶ <span>Deshacer</span></button><button type="button" class="btn text" data-c="clear">Borrar <span>todo</span></button></header>
<details class="chart-question"><summary>Enunciado</summary><div></div></details>
<div class="chart-view" tabindex="0" role="application" aria-label="Carta. Arrastra para moverla, pellizca o usa más y menos para ampliar."><div class="chart-world"><img class="chart-base" src="assets/chart/0.webp?v=${TILES_VERSION}" width="${CHART.width}" height="${CHART.height}" alt="Carta L105 de enseñanza: Estrecho de Gibraltar, de Cabo Roche a Punta de la Chullera y de Cabo Espartel a Cabo Negro." draggable="false"></div><svg class="chart-ink" aria-hidden="true"></svg><div class="chart-zoom"><button type="button" data-c="zoom-in" aria-label="Ampliar">+</button><button type="button" data-c="zoom-out" aria-label="Reducir">−</button><button type="button" data-c="fit" aria-label="Ver la carta entera">⤢</button><button type="button" data-c="snap" aria-pressed="true" aria-label="Imán: ajustar a puntos y cruces" title="Imán: ajustar a puntos y cruces">⌖</button><button type="button" class="chart-auto" data-c="auto" aria-pressed="true" aria-label="Mostrar medidas automáticas" title="Medidas automáticas: desactívalo para leer tú en el transportador y las escalas">12°</button></div></div>
<section class="chart-panel" aria-label="Útil y medidas"></section>
<section class="chart-notes"><button type="button" class="chart-notes-toggle" data-c="notes" aria-expanded="false" aria-controls="chart-notes-text">Notas</button><textarea id="chart-notes-text" aria-label="Notas de esta pregunta" maxlength="${NOTES_MAX}" spellcheck="false" placeholder="Apunta aquí tus cálculos: Ct = dm + desvío, Ra = Rv − Ct…"></textarea></section>
<div class="chart-tools" role="toolbar" aria-label="Útiles de trazado">${TOOLS.map(([id, label, svg]) => `<button type="button" data-tool="${id}" aria-pressed="false">${svg}<span>${label}</span></button>`).join('')}</div>
<p class="chart-legal">Carta de enseñanza. No válida para la navegación. 1 milla = 1′ de latitud.</p>`;
  document.body.append(dlg);
  view = dlg.querySelector('.chart-view'); world = dlg.querySelector('.chart-world'); ink = dlg.querySelector('.chart-ink'); panel = dlg.querySelector('.chart-panel'); readout = dlg.querySelector('.chart-readout'); notesBox = dlg.querySelector('.chart-notes');
  notesBox.addEventListener('input', e => { if (st) { st.notes = e.target.value; save(); } });
  dlg.addEventListener('click', onControl);
  dlg.addEventListener('submit', onSubmit);
  dlg.addEventListener('keydown', onKey);
  dlg.addEventListener('cancel', e => { if (st?.pending) { e.preventDefault(); st.pending = null; st.hover = null; refresh(); } });
  dlg.addEventListener('close', () => { if (st) lastView = { s: st.s, tx: st.tx, ty: st.ty, w: view.clientWidth, h: view.clientHeight }; pointers.clear(); gesture = null; st = null; options?.onClose?.(); });
  view.addEventListener('pointerdown', onPointerDown);
  view.addEventListener('pointermove', onPointerMove);
  view.addEventListener('pointerup', onPointerUp);
  view.addEventListener('pointercancel', onPointerUp);
  view.addEventListener('pointerleave', () => { if (st && !pointers.size && st.hover) { st.hover = null; draw(); } });
  view.addEventListener('wheel', onWheel, { passive: false });
  new ResizeObserver(() => { if (st && dlg.open && view.clientWidth) applyView(); }).observe(view);
}
export function isChartOpen() { return !!dlg?.open; }
export function closeChart() { if (dlg?.open) dlg.close(); }
/**
 * Abre la carta. `store` = {load(), save(data)} guarda los trazos; `confirm` muestra el
 * diálogo de confirmación de la app; `question` (opcional) deja el enunciado a mano.
 */
export function openChart(opts) {
  if (!dlg) mount();
  if (dlg.open) return;
  options = opts;
  const data = sanitize(opts.store.load());
  st = { els: data.els, letter: data.letter, pro: data.pro, div: data.div, notes: data.notes, auto: autoMeasures, nextId: data.els.length + 1, sel: null, tool: 'select', pending: null, hover: null, snap: true, history: [], s: 1, tx: 0, ty: 0 };
  dlg.querySelector('.chart-title b').textContent = opts.title;
  const details = dlg.querySelector('.chart-question');
  details.hidden = !opts.question; details.open = matchMedia('(min-width:900px)').matches;
  if (opts.question) details.lastElementChild.innerHTML = `<p>${esc(opts.question.text)}</p><ol>${opts.question.options.map(o => `<li><b>${esc(o.key.toUpperCase())}</b> ${esc(o.text)}</li>`).join('')}</ol>`;
  notesBox.querySelector('textarea').value = st.notes;
  notesBox.classList.toggle('open', !!st.notes); notesBox.firstElementChild.setAttribute('aria-expanded', String(!!st.notes));
  dlg.showModal();
  if (lastView && lastView.w === view.clientWidth && lastView.h === view.clientHeight) Object.assign(st, { s: lastView.s, tx: lastView.tx, ty: lastView.ty }); else { st.s = Math.max(fitScale(), view.clientHeight / CHART.height); st.tx = (view.clientWidth - CHART.width * st.s) / 2; }
  showPosition(null); applyView(); refresh();
  view.focus({ preventScroll: true });
}
