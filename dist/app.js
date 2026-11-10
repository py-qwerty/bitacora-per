import { openChart, closeChart, isChartOpen } from './chart.js?v=3';
import { QUOTAS, LIMITS, DURATION, RULES_URL, generateExam, gradeExam, remaining, formatTime, isValidSession, practiceBlocks, validPractice, swipeDirection, validateTema } from './core.js?v=7';
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = n => n.toLocaleString('es-ES');
const PREFIX = 'bitacora-per:v1:';
const memory = new Map();
let storageFailed = false;
function warnStorage() {
  storageFailed = true;
  $('#notice').hidden = false;
  $('#notice').textContent = 'No se puede guardar el progreso en este navegador. Puedes continuar, pero se perderá al cerrar esta página.';
}
function read(key, fallback = null) {
  if (storageFailed && memory.has(key)) return memory.get(key);
  try { const value = localStorage.getItem(PREFIX + key); return value ? JSON.parse(value) : memory.get(key) ?? fallback; }
  catch { warnStorage(); return memory.get(key) ?? fallback; }
}
function write(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
  catch { warnStorage(); }
}
const chartMemory = new Map();
let bank, explanations = null, questionMap, practiceMap, temaIndex = new Map(), temaCache = new Map(), timer, session = null, reviewFilter = 'errors', reviewPage = 0;
const main = $('#main');
const seenIds = () => { const ids = read('seen', []); return new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []); };
const currentRoute = () => {
  const [path, query = ''] = (location.hash.slice(1) || '/temas').split('?');
  return { path, params: new URLSearchParams(query) };
};
const topicTitle = n => bank.topics.find(t => t.id === n)?.title ?? `Tema ${n}`;
const topicBadge = n => `<span class="topic-tag">UT ${n}</span>`;
function eyebrow(text) { return `<p class="eyebrow">${text}</p>`; }
function heading(title, text, tag = 'TU CUADERNO DE NAVEGACIÓN') {
  return `<div class="page-heading"><h1>${title}</h1>${text ? `<p class="lead">${text}</p>` : ''}</div>`;
}
function explanation(q) {
  const e = explanations?.[q.id];
  if (!e) return explanations ? '' : '<p class="explanation-note">Cargando explicación…</p>';
  return `<section class="explanation" aria-label="Explicación"><h3>Por qué</h3><ul>${q.options.map(o => `<li class="${o.key === q.correct ? 'is-correct' : ''}"><b>${o.key.toUpperCase()} ${o.key === q.correct ? '✓ Correcta' : '✕ Incorrecta'}</b><span>${esc(e[o.key])}</span></li>`).join('')}</ul>${e.review ? `<p class="explanation-note">⚠ ${esc(e.review)}</p>` : ''}</section>`;
}
function questionImage(q) { return q.image ? `<figure class="question-image"><img src="${esc(q.image)}" width="600" height="360" loading="lazy" alt="Ilustración del enunciado. Consulta los detalles de la imagen para resolver la pregunta."><figcaption>Imagen original del banco de preguntas</figcaption></figure>` : ''; }
// ── Temas para estudiar ───────────────────────────────────────────────────────
// Progreso de lectura: apartados estudiados y último apartado visto (solo en este navegador).
const STUDY_SKIP = new Set(['resumen', 'glosario']);
const temaProgress = n => { const v = read('tema:' + n, null); const studied = {}; if (v && typeof v === 'object' && v.studied && typeof v.studied === 'object') for (const [k, x] of Object.entries(v.studied)) if (x === true) studied[k] = true; return { studied, last: v && typeof v.last === 'string' ? v.last : '' }; };
const saveTemaProgress = (n, p) => write('tema:' + n, { studied: p.studied, last: p.last, at: Date.now() });
function toggleStudied(n, id) { const p = temaProgress(n); if (p.studied[id]) delete p.studied[id]; else p.studied[id] = true; saveTemaProgress(n, p); return !!p.studied[id]; }
const studiedTotal = (n, max) => Math.min(max ?? Infinity, Object.keys(temaProgress(n).studied).filter(k => !STUDY_SKIP.has(k)).length);
const rich = value => esc(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
function loadTema(n) {
  if (!temaIndex.has(n)) return null;
  const cached = temaCache.get(n); if (cached) return cached;
  const entry = { status: 'loading', data: null }; temaCache.set(n, entry);
  fetch(`temas/${n}.json?v=${encodeURIComponent(bank.version)}`, { signal: AbortSignal.timeout(15000) })
    .then(r => { if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); })
    .then(data => { validateTema(data, bank); entry.status = 'ready'; entry.data = data; })
    .catch(() => { entry.status = 'error'; })
    .finally(() => { if (currentRoute().path === `/tema/${n}/estudio`) render(false); });
  return entry;
}
const sectionHref = (n, id) => `#/tema/${n}/estudio?apartado=${encodeURIComponent(id)}`;
function temaBlock(b) {
  const title = b.title ? `<h4>${rich(b.title)}</h4>` : '';
  switch (b.type) {
    case 'p': return `<p>${rich(b.text)}</p>`;
    case 'analogy': return `<aside class="tb tb-analogy"><span class="tb-label">Imagínalo así</span>${title}<p>${rich(b.text)}</p></aside>`;
    case 'term': return `<dl class="tb tb-term"><dt>${rich(b.term)}</dt><dd>${rich(b.text)}</dd></dl>`;
    case 'list': return `<div class="tb-list">${title}<ul>${b.items.map(i => `<li>${rich(i)}</li>`).join('')}</ul></div>`;
    case 'steps': return `<div class="tb-list">${title}<ol class="tb-steps">${b.items.map(i => `<li>${rich(i)}</li>`).join('')}</ol></div>`;
    case 'table': return `<div class="tb-table">${title}<div class="table-wrap"><table><thead><tr>${b.head.map(h => `<th scope="col">${rich(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${rich(c)}</th>` : `<td>${rich(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    case 'example': return `<aside class="tb tb-example"><span class="tb-label">Ejemplo</span>${title}<p>${rich(b.text)}</p></aside>`;
    case 'exam': return `<aside class="tb tb-exam"><span class="tb-label">Así cae en el test</span>${title}<p>${rich(b.text)}</p></aside>`;
    case 'key': return `<aside class="tb tb-key"><span class="tb-label">Idea clave</span><p>${rich(b.text)}</p></aside>`;
    default: return '';
  }
}
// Preguntas del banco de cada apartado: se elige una opción y se corrige al instante.
const tqPicked = new Map();
const TQ_HINT = '<p class="tq-hint">Elige una opción y verás al instante si es correcta.</p>';
function tqResult(q, key) {
  const ok = key === q.correct, right = q.options.find(o => o.key === q.correct), e = explanations?.[q.id];
  return `<div class="tq-verdict ${ok ? 'is-ok' : 'is-bad'}"><b>${ok ? 'Correcto' : 'No es esa'}</b><span>${ok ? 'Esta es la opción correcta.' : `La correcta es la ${q.correct.toUpperCase()}: ${esc(right?.text || '')}`}</span></div>${e ? `<div class="tq-why">${ok ? '' : `<p>${esc(e[key])}</p>`}<p>${esc(e[q.correct])}</p>${e.review ? `<p class="tq-doubt"><b>Para revisar:</b> ${esc(e.review)}</p>` : ''}</div>` : ''}<button type="button" class="tq-retry" data-action="tq-retry" data-q="${esc(q.id)}">Volver a intentarlo</button>`;
}
function temaQuestion(q, number) {
  const picked = tqPicked.get(q.id), done = picked ? (picked === q.correct ? 'ok' : 'bad') : '';
  return `<details class="tq${done ? ` tq-${done}` : ''}" id="pregunta-${esc(q.id)}" data-q="${esc(q.id)}"><summary><span class="tq-number">${number}</span><span class="tq-text">${esc(q.text)}</span></summary><div class="tq-body">${questionImage(q)}<div class="tq-options" role="group" aria-label="Opciones de respuesta">${q.options.map(o => `<button type="button" class="tq-opt${picked === o.key ? ' is-picked' : ''}${picked && o.key === q.correct ? ' is-right' : ''}" data-action="tq-pick" data-q="${esc(q.id)}" data-key="${o.key}" aria-pressed="${picked === o.key}"${picked ? ' disabled' : ''}><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}</span></button>`).join('')}</div><div class="tq-result" aria-live="polite">${picked ? tqResult(q, picked) : TQ_HINT}</div></div></details>`;
}
function tqRefresh(id) {
  const el = document.getElementById('pregunta-' + id); if (!el) return;
  const q = questionMap.get(id), picked = tqPicked.get(id), done = picked ? (picked === q.correct ? 'ok' : 'bad') : '';
  el.classList.remove('tq-ok', 'tq-bad'); if (done) el.classList.add('tq-' + done);
  el.querySelectorAll('.tq-opt').forEach(b => { const k = b.dataset.key; b.classList.toggle('is-picked', picked === k); b.classList.toggle('is-right', !!picked && k === q.correct); b.setAttribute('aria-pressed', String(picked === k)); b.disabled = !!picked; });
  el.querySelector('.tq-result').innerHTML = picked ? tqResult(q, picked) : TQ_HINT;
  const panel = el.closest('.tema-section-questions'), count = panel?.querySelector('.tq-count');
  if (count) { const tried = panel.querySelectorAll('.tq-ok,.tq-bad').length; count.textContent = tried ? `${panel.querySelectorAll('.tq-ok').length}/${panel.querySelectorAll('.tq').length}` : String(panel.querySelectorAll('.tq').length); }
}
const sectionQuestions = (tema, id) => bank.questions.filter(q => q.topic === tema.topic && tema.questions[q.id] === id).sort((a, b) => a.test.localeCompare(b.test, 'es', { numeric: true }) || a.order - b.order);
// Las preguntas de un apartado se pintan al desplegarlo: algunos temas tienen cientos.
function fillSectionQuestions(details) {
  const body = details.querySelector('.tema-qs-body'); if (!details.open || body.childElementCount) return;
  const tema = temaCache.get(Number(details.dataset.topic))?.data; if (!tema) return;
  body.innerHTML = sectionQuestions(tema, details.dataset.section).map((q, i) => temaQuestion(q, i + 1)).join('');
}
function temaPage(n) {
  if (!bank.topics.some(t => t.id === n) || !temaIndex.has(n)) return notFound();
  const entry = loadTema(n), back = `<a class="back-link" href="#/tema/${n}">← Tests de ${esc(topicTitle(n))}</a>`;
  if (entry.status === 'loading') return `${back}<div class="loading"><span class="spinner" aria-hidden="true"></span><p>Cargando el tema…</p></div>`;
  if (entry.status === 'error') return `${back}${heading('No se ha podido cargar el tema.', 'Comprueba tu conexión y vuelve a intentarlo.')}<button class="btn" data-action="tema-retry" data-topic="${n}">Volver a intentarlo</button>`;
  const t = entry.data, total = bank.questions.filter(q => q.topic === n).length;
  const counts = new Map(t.sections.map(s => [s.id, 0])); for (const id of Object.values(t.questions)) counts.set(id, counts.get(id) + 1);
  const prog = temaProgress(n), ids = t.sections.map(s => s.id), doneN = ids.filter(i => prog.studied[i]).length, lastIdx = ids.indexOf(prog.last);
  const progress = `<div class="tema-progress"><p class="tema-progress-text"><b>${doneN}</b> de ${ids.length} apartados estudiados</p><progress max="${ids.length}" value="${doneN}" aria-label="Apartados estudiados"></progress>${lastIdx >= 0 ? `<a class="btn secondary tema-resume" href="${sectionHref(n, prog.last)}" data-resume="${esc(prog.last)}">Continuar donde lo dejaste · apartado ${lastIdx + 1}</a>` : ''}</div>`;
  return `${back}<header class="tema-hero"><div class="tema-hero-main"><p class="tema-kicker">Unidad ${n} · Temario</p><h1>${esc(t.title)}</h1><ul class="tema-facts"><li><b>${t.sections.length}</b> apartados</li>${t.minutes ? `<li><b>${t.minutes}</b> min de lectura</li>` : ''}<li><b>${total}</b> preguntas del banco cubiertas</li></ul><p class="tema-why">${rich(t.intro.why)}</p>${progress}</div>${t.intro.before || t.intro.goals ? `<div class="tema-intro">${t.intro.before ? `<section class="tema-before"><h2>Antes de empezar</h2><ul>${t.intro.before.map(i => `<li>${rich(i)}</li>`).join('')}</ul></section>` : ''}${t.intro.goals ? `<section class="tema-goals"><h2>Al terminar sabrás</h2><ul>${t.intro.goals.map(i => `<li>${rich(i)}</li>`).join('')}</ul></section>` : ''}</div>` : ''}</header>
<div class="tema-layout"><nav class="tema-index" aria-label="Apartados del tema"><details open><summary>Apartados</summary><ol>${t.sections.map((s, i) => `<li data-section-li="${esc(s.id)}"${prog.studied[s.id] ? ' class="is-studied"' : ''}><a href="${sectionHref(n, s.id)}" data-section="${esc(s.id)}"><span class="tema-index-number">${i + 1}</span><span>${esc(s.title)}</span>${counts.get(s.id) ? `<small>${counts.get(s.id)} preg.</small>` : ''}<span class="tema-index-done" aria-hidden="true">✓</span></a></li>`).join('')}<li><a href="${sectionHref(n, 'resumen')}" data-section="resumen"><span class="tema-index-number">✓</span><span>Resumen</span></a></li><li><a href="${sectionHref(n, 'glosario')}" data-section="glosario"><span class="tema-index-number">Aa</span><span>Glosario</span></a></li></ol></details><a class="btn secondary full" href="#/tema/${n}">Tests del tema →</a>${n === 11 ? '<button type="button" class="btn secondary full" data-action="open-chart">Abrir la carta</button>' : ''}</nav>
<article class="tema-body">${t.sections.map((s, i) => `<section class="tema-section" id="apartado-${esc(s.id)}" aria-labelledby="titulo-${esc(s.id)}"><div class="tema-section-content"><header class="tema-section-head"><span class="tema-section-number" aria-hidden="true">${i + 1}</span><div><h2 id="titulo-${esc(s.id)}"><span class="sr-only">Apartado ${i + 1}. </span>${esc(s.title)}</h2>${counts.get(s.id) ? `<p class="tema-section-meta"><span>${counts.get(s.id)} ${counts.get(s.id) === 1 ? 'pregunta' : 'preguntas'} del banco</span></p>` : ''}</div></header>${s.blocks.map(temaBlock).join('')}<div class="studied-row"><button type="button" class="studied-toggle" data-action="tema-studied" data-topic="${n}" data-section="${esc(s.id)}" aria-pressed="${prog.studied[s.id] ? 'true' : 'false'}"><span class="studied-box" aria-hidden="true"></span>He estudiado este apartado</button></div></div>${counts.get(s.id) ? `<aside class="tema-section-questions" aria-label="Preguntas del apartado ${i + 1}"><details class="tema-qs" data-topic="${n}" data-section="${esc(s.id)}"><summary><span>Pon a prueba este apartado</span><span class="tq-count">${counts.get(s.id)}</span></summary><p class="small">Todas las preguntas del banco que se responden con este apartado. Elige una opción y comprueba al momento si aciertas.</p><div class="tema-qs-body"></div></details></aside>` : ''}</section>`).join('')}
<section class="tema-section tema-summary" id="apartado-resumen"><div class="tema-section-content"><h2>Resumen: lo que tienes que saber</h2><ul>${t.summary.map(i => `<li>${rich(i)}</li>`).join('')}</ul></div></section>
<section class="tema-section tema-glossary-section" id="apartado-glosario"><div class="tema-section-content"><h2>Glosario</h2><dl class="tema-glossary">${t.glossary.map(g => `<div><dt>${rich(g.term)}</dt><dd>${rich(g.text)}</dd></div>`).join('')}</dl></div></section>
<p class="local-note">Explicación propia para repasar, redactada con ayuda de inteligencia artificial a partir del temario y de las preguntas del banco. Puede contener errores: ante la duda manda la normativa vigente.</p></article></div>`;
}
function temaCard(n) {
  if (!temaIndex.has(n)) return '';
  const info = temaIndex.get(n), p = temaProgress(n), done = studiedTotal(n, info.sections), href = p.last ? sectionHref(n, p.last) : `#/tema/${n}/estudio`;
  return `<section class="tema-card" aria-labelledby="tema-card-title"><h2 id="tema-card-title">Estudiar el tema</h2><p>Explicado paso a paso, con los datos que preguntan en el examen y todas las preguntas del banco repartidas por apartados.</p><p class="material-meta">${info.sections} apartados${info.minutes ? ` · ${info.minutes} min de lectura` : ''}${done ? ` · ${done} estudiados` : ''}</p><a class="btn" href="${href}">${p.last || done ? 'Continuar el tema →' : 'Estudiar el tema →'}</a></section>`;
}
function temarioPage() {
  return `${heading('Temario', 'Las once unidades explicadas para repasar, con todas las preguntas del banco cubiertas.')}<section class="topic-list" aria-label="Temas para estudiar">${bank.topics.map(t => {
    const info = temaIndex.get(t.id), done = info ? studiedTotal(t.id, info.sections) : 0, title = t.id === 6 ? 'Reglamento de abordajes' : t.title;
    return info ? `<a class="topic-card" href="${temaProgress(t.id).last ? sectionHref(t.id, temaProgress(t.id).last) : `#/tema/${t.id}/estudio`}"><span class="unit-number">${String(t.id).padStart(2, '0')}</span><div><h2>${esc(title)}</h2><p>${info.sections} apartados${info.minutes ? ` · ${info.minutes} min` : ''}${done ? ` · ${done}/${info.sections} estudiados` : ''}</p></div><span class="row-arrow" aria-hidden="true">›</span></a>` : `<div class="topic-card is-empty"><span class="unit-number">${String(t.id).padStart(2, '0')}</span><div><h2>${esc(title)}</h2><p>Tema todavía no disponible</p></div></div>`;
  }).join('')}</section><p class="local-note">Los apartados que marcas como estudiados se guardan solo en este navegador.</p>`;
}
function markCurrentSection(save = false) {
  const index = document.querySelector?.('.tema-index'); if (!index) return;
  const sections = [...document.querySelectorAll('.tema-section[id^="apartado-"]')]; if (!sections.length) return;
  const line = innerHeight * .3; let current = sections[0], reached = false;
  for (const s of sections) { if (s.getBoundingClientRect().top <= line) { current = s; reached = true; } else break; }
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) { current = sections[sections.length - 1]; reached = true; }
  const id = current.id.slice(9), link = index.querySelector(`a[data-section="${CSS.escape(id)}"]`);
  if (!link || link.getAttribute('aria-current')) return;
  index.querySelectorAll('a[aria-current]').forEach(a => a.removeAttribute('aria-current')); link.setAttribute('aria-current', 'location');
  if (save && reached && !STUDY_SKIP.has(id)) { const m = currentRoute().path.match(/^\/tema\/(\d+)\/estudio$/); if (m) { const p = temaProgress(Number(m[1])); if (p.last !== id) { p.last = id; saveTemaProgress(Number(m[1]), p); } } }
  if (index.scrollHeight > index.clientHeight) { const top = link.offsetTop - index.offsetTop, bottom = top + link.offsetHeight; if (top < index.scrollTop + 40 || bottom > index.scrollTop + index.clientHeight - 40) index.scrollTo({ top: top - index.clientHeight / 3 }); }
}
let sectionFrame = 0;
window.addEventListener('scroll', () => { if (!sectionFrame) sectionFrame = requestAnimationFrame(() => { sectionFrame = 0; markCurrentSection(true); }); }, { passive: true });
document.addEventListener('toggle', e => { if (e.target.classList?.contains('tema-qs')) fillSectionQuestions(e.target); }, true);
function scrollToSection(id, smooth = true) {
  const el = document.getElementById?.('apartado-' + id); if (!el) return;
  el.scrollIntoView({ behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto', block: 'start' });
  el.querySelector('h2')?.setAttribute('tabindex', '-1'); el.querySelector('h2')?.focus({ preventScroll: true });
}
function chartButton(q) { return q.topic === 11 ? `<button type="button" class="btn secondary full chart-open" data-action="open-chart" data-qid="${esc(q.id)}">Abrir la carta para esta pregunta</button>` : ''; }
function optionsRead(q, selected, showCorrect = false) {
  return `<ol class="read-options">${q.options.map(o => `<li class="${showCorrect && o.key === q.correct ? 'correct' : ''} ${showCorrect && selected === o.key && selected !== q.correct ? 'incorrect' : ''}"><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}${showCorrect && o.key === q.correct ? '<strong class="answer-label">Respuesta correcta</strong>' : ''}${showCorrect && selected === o.key ? '<strong class="answer-label">Tu respuesta</strong>' : ''}</span></li>`).join('')}</ol>`;
}
function activeSession() { return session && !session.finishedAt ? session : null; }
function getPractice(topic, block) {
  const blocks=practiceMap.get(topic)||[]; const ids=blocks[block-1]?.map(q=>q.id);
  if(!ids)return null;
  const saved=read(`practice:${topic}:${block}`);
  return saved?.topic===topic&&saved?.block===block&&validPractice(saved,ids,questionMap) ? saved : {topic,block,ids,index:0,answers:{},checked:[],finishedAt:null};
}
function savePractice(p){write(`practice:${p.topic}:${p.block}`,p);}
function autoAdvanceEnabled(){return read('autoAdvance',true)===true;}
function autoAdvanceControl(){
  return `<label class="auto-advance" for="auto-advance"><span>Avance automático<small>Pasar a la siguiente al responder</small></span><span class="switch-toggle"><input id="auto-advance" type="checkbox" role="switch" ${autoAdvanceEnabled()?'checked':''}><span class="switch-track" aria-hidden="true"></span></span></label>`;
}
function swipeHint() { return '<p class="swipe-hint">← Desliza para cambiar de pregunta →<span class="sr-only">También puedes elegir el número de pregunta o usar las flechas del teclado fuera de las respuestas.</span></p>'; }
function questionButtons(index,total,lastAction='',lastLabel='') {
  const last=index===total-1;
  return `<div class="exam-pagination"><button class="btn secondary" data-action="question-step" data-direction="-1" ${index===0?'disabled':''}>← Anterior</button><button class="btn" data-action="${last&&lastAction?lastAction:'question-step'}" data-direction="1" ${last&&!lastAction?'disabled':''}>${last&&lastLabel?lastLabel:'Siguiente →'}</button></div>`;
}
function numberNavigation(index,total,kind) {
  return `<details class="number-navigation"><summary>Ir a pregunta <span>${index+1} / ${total}</span></summary><div class="question-dots">${Array.from({length:total},(_,i)=>`<button type="button" class="question-dot ${i===index?'current':''}" data-action="question-jump" data-index="${i}" aria-label="Ir a pregunta ${i+1}" ${i===index?'aria-current="step"':''}>${i+1}</button>`).join('')}</div></details>`;
}
function practicePage(topic,block) {
  const p=getPractice(topic,block);if(!p)return notFound();
  const q=questionMap.get(p.ids[p.index]); const checked=p.checked.includes(q.id);const selected=p.answers[q.id];
  const reviewing=currentRoute().params.get('repaso')==='1'&&!!p.finishedAt;
  const count=Object.keys(p.answers).length;const score=p.ids.filter(id=>p.answers[id]===questionMap.get(id).correct).length;
  if(p.finishedAt&&!reviewing)return `<a class="back-link" href="#/tema/${topic}">← Tests del tema</a>${heading('Test terminado',`${topicTitle(topic)} · Test ${block}`)}<section class="practice-result"><span class="practice-score">${score}<small>/10</small></span><h2>${score>=8?'Buen trabajo':'Sigue practicando'}</h2><p>${10-count} en blanco · ${count-score} incorrectas</p><button class="btn full" data-action="practice-review" data-topic="${topic}" data-block="${block}">Repasar respuestas</button><button class="btn secondary full" data-action="practice-reset" data-topic="${topic}" data-block="${block}">Repetir test</button><a class="btn text full" href="#/tema/${topic}">Volver a los tests</a></section>`;
  return `<a class="back-link" href="#/tema/${topic}">← Tests del tema</a><div class="practice-heading"><div><p class="eyebrow">TEST ${block} · TEMA ${topic}</p><h1>Pregunta ${p.index+1}<span> / 10</span></h1></div><span class="saved-label">${storageFailed?'Sin guardar':'Guardado'}</span></div><progress class="practice-progress" value="${count}" max="10" aria-label="Preguntas respondidas"></progress>${reviewing?'':autoAdvanceControl()}<section class="question-panel practice-panel"><h2 class="exam-question">${esc(q.text)}</h2>${questionImage(q)}${chartButton(q)}<fieldset class="answer-options"><legend class="sr-only">Elige una respuesta</legend>${q.options.map(o=>`<label class="answer-option ${selected===o.key?'selected':''} ${checked&&q.correct===o.key?'is-correct':''} ${checked&&selected===o.key&&selected!==q.correct?'is-incorrect':''}"><input type="radio" name="practice-answer" value="${o.key}" ${reviewing?'disabled':''} ${selected===o.key?'checked':''}><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}${checked&&q.correct===o.key?'<strong class="answer-label">✓ Respuesta correcta</strong>':''}</span></label>`).join('')}</fieldset>${checked?`<p class="practice-feedback ${selected===q.correct?'right':'wrong'}" role="status">${selected===q.correct?'✓ Correcto':'La respuesta correcta es '+q.correct.toUpperCase()+'.'}</p>${explanation(q)}${temaIndex.has(topic)?`<a class="tema-feedback-link" href="#/tema/${topic}/estudio">Repasar el tema ↗</a>`:''}`:`<button class="btn secondary full check-answer" data-action="practice-check" ${selected?'':'disabled'}>Comprobar respuesta</button>`}${questionButtons(p.index,10,'practice-finish',reviewing?'Ver resultado':'Terminar test')}${swipeHint()}${numberNavigation(p.index,10,'practice')}</section><p class="local-note">Respuestas y posición guardadas en este navegador.</p>`;
}
function home() {
  const active = activeSession();
  const totalTests=[...practiceMap.values()].reduce((sum,blocks)=>sum+blocks.length,0);
  const finishedTests=bank.topics.reduce((sum,t)=>sum+practiceMap.get(t.id).filter((_,i)=>getPractice(t.id,i+1).finishedAt).length,0);
  return `${heading('Temas', 'Repasa a tu ritmo, una pregunta cada vez.')}<div class="progress-summary"><span><b>${finishedTests}</b> de ${totalTests} tests terminados</span><span>11 temas</span></div>
  ${active ? `<a class="resume-link" href="#/examen"><span><b>Simulacro en curso</b><small>${Object.keys(active.answers).length} de 45 respondidas · El reloj sigue corriendo</small></span><span aria-hidden="true">→</span></a>` : ''}
  <section class="topic-list" aria-label="Unidades temáticas">${bank.topics.map(t => {
    const qs = bank.questions.filter(q => q.topic === t.id); const blocks=practiceMap.get(t.id);const done=blocks.filter((_,i)=>getPractice(t.id,i+1).finishedAt).length;
    const title = t.id === 6 ? 'Reglamento de abordajes' : t.title;
    return `<a class="topic-card" href="#/tema/${t.id}"><span class="unit-number">${String(t.id).padStart(2,'0')}</span><div><h2>${esc(title)}</h2><p>${temaIndex.has(t.id) ? '<span class="tema-pill">Temario</span> ' : ''}${blocks.length} tests · ${qs.length} preguntas${done ? ` · ${done} ${done===1?'terminado':'terminados'}` : ''}</p></div><span class="row-arrow" aria-hidden="true">›</span></a>`;
  }).join('')}</section><p class="local-note">Tu progreso se guarda solo en este navegador.</p><a class="rules-link" href="#/reglas">Reglas del examen y procedencia ↗</a>`;
}
function topicPage(n, params) {
  if(!bank.topics.some(t=>t.id===n))return notFound();
  const blocks=practiceMap.get(n);const all=bank.questions.filter(q=>q.topic===n);
  const completed=blocks.filter((_,i)=>getPractice(n,i+1).finishedAt).length;
  return `<a class="back-link" href="#/temas">← Temas</a>${heading(esc(topicTitle(n)),`${all.length} preguntas · Tests de 10 preguntas`)}<div class="topic-columns"><div class="topic-study">${temaCard(n)}${n===11?'<p class="inline-notice">Cada pregunta abre la carta del Estrecho con regla, demoras y compás virtuales. También puedes practicar por libre.</p><button type="button" class="btn secondary full" data-action="open-chart">Abrir la carta del Estrecho</button>':''}</div><div class="topic-tests"><div class="progress-summary"><span>${completed} de ${blocks.length} tests terminados</span><span>Avance guardado</span></div><section class="test-list" aria-label="Tests del tema">${blocks.map((qs,i)=>{
    const p=getPractice(n,i+1);const count=Object.keys(p.answers).length;const correct=p.ids.filter(id=>p.answers[id]===questionMap.get(id).correct).length;
    return `<a class="test-row" href="#/practica/${n}/${i+1}"><span class="test-number">${i+1}</span><div><h2>Test ${i+1}</h2><p>${p.finishedAt?`${correct}/10 aciertos · Terminado`:count?`${count}/10 respondidas · Continuar`:'10 preguntas'}</p></div><span class="test-state">${p.finishedAt?'✓':count?'Continuar':'›'}</span></a>`;
  }).join('')}</section>${all.length%10?'<p class="local-note">El último test completa sus 10 preguntas con algunas del inicio del tema. Así se incluye todo el banco.</p>':''}</div></div>`;
}
function distributionTable(result = null) {
  return `<div class="table-wrap"><table><caption class="sr-only">${result?'Resultado por unidad temática':'Distribución oficial de preguntas por unidad temática'}</caption><thead><tr><th scope="col">Unidad temática</th><th scope="col">${result?'Aciertos':'Preguntas'}</th><th scope="col">${result?'Errores¹':'Máx. errores'}</th></tr></thead><tbody>${bank.topics.map(t=>{
    const row = result?.byTopic[t.id-1]; const fail = row && row.limit!==null && row.errors>row.limit;
    return `<tr class="${fail?'row-danger':''}"><th scope="row"><span class="table-unit">${String(t.id).padStart(2,'0')}</span>${esc(t.title)}</th><td>${row ? `${row.correct} / ${row.total}` : QUOTAS[t.id-1]}</td><td>${row ? `${row.errors}${row.limit !== null ? ` / ${row.limit} máx.` : ''}${fail?' · Límite superado':''}` : LIMITS[t.id] ?? '—'}</td></tr>`;
  }).join('')}</tbody><tfoot><tr><th scope="row">Total del examen</th><td>${result ? `${result.correct} / 45` : 45}</td><td>${result ? `${result.errors} / 13 máx.` : 13}</td></tr></tfoot></table></div>`;
}
function setup() {
  const active = activeSession();
  return `${heading('Simulacro','El examen completo, con preguntas mezcladas.')}
  ${active ? `<aside class="resume-panel"><div><strong>Simulacro en curso</strong><p>${Object.keys(active.answers).length} de 45 respondidas. El reloj sigue corriendo en esta pestaña.</p></div><a class="btn" href="#/examen">Continuar simulacro →</a></aside>`:''}
  <section class="exam-brief"><div class="exam-numbers"><div><b>45</b><span>preguntas</span></div><div><b>90</b><span>minutos</span></div><div><b>32</b><span>aciertos mínimos</span></div></div><h2>Para aprobar</h2><p class="brief-text">Al menos 32 aciertos y un máximo de:</p><ul class="limits-list"><li><span>Balizamiento</span><b>2 errores</b></li><li><span>Reglamento de abordajes</span><b>5 errores</b></li><li><span>Carta de navegación</span><b>2 errores</b></li></ul><p class="small">Las preguntas en blanco cuentan como error. Una sola respuesta por pregunta. Puedes cambiarla y marcar preguntas para revisar.</p><p class="small">El reloj no se pausa mientras esta pestaña siga abierta. Si cierras o recargas, se pierde el simulacro. Solo se guarda el resultado al entregar.</p><details class="rules-disclosure"><summary>Ver reparto por temas</summary>${distributionTable()}</details><details class="rules-disclosure"><summary>Material y reglas oficiales</summary><p class="small">Las preguntas de carta incluyen la carta del Estrecho de Gibraltar con útiles de trazado virtuales; también puedes usar tu carta de papel, regla, transportador y compás. Este simulacro corresponde al examen PER completo, sin exenciones.</p><p class="small"><a href="${RULES_URL}" target="_blank" rel="noopener">Boletín Oficial del Estado · Anexo II ↗</a></p></details><button class="btn full start-exam" data-action="start">${active?'Empezar otro simulacro':'Empezar simulacro'} →</button><p class="small start-note">${active?'El actual se entregará antes de empezar otro.':'El reloj empieza al pulsar. No hay pausa.'}</p></section>`;
}
function renderExam() {
  session = activeSession();
  if (!session) { main.innerHTML = `${heading('No hay un simulacro en marcha.','Al recargar o cerrar se descarta el intento. Puedes iniciar otro o consultar los resultados ya entregados.')}<a class="btn" href="#/simulacro">Preparar simulacro →</a>`; return; }
  if (remaining(session.deadline) === 0) { finish(true); return; }
  const q=questionMap.get(session.ids[session.index]); const answered=Object.keys(session.answers).length;
  main.innerHTML = `<div class="exam-top"><div><p class="eyebrow">SIMULACRO PER · EN CURSO</p><p class="exam-position">Pregunta <b>${session.index+1}</b> de 45</p></div><div class="clock-box"><span>Tiempo restante</span><strong id="clock" role="timer" aria-label="Tiempo restante">${formatTime(remaining(session.deadline))}</strong></div><button class="btn secondary" data-action="submit">Entregar simulacro</button></div>${autoAdvanceControl()}<div class="exam-layout"><section class="question-panel"><div class="question-meta">${topicBadge(q.topic)}<span>${esc(topicTitle(q.topic))}</span></div><h1 class="exam-question">${esc(q.text)}</h1>${questionImage(q)}${chartButton(q)}<fieldset class="answer-options"><legend class="sr-only">Elige una respuesta</legend>${q.options.map(o=>`<label class="answer-option ${session.answers[q.id]===o.key?'selected':''}"><input type="radio" name="answer" value="${o.key}" ${session.answers[q.id]===o.key?'checked':''}><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}</span></label>`).join('')}</fieldset><div class="question-tools"><button class="btn text" data-action="flag" aria-pressed="${session.flags.includes(q.id)}">${session.flags.includes(q.id)?'⚑ Marcada para revisar':'⚐ Marcar para revisar'}</button><button class="btn text" data-action="clear-answer" ${session.answers[q.id]?'':'disabled'}>Borrar respuesta</button></div>${questionButtons(session.index,45,'submit','Entregar simulacro')}${swipeHint()}</section><aside class="question-navigator" aria-label="Navegación de preguntas"><details class="navigator-disclosure"><summary>Hoja de respuestas <span>${answered}/45</span></summary><p id="answered-count">${answered} respondidas · ${45-answered} en blanco</p><div class="question-dots">${session.ids.map((id,i)=>`<button type="button" class="question-dot ${session.answers[id]?'answered':''} ${session.flags.includes(id)?'flagged':''} ${i===session.index?'current':''}" data-action="jump" data-index="${i}" aria-label="Pregunta ${i+1}, ${session.answers[id]?'respondida':'en blanco'}${session.flags.includes(id)?', marcada para revisar':''}" ${i===session.index?'aria-current="step"':''}>${i+1}${session.flags.includes(id)?'<span aria-hidden="true">•</span>':''}</button>`).join('')}</div><div class="navigator-key"><span><i class="key-answered"></i>Respondida</span><span><i></i>En blanco</span><span><b>•</b>Para revisar</span></div><p class="small">Este simulacro no guarda el avance. Al recargar se pierde. Las soluciones se ven al entregar.</p></details><a href="#/simulacro" class="back-link">Salir y continuar después</a></aside></div>`;
  tick();
  timer=setInterval(tick,1000);
}
function tick() {
  if(!session || session.finishedAt) return;
  const left=remaining(session.deadline);
  const clock=$('#clock'); if(clock) { clock.textContent=formatTime(left); clock.classList.toggle('time-low',left<5*60*1000); }
  if(left===0)finish(true);
}
function updateSession(change) {
  if(!session||session.finishedAt){render();return false;}
  if(remaining(session.deadline)===0){finish(true);return false;}
  change(session);return true;
}
function finish(expired=false) {
  const s=activeSession(); if(!s) return;
  if($('#dialog').open)$('#dialog').close();
  clearInterval(timer);
  s.finishedAt = Math.min(Date.now(),s.deadline);s.expired=expired;
  s.result=gradeExam(s.ids.map(id=>questionMap.get(id)),s.answers);
  write('session:'+s.id,s);
  session=null; location.hash='/resultado/'+s.id;
}
function startExam() {
  const selected=generateExam(bank.questions);chartMemory.clear();
  const now=Date.now();const id=crypto.randomUUID();
  session={id,ids:selected.map(q=>q.id),answers:{},flags:[],index:0,startedAt:now,deadline:now+DURATION,bankVersion:bank.version};
  location.hash='/examen';
}
const dateFormat = ms => new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(ms));
function resultsPage(id) {
  const s=read('session:'+id);if(!isValidSession(s,questionMap)||!s.finishedAt)return notFound();
  const questions=s.ids.map(id=>questionMap.get(id));const r=gradeExam(questions,s.answers);
  const filtered=questions.filter(q=>reviewFilter==='all'||s.answers[q.id]!==q.correct);
  return `<a class="back-link" href="#/historial">← Mi bitácora</a>${heading(r.passed?'Simulacro aprobado':'Sigue practicando',dateFormat(s.startedAt)+' · '+(s.expired?'Tiempo agotado':'Simulacro entregado'),'RESULTADO DEL SIMULACRO')}
  <div class="result-banner ${r.passed?'passed':'failed'}"><div><span class="result-verdict">${r.passed?'APTO':'NO APTO'}</span><p>${r.passed?'Cumples el mínimo de aciertos y todos los límites por materia.':'Para aprobar necesitas cumplir el mínimo total y los tres límites por materia.'}</p></div><strong>${r.correct}<small> / 45</small></strong></div><div class="result-stats"><span><b>${r.wrong}</b> incorrectas</span><span><b>${r.blank}</b> en blanco</span><span><b>${formatTime(Math.min(DURATION,s.finishedAt-s.startedAt))}</b> tiempo empleado</span></div>
  ${r.reasons.length?`<aside class="inline-notice danger"><h2>Lo que hay que reforzar</h2><ul>${r.reasons.map(reason=>`<li>${esc(reason.replace(/Tema (\d+):/,(_,n)=>topicTitle(Number(n))+':'))}</li>`).join('')}</ul></aside>`:''}
  <details class="result-breakdown"><summary>Resultado por temas</summary>${distributionTable(r)}<p class="small">¹ Los errores incluyen las preguntas incorrectas y las que has dejado en blanco.</p></details><div class="section-head"><div><h2>Repasar respuestas</h2></div><div class="segmented" aria-label="Filtrar revisión"><button class="${reviewFilter==='errors'?'active':''}" data-action="review-filter" data-filter="errors" aria-pressed="${reviewFilter==='errors'}">Errores y blancos (${r.errors})</button><button class="${reviewFilter==='all'?'active':''}" data-action="review-filter" data-filter="all" aria-pressed="${reviewFilter==='all'}">Todas (45)</button></div></div>
  ${filtered.length ? filtered.slice(Math.min(reviewPage,filtered.length-1),Math.min(reviewPage,filtered.length-1)+1).map(q=>`<article class="study-question"><div class="question-meta"><span>Pregunta ${s.ids.indexOf(q.id)+1}</span>${topicBadge(q.topic)}<strong>${s.answers[q.id]===q.correct?'✓ Correcta':s.answers[q.id]?'✕ Incorrecta':'— En blanco'}</strong></div><h2>${esc(q.text)}</h2>${questionImage(q)}${chartButton(q)}${optionsRead(q,s.answers[q.id],true)}${explanation(q)}</article>`).join('') : '<div class="empty-state"><h3>¡Todas correctas!</h3><p>No hay errores ni preguntas en blanco en este simulacro.</p></div>'}${filtered.length ? `${questionButtons(Math.min(reviewPage,filtered.length-1),filtered.length)}${swipeHint()}${numberNavigation(Math.min(reviewPage,filtered.length-1),filtered.length,'review')}` : ''}<div class="actions"><a class="btn" href="#/simulacro">Otro simulacro →</a><a class="btn secondary" href="#/temas">Volver a los temas</a></div>`;
}
function historyPage() {
  const keys = new Set([...memory.keys()]);
  try { for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(PREFIX+'session:'))keys.add(k.slice(PREFIX.length));} } catch { warnStorage(); }
  const sessions=[...keys].filter(k=>k.startsWith('session:')).map(k=>read(k)).filter(s=>isValidSession(s,questionMap)&&s.finishedAt).sort((a,b)=>b.startedAt-a.startedAt);
  const active=activeSession();
  return `${heading('Mi bitácora','Tus simulacros, guardados en este navegador.','REGISTRO PERSONAL')}${active?`<aside class="resume-panel"><p><b>Hay un simulacro en marcha.</b> Puedes retomarlo mientras quede tiempo.</p><a class="btn" href="#/examen">Continuar simulacro →</a></aside>`:''}${sessions.length?`<div class="history-list">${sessions.map((s,i)=>{const r=gradeExam(s.ids.map(id=>questionMap.get(id)),s.answers);return `<a class="history-row" href="#/resultado/${esc(s.id)}"><span class="history-number">${String(sessions.length-i).padStart(2,'0')}</span><div><h2>Simulacro PER</h2><p>${dateFormat(s.startedAt)}${s.expired?' · Tiempo agotado':''}</p></div><span class="result-pill ${r.passed?'passed':'failed'}">${r.passed?'APTO':'NO APTO'}</span><strong>${r.correct}<small> / 45</small></strong><span aria-hidden="true">↗</span></a>`;}).join('')}</div>`:'<div class="empty-state"><img src="assets/compass.svg" width="68" height="68" alt=""><h2>Tu primera travesía empieza aquí.</h2><p>Cuando entregues un simulacro, podrás consultar su resultado y repasar tus errores.</p><a class="btn" href="#/simulacro">Preparar mi primer simulacro →</a></div>'}<p class="small">Los datos se guardan únicamente en este navegador. Borrar sus datos elimina el progreso. No se sincronizan entre dispositivos.</p>`;
}
function rulesPage() {
  return `${heading('Las reglas, a la vista.','Criterios del examen completo de Patrón de Embarcaciones de Recreo.','REGLAS Y PROCEDENCIA')}<section class="prose"><h2>Cómo se aprueba</h2><p>45 preguntas independientes, con cuatro respuestas posibles y una correcta. Dispones de 90 minutos. Debes conseguir al menos 32 aciertos y no superar los límites de error en Balizamiento (2), Reglamento Internacional para Prevenir los Abordajes (5) y Carta de navegación (2). Una pregunta en blanco no suma un acierto y se computa como error para estos criterios.</p>${distributionTable()}<p>Este simulador reproduce el examen completo. No aplica la prueba complementaria para quienes ya tienen el título de Patrón para Navegación Básica.</p><p><a href="${RULES_URL}" target="_blank" rel="noopener">Real Decreto 875/2014, anexo II, apartado 3 · Boletín Oficial del Estado ↗</a><br>Consulta realizada el 1 de noviembre de 2026.</p><h2>De dónde salen las preguntas</h2><p>Banco propio exportado de Boat Málaga el 1 de noviembre de 2026: 1.464 preguntas de 149 tests. Las respuestas correctas son las que figuraban en el banco de origen; no se ha realizado una revisión académica de todas las soluciones. Los simulacros no son exámenes emitidos por una administración.</p><p>Las explicaciones de cada respuesta se han redactado con ayuda de inteligencia artificial a partir de la normativa (RIPA, balizamiento IALA, legislación náutica). Pueden contener errores; cuando la solución del banco parece dudosa, se indica con un aviso.</p><p>En estudio se conservan las repeticiones entre tests. En cada simulacro se evitan preguntas idénticas. Las opciones mantienen el orden del banco, para respetar referencias como «todas las anteriores».</p><h2>Temario para repasar</h2><p>Los once temas de la pestaña «Temario» son explicaciones propias, redactadas con ayuda de inteligencia artificial a partir del temario y de las preguntas del banco. Cada pregunta del banco está asignada al apartado que la resuelve. No tienen revisión académica: cuando la respuesta del banco parece discutible, el tema lo avisa.</p><h2>Material para los ejercicios de carta</h2><p>Los ejercicios de carta se resuelven sobre la carta de prácticas del Estrecho de Gibraltar. Cada pregunta del tema 11 abre la carta L105 de enseñanza con útiles virtuales: puntos por coordenadas, regla con rumbo verdadero y distancia, demoras, compás de distancias y ajuste a los cruces. Las medidas son loxodrómicas, con 1 milla = 1′ de latitud; la carta no es válida para la navegación. Los trazos de los tests se guardan en este navegador; los de un simulacro se descartan con él. La web incluye además las ocho imágenes originales del banco y no recalcula los datos de los enunciados.</p><h2>Tu progreso</h2><p>Los avances de los tests por tema y los resultados finales de los simulacros se guardan localmente en este navegador. Los tests de 10 preguntas guardan sus respuestas y posición. El simulacro de 45 no guarda el avance: recargar o cerrar la pestaña lo descarta. Mientras permanezca abierta el tiempo continúa y, al entregar, se guarda el resultado final.</p></section>`;
}
function notFound() { return `${heading('Ese rumbo no está en la carta.','La página o el simulacro ya no está disponible en este navegador.')}<a class="btn" href="#/temas">Volver a los temas</a>`; }
function render(focus=true) {
  if(!bank)return;
  cancelQuestionTransition();
  clearInterval(timer);timer=null;
  const {path,params}=currentRoute();
  const wide=/^\/tema\/\d+\/estudio$/.test(path);
  const nav=wide||path==='/temario'?'temario':path.startsWith('/tema')||path.startsWith('/practica')?'temas':path.startsWith('/simulacro')||path==='/examen'?'simulacro':path.startsWith('/historial')||path.startsWith('/resultado')?'historial':'';
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  main.className=path==='/examen'?'exam-main':wide?'wide-main':'';
  document.body.classList.toggle('route-wide',wide);
  document.body.classList.toggle('in-exam',path==='/examen');
  if(path==='/examen')renderExam();
  else if(path==='/temas'||path==='/')main.innerHTML=home();
  else if(wide)main.innerHTML=temaPage(Number(path.split('/')[2]));
  else if(path==='/temario')main.innerHTML=temarioPage();
  else if(/^\/tema\/\d+$/.test(path))main.innerHTML=topicPage(Number(path.split('/')[2]),params);
  else if(/^\/practica\/\d+\/\d+$/.test(path))main.innerHTML=practicePage(Number(path.split('/')[2]),Number(path.split('/')[3]));
  else if(path==='/simulacro')main.innerHTML=setup();
  else if(path==='/historial')main.innerHTML=historyPage();
  else if(path.startsWith('/resultado/'))main.innerHTML=resultsPage(path.split('/')[2]);
  else if(path==='/reglas')main.innerHTML=rulesPage();
  else main.innerHTML=notFound();
  document.title=(main.querySelector('h1')?.innerText.replace(/\s+/g,' ')||'Estudiar')+' · Bitácora PER';
  if(focus){main.style?.removeProperty('min-height');window.scrollTo(0,0);main.focus({preventScroll:true});}
  const target=params.get('apartado');if(wide&&target)scrollToSection(target,false);
  markCurrentSection();
}
let dialogAction, dialogTrigger;
function ask(title,description,confirmLabel,action,cancelLabel='Seguir con el simulacro') {
  dialogTrigger=document.activeElement;dialogAction=action;
  $('#dialog-title').textContent=title;$('#dialog-description').textContent=description;
  $('#dialog-confirm').textContent=confirmLabel;$('#dialog-cancel').textContent=cancelLabel;
  $('#dialog').showModal();$('#dialog-cancel').focus();
}
$('#dialog-cancel').addEventListener('click',()=>$('#dialog').close());
$('#dialog-confirm').addEventListener('click',()=>{const action=dialogAction;$('#dialog').close();action?.();});
$('#dialog').addEventListener('close',()=>{if(dialogTrigger?.isConnected)dialogTrigger.focus();});
document.addEventListener('change',e=>{
  if(questionTransition)return;
  if(e.target.id==='auto-advance'){write('autoAdvance',e.target.checked);return;}
  if(e.target.name==='practice-answer'){
    const [, ,t,b]=currentRoute().path.split('/');const p=getPractice(Number(t),Number(b));
    if(!p)return;
    const id=p.ids[p.index],selected=e.target.value;
    const advance=autoAdvanceEnabled()&&!Object.hasOwn(p.answers,id)&&p.index<p.ids.length-1;
    p.answers[id]=selected;p.checked=p.checked.filter(x=>x!==id);
    if(advance)p.index++;
    savePractice(p);
    if(advance)transitionQuestion(1,()=>render(false),()=>focusCurrentQuestion('practice'));
    else {render(false);document.querySelector(`input[name="practice-answer"][value="${selected}"]`)?.focus({preventScroll:true});}
  }
  if(e.target.name==='answer') {
    const selected=e.target.value;
    let advance=false;
    if(updateSession(s=>{
      const id=s.ids[s.index];advance=autoAdvanceEnabled()&&!Object.hasOwn(s.answers,id)&&s.index<s.ids.length-1;
      s.answers[id]=selected;if(advance)s.index++;
    })) {
      if(advance)transitionQuestion(1,()=>renderExamSafely(),()=>focusCurrentQuestion('exam'));
      else {renderExamSafely();document.querySelector(`input[name="answer"][value="${selected}"]`)?.focus({preventScroll:true});}
    }
  }
});
function navigationContext() {
  const {path,params}=currentRoute();
  if(/^\/practica\/\d+\/\d+$/.test(path)) {
    const [, ,t,b]=path.split('/');const p=getPractice(Number(t),Number(b));
    return p&&(!p.finishedAt||params.get('repaso')==='1')?{kind:'practice',index:p.index,total:p.ids.length,practice:p}:null;
  }
  if(path==='/examen'&&activeSession())return {kind:'exam',index:session.index,total:session.ids.length};
  if(path.startsWith('/resultado/')) {
    const s=read('session:'+path.split('/')[2]);if(!isValidSession(s,questionMap)||!s.finishedAt)return null;
    const total=s.ids.filter(id=>reviewFilter==='all'||s.answers[id]!==questionMap.get(id).correct).length;
    return total?{kind:'review',index:Math.min(reviewPage,total-1),total}:null;
  }
  return null;
}
const QUESTION_MOTION={exit:180,enter:240};
let questionTransition=null;
function cancelQuestionTransition() {
  const tx=questionTransition;if(!tx)return;
  questionTransition=null;tx.cancelled=true;tx.animation?.cancel();main.inert=false;
}
function focusCurrentQuestion(kind) {
  const question=$('.exam-question,.study-question h2');question?.setAttribute('tabindex','-1');question?.focus({preventScroll:true});
}
function retainQuestionScroll(commit,position={x:window.scrollX||0,y:window.scrollY||0}) {
  const {x,y}=position;
  // Keep enough document height when the next question is shorter, otherwise
  // the browser clamps the scroll before we can restore the previous position.
  if(y>0)main.style.minHeight=`max(calc(100dvh - 61px), ${Math.ceil(y+window.innerHeight-main.offsetTop)}px)`;
  else main.style?.removeProperty('min-height');
  commit();window.scrollTo(x,y);
}
function transitionQuestion(direction,commit,after) {
  if(questionTransition)return false;
  const outgoing=$('.question-panel,.study-question');
  if(!outgoing?.animate||matchMedia('(prefers-reduced-motion: reduce)').matches){retainQuestionScroll(commit);after?.();return true;}
  const tx={hash:location.hash,cancelled:false,animation:null,scroll:{x:window.scrollX||0,y:window.scrollY||0}};
  const offset=Math.min(outgoing.clientWidth*.65,260);
  questionTransition=tx;main.inert=true;
  (async()=>{
    try {
      tx.animation=outgoing.animate([
        {transform:getComputedStyle(outgoing).transform,opacity:1},
        {transform:`translateX(${-direction*offset}px)`,opacity:0}
      ],{duration:QUESTION_MOTION.exit,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
      await tx.animation.finished;
      if(tx.cancelled||location.hash!==tx.hash)return;
      // Release the outgoing animation before rendering so route-level cancellation
      // cannot cancel this intentional commit. Answers have already been saved.
      questionTransition=null;main.inert=false;retainQuestionScroll(commit,tx.scroll);
      if(tx.cancelled||location.hash!==tx.hash)return;
      const incoming=$('.question-panel,.study-question');if(!incoming)return;
      questionTransition=tx;main.inert=true;
      tx.animation=incoming.animate([
        {transform:`translateX(${direction*offset}px)`,opacity:0},
        {transform:'translateX(0)',opacity:1}
      ],{duration:QUESTION_MOTION.enter,easing:'cubic-bezier(.16,1,.3,1)'});
      await tx.animation.finished;
    } catch { /* A route change or expired exam may cancel the animation. */ }
    finally {
      if(questionTransition===tx){questionTransition=null;main.inert=false;if(!tx.cancelled&&location.hash===tx.hash)after?.();}
    }
  })();
  return true;
}
function navigateQuestion(value,absolute=false) {
  const ctx=navigationContext();if(!ctx||$('#dialog').open||questionTransition)return false;
  const next=Math.max(0,Math.min(ctx.total-1,absolute?value:ctx.index+value));if(next===ctx.index)return false;
  if(ctx.kind==='practice'){ctx.practice.index=next;savePractice(ctx.practice);}
  if(ctx.kind==='exam'&&!updateSession(s=>{s.index=next;}))return false;
  if(ctx.kind==='review')reviewPage=next;
  return transitionQuestion(Math.sign(next-ctx.index),()=>{if(ctx.kind==='exam')renderExamSafely();else render(false);},()=>focusCurrentQuestion(ctx.kind));
}
let drag=null,suppressClickUntil=0;
document.addEventListener('pointerdown',()=>{suppressClickUntil=0;},true);
function resetDrag() {
  if(drag?.panel){drag.panel.style.removeProperty('transform');drag.panel.classList.remove('swiping');}
  drag=null;
}
main.addEventListener('pointerdown',e=>{
  resetDrag();if(questionTransition||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0)||!navigationContext()||$('#dialog').open)return;
  if(e.target.closest('button,a,summary,.number-navigation,.question-navigator,.segmented,.actions,table'))return;
  // Leave the screen edge available for the browser's own back gesture.
  if(e.clientX<20||e.clientX>innerWidth-20)return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,horizontal:false,ctx:navigationContext(),panel:main.querySelector('.question-panel,.study-question')};
},{passive:true});
main.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.horizontal){
    if(Math.abs(dy)>18&&Math.abs(dy)>Math.abs(dx)*1.3){resetDrag();return;}
    if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.25)return;
    drag.horizontal=true;try{main.setPointerCapture(e.pointerId);}catch{}drag.panel?.classList.add('swiping');
  }
  e.preventDefault();
  if(drag.panel)drag.panel.style.transform=`translateX(${Math.max(-35,Math.min(35,dx*.18))}px)`;
},{passive:false});
main.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const current=navigationContext();
  const same=current&&current.kind===drag.ctx.kind&&current.index===drag.ctx.index;
  const direction=drag.horizontal&&same?swipeDirection(e.clientX-drag.x,e.clientY-drag.y):0;
  if(drag.horizontal){e.preventDefault();suppressClickUntil=performance.now()+400;}
  resetDrag();if(main.hasPointerCapture(e.pointerId))main.releasePointerCapture(e.pointerId);
  if(direction)navigateQuestion(direction);
},{passive:false});
main.addEventListener('pointercancel',resetDrag);
main.addEventListener('lostpointercapture',e=>{
  // Touch starts with implicit capture on the touched child. Moving capture to
  // main releases that child and bubbles this event: it must not cancel the drag.
  if(e.target===main&&drag?.id===e.pointerId&&!main.hasPointerCapture(e.pointerId))resetDrag();
});
document.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('keydown',e=>{
  if(isChartOpen()||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target.closest('input,button,a,select,textarea,summary,[contenteditable="true"]'))return;
  const direction=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0;
  if(direction&&navigateQuestion(direction))e.preventDefault();
});
function renderExamSafely(){clearInterval(timer);renderExam();}
document.addEventListener('click',e=>{
  if(e.target.closest('.skip')){e.preventDefault();main.focus();return;}
  const sectionLink=e.target.closest('.tema-index a[data-section], a[data-resume]');
  if(sectionLink){e.preventDefault();history.replaceState(null,'',sectionLink.getAttribute('href'));scrollToSection(sectionLink.dataset.section||sectionLink.dataset.resume);if(matchMedia('(max-width: 1023px)').matches)sectionLink.closest('details')?.removeAttribute('open');return;}
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;
  const a=button.dataset.action;
  if(a==='tq-pick'){const id=button.dataset.q;if(!tqPicked.has(id)){tqPicked.set(id,button.dataset.key);tqRefresh(id);}return;}
  if(a==='tq-retry'){tqPicked.delete(button.dataset.q);tqRefresh(button.dataset.q);return;}
  if(a==='tema-studied'){const n=Number(button.dataset.topic),id=button.dataset.section,on=toggleStudied(n,id);button.setAttribute('aria-pressed',String(on));document.querySelector(`.tema-index li[data-section-li="${CSS.escape(id)}"]`)?.classList.toggle('is-studied',on);const total=document.querySelectorAll('.studied-toggle').length,done=document.querySelectorAll('.studied-toggle[aria-pressed="true"]').length;const text=document.querySelector('.tema-progress-text');if(text)text.innerHTML=`<b>${done}</b> de ${total} apartados estudiados`;const bar=document.querySelector('.tema-progress progress');if(bar)bar.value=done;return;}
  if(a==='tema-retry'){temaCache.delete(Number(button.dataset.topic));render();return;}
  if(a.startsWith('practice-')){
    const parts=currentRoute().path.split('/');const t=Number(button.dataset.topic||parts[2]),b=Number(button.dataset.block||parts[3]);const p=getPractice(t,b);if(!p)return;
    if(a==='practice-check'){const id=p.ids[p.index];if(!p.answers[id])return;p.checked=[...new Set([...p.checked,id])];const seen=seenIds();seen.add(id);write('seen',[...seen]);savePractice(p);render(false);}
      if(a==='practice-finish'){if(p.finishedAt){location.hash=`/practica/${t}/${b}`;return;}ask('¿Terminar este test?',`Quedan ${10-Object.keys(p.answers).length} preguntas en blanco. Tus respuestas y el resultado se guardarán.`, 'Terminar test',()=>{p.finishedAt=Date.now();p.checked=[...p.ids];savePractice(p);render();},'Seguir con el test');}
    if(a==='practice-review'){p.checked=[...p.ids];p.index=0;savePractice(p);location.hash=`/practica/${t}/${b}?repaso=1`;}
    if(a==='practice-reset'){ask('¿Repetir el test?',`Se borrarán las respuestas guardadas del test ${b} de este tema.`, 'Repetir test',()=>{p.answers={};p.checked=[];p.index=0;p.finishedAt=null;savePractice(p);render();},'Cancelar');}
  }
  if(a==='start'){
    if(activeSession())ask('¿Empezar otro simulacro?','El simulacro actual se corregirá con las respuestas guardadas y quedará en tu bitácora. Después empezará uno nuevo de 90 minutos.','Entregar y empezar otro',()=>{finish(false);startExam();},'Continuar el actual');
    else startExam();
  }
  if(a==='submit'){
    const s=activeSession();if(!s)return;
    ask('¿Entregar el simulacro?',`Tienes ${45-Object.keys(s.answers).length} preguntas en blanco. Al entregar se cerrarán las respuestas y podrás ver la corrección.`,'Entregar simulacro',()=>finish(false));
  }
  if(a==='question-step')navigateQuestion(Number(button.dataset.direction));
  if(a==='jump'||a==='question-jump')navigateQuestion(Number(button.dataset.index),true);
  if(a==='flag'){
    if(updateSession(s=>{const id=s.ids[s.index];s.flags=s.flags.includes(id)?s.flags.filter(x=>x!==id):[...s.flags,id];})){renderExamSafely();$('[data-action="flag"]').focus({preventScroll:true});}
  }
  if(a==='clear-answer'){
    if(updateSession(s=>{delete s.answers[s.ids[s.index]];})){renderExamSafely();$('.answer-option input')?.focus({preventScroll:true});}
  }
  if(a==='review-filter'){reviewPage=0;reviewFilter=button.dataset.filter;const y=window.scrollY;render(false);window.scrollTo(0,y);$(`[data-filter="${reviewFilter}"]`)?.focus({preventScroll:true});}
  if(a==='open-chart'){
    const q=questionMap.get(button.dataset.qid),key='chart:'+(q?.id??'libre'),exam=currentRoute().path==='/examen';
    openChart({title:q?'Carta · '+topicTitle(11):'Carta del Estrecho · Práctica libre',question:q,confirm:ask,store:exam?{load:()=>chartMemory.get(key),save:data=>chartMemory.set(key,structuredClone(data))}:{load:()=>read(key),save:data=>write(key,data)}});
  }
  if(a==='reload')location.reload();
});
window.addEventListener('hashchange',()=>{closeChart();render();});
window.addEventListener('storage',e=>{const path=currentRoute().path;if(e.key?.startsWith(PREFIX)&&(path.startsWith('/practica/')||(e.key===PREFIX+'autoAdvance'&&path==='/examen')))render(false);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentRoute().path==='/examen')render(false);});
async function loadExplanations() {
  try {
    const response=await fetch('explanations.json',{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    explanations=(await response.json()).items??{};
  } catch { explanations={}; }
  const path=currentRoute().path;
  if(path.startsWith('/practica/')||path.startsWith('/resultado/')){const y=window.scrollY;render(false);window.scrollTo(0,y);}
}
async function init() {
  try {
    const response=await fetch('bank.json',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(data.topics?.length!==11||data.questions?.length!==1464)throw Error('Banco incompleto');
    bank=data;questionMap=new Map(bank.questions.map(q=>[q.id,q]));practiceMap=new Map(bank.topics.map(t=>[t.id,practiceBlocks(bank.questions,t.id)]));
    const saved=activeSession();if(saved&&remaining(saved.deadline)===0){finish(true);return;}
    try{const idx=await fetch(`temas/index.json?v=${encodeURIComponent(data.version)}`,{signal:AbortSignal.timeout(15000)}).then(r=>r.ok?r.json():null);if(Array.isArray(idx?.temas))temaIndex=new Map(idx.temas.filter(t=>Number.isInteger(t.topic)).map(t=>[t.topic,t]));}catch{temaIndex=new Map();}
    render(false);
    loadExplanations();
  } catch {
    main.innerHTML='<div class="empty-state"><h1>No se han podido cargar las preguntas.</h1><p>Comprueba tu conexión y vuelve a intentarlo. Tu progreso guardado sigue en este navegador.</p><button class="btn" data-action="reload">Volver a cargar</button></div>';
  }
}
init();
