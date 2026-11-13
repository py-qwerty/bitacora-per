// Pomodoro simplificado: widget flotante global, fuera de <main>, que sobrevive a la navegación interna.
// Estado en localStorage con marcas de tiempo absolutas, así sigue contando al recargar o con la pestaña en segundo plano.
const KEY = 'bitacora-per:v1:pomodoro';
const MODES = { work: { label: 'Estudio', min: 25 }, rest: { label: 'Descanso', min: 5 } };
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

let state = load();
let tick = null;
const baseTitle = document.title;

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && MODES[s.mode]) return s; } catch {}
  return { mode: 'work', running: false, left: MODES.work.min * 60, end: 0, open: false, done: 0 };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
const remaining = () => state.running ? Math.max(0, Math.ceil((state.end - Date.now()) / 1000)) : state.left;

const root = document.createElement('div');
root.className = 'pomo';
root.innerHTML = `
  <button type="button" class="pomo-pill" aria-expanded="false" aria-controls="pomo-panel" aria-label="Pomodoro">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>
    <span class="pomo-time">25:00</span>
  </button>
  <section class="pomo-panel" id="pomo-panel" aria-label="Pomodoro" hidden>
    <p class="pomo-mode"></p>
    <p class="pomo-big" role="timer" aria-live="off">25:00</p>
    <div class="pomo-actions">
      <button type="button" class="btn" data-p="toggle">Iniciar</button>
      <button type="button" class="btn secondary" data-p="reset">Reiniciar</button>
      <button type="button" class="btn secondary" data-p="skip">Cambiar</button>
    </div>
    <p class="pomo-count small"></p>
    <p class="pomo-announce sr-only" role="status"></p>
  </section>`;
document.body.appendChild(root);

const $ = s => root.querySelector(s);
const pill = $('.pomo-pill'), panel = $('.pomo-panel');

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}

function finish() {
  const wasWork = state.mode === 'work';
  if (wasWork) state.done += 1;
  state.mode = wasWork ? 'rest' : 'work';
  state.running = false;
  state.left = MODES[state.mode].min * 60;
  save(); stopTick(); beep();
  $('.pomo-announce').textContent = wasWork ? 'Pomodoro completado. Toca descansar.' : 'Descanso terminado. A estudiar.';
  root.classList.add('pomo-alert');
  render();
}

function render() {
  const left = remaining();
  const t = fmt(left);
  $('.pomo-time').textContent = t;
  $('.pomo-big').textContent = t;
  $('.pomo-mode').textContent = MODES[state.mode].label;
  $('[data-p=toggle]').textContent = state.running ? 'Pausar' : (left < MODES[state.mode].min * 60 ? 'Seguir' : 'Iniciar');
  $('.pomo-count').textContent = `${state.done} ${state.done === 1 ? 'pomodoro completado' : 'pomodoros completados'}`;
  root.dataset.mode = state.mode;
  root.classList.toggle('running', state.running);
  pill.setAttribute('aria-expanded', String(state.open));
  pill.setAttribute('aria-label', `Pomodoro, ${MODES[state.mode].label}, ${t}${state.running ? '' : ', en pausa'}`);
  panel.hidden = !state.open;
  document.title = state.running ? `${t} · ${baseTitle}` : baseTitle;
}

function startTick() { stopTick(); tick = setInterval(() => { if (remaining() <= 0) finish(); else render(); }, 500); }
function stopTick() { clearInterval(tick); tick = null; }

root.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  root.classList.remove('pomo-alert');
  if (b === pill) { state.open = !state.open; save(); render(); return; }
  const a = b.dataset.p;
  if (a === 'toggle') {
    if (state.running) { state.left = remaining(); state.running = false; stopTick(); }
    else { state.end = Date.now() + state.left * 1000; state.running = true; startTick(); }
  } else if (a === 'reset') {
    state.running = false; stopTick(); state.left = MODES[state.mode].min * 60;
  } else if (a === 'skip') {
    state.running = false; stopTick(); state.mode = state.mode === 'work' ? 'rest' : 'work'; state.left = MODES[state.mode].min * 60;
  }
  save(); render();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.open && root.contains(document.activeElement)) { state.open = false; save(); render(); pill.focus(); }
});
// Sincroniza varias pestañas abiertas.
window.addEventListener('storage', e => {
  if (e.key !== KEY) return;
  state = load();
  state.running ? startTick() : stopTick();
  render();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.running) { if (remaining() <= 0) finish(); else render(); } });

if (state.running) { if (remaining() <= 0) finish(); else startTick(); }
render();
