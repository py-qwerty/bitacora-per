import { QUOTAS, LIMITS, DURATION, RULES_URL, generateExam, gradeExam, remaining, formatTime, isValidSession } from './core.js';
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
let bank, questionMap, timer, session = null, reviewFilter = 'errors';
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
  return `<div class="page-heading">${eyebrow(tag)}<h1>${title}</h1>${text ? `<p class="lead">${text}</p>` : ''}</div>`;
}
function questionImage(q) { return q.image ? `<figure class="question-image"><img src="${esc(q.image)}" width="600" height="360" loading="lazy" alt="Ilustración del enunciado. Consulta los detalles de la imagen para resolver la pregunta."><figcaption>Imagen original del banco de preguntas</figcaption></figure>` : ''; }
function optionsRead(q, selected, showCorrect = false) {
  return `<ol class="read-options">${q.options.map(o => `<li class="${showCorrect && o.key === q.correct ? 'correct' : ''} ${showCorrect && selected === o.key && selected !== q.correct ? 'incorrect' : ''}"><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}${showCorrect && o.key === q.correct ? '<strong class="answer-label">Respuesta correcta</strong>' : ''}${showCorrect && selected === o.key ? '<strong class="answer-label">Tu respuesta</strong>' : ''}</span></li>`).join('')}</ol>`;
}
function studyCard(q, idx) {
  return `<article class="study-question" id="q-${q.id}"><div class="question-meta"><span>Pregunta ${idx}</span><span>${esc(q.test.replace(/^Tema \d+\. .*?\. /, ''))}</span></div><h2>${esc(q.text)}</h2>${questionImage(q)}${optionsRead(q)}<button class="btn text" data-action="solution" data-id="${q.id}" aria-expanded="false" aria-controls="solution-${q.id}">Ver respuesta <span aria-hidden="true">↓</span></button><div class="solution" id="solution-${q.id}" hidden><strong>Correcta: ${q.correct.toUpperCase()}</strong><p>${esc(q.options.find(o => o.key === q.correct).text)}</p></div></article>`;
}
function activeSession() {
  const id = read('active');
  const saved = id ? read('session:' + id) : null;
  return isValidSession(saved, questionMap) && !saved.finishedAt ? saved : null;
}
function home() {
  const seen = seenIds(); const active = activeSession();
  return `<section class="hero"><div class="hero-copy">${eyebrow('PATRÓN DE EMBARCACIONES DE RECREO')}<h1>Antes de<br>soltar amarras<span>.</span></h1><p>Tu banco de preguntas, un tema cada vez.<br>Tu examen, con las reglas de verdad.</p><a class="btn" href="#/simulacro">${active ? 'Continuar simulacro' : 'Preparar un simulacro'} <span aria-hidden="true">↗</span></a><span class="hero-note">45 preguntas · 90 minutos · Criterios oficiales</span></div><div class="hero-chart" aria-label="Reparto oficial del examen"><div class="chart-top"><span>PLAN DE TRAVESÍA</span><span>PER / 45</span></div><div class="compass-art" aria-hidden="true"><div class="compass-ring"></div><span class="north">N</span><span class="east">E</span><span class="south">S</span><span class="west">W</span><img src="assets/compass.svg" width="140" height="140" alt=""><span class="compass-caption">UN RUMBO.<br>ONCE TEMAS.</span></div><div class="chart-bottom"><div><b>${number(bank.questions.length)}</b><span>preguntas a bordo</span></div><div><b>11</b><span>unidades temáticas</span></div><div><b>149</b><span>tests de origen</span></div></div></div></section>
  <section class="topics-section"><div class="section-head"><div>${eyebrow('ESTUDIO POR TEMAS')}<h2>Traza tu ruta.</h2></div><p><b>${number(seen.size)}</b> / ${number(bank.questions.length)} respuestas consultadas</p></div><div class="topic-grid">${bank.topics.map(t => {
    const qs = bank.questions.filter(q => q.topic === t.id); const done = qs.filter(q => seen.has(q.id)).length;
    return `<a class="topic-card" href="#/tema/${t.id}"><div class="topic-card-top"><span class="unit-number">${String(t.id).padStart(2,'0')}</span><span class="quota-label">${QUOTAS[t.id - 1]} en el examen</span></div><h3>${esc(t.title.replace(' (RIPA)',''))}</h3><p>${qs.length} preguntas <span aria-hidden="true">·</span> ${t.tests} tests</p><div class="topic-card-bottom"><span>${done ? `${done} consultadas` : 'Empezar a estudiar'}</span><span aria-hidden="true">↗</span></div><div class="topic-progress" role="progressbar" aria-label="Respuestas consultadas en ${esc(t.title)}" aria-valuenow="${done}" aria-valuemax="${qs.length}"><span style="width:${done / qs.length * 100}%"></span></div></a>`;
  }).join('')}</div></section><aside class="info-strip"><span class="info-icon" aria-hidden="true">i</span><p>Tu progreso se guarda en este navegador. Consultar una solución cuenta como estudiada; el resultado de un simulacro se guarda en <a href="#/historial">Mi bitácora</a>.</p></aside>`;
}
function topicPage(n, params) {
  if (!bank.topics.some(t => t.id === n)) return notFound();
  const search = params.get('q') || ''; const test = params.get('test') || '';
  const all = bank.questions.filter(q => q.topic === n);
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const filtered = all.filter(q => (!test || q.testId === test) && normalize(q.text + ' ' + q.options.map(o=>o.text).join(' ')).includes(normalize(search)));
  const pageCount = Math.max(1,Math.ceil(filtered.length / 20)); const page = Math.min(pageCount,Math.max(1,Number.parseInt(params.get('pagina') || '1',10) || 1));
  const start = (page-1)*20;
  const tests = [...new Map(all.map(q => [q.testId, q.test])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es',{numeric:true}));
  return `<a class="back-link" href="#/temas">← Todos los temas</a>${heading(esc(topicTitle(n)),`${all.length} preguntas · ${QUOTAS[n-1]} de las 45 preguntas del examen pertenecen a este tema.`, `UNIDAD TEMÁTICA ${String(n).padStart(2,'0')}`)}
  ${n === 11 ? '<aside class="inline-notice">Para los ejercicios de carta, prepara la carta de prácticas del Estrecho de Gibraltar, regla, transportador y compás. Se conservan los datos y fechas originales de cada ejercicio.</aside>' : ''}
  <form class="search-form" id="question-search" novalidate data-topic="${n}"><div class="search-field"><label for="search">Buscar en este tema</label><div class="input-row"><input id="search" name="q" type="search" value="${esc(search)}" placeholder="Enunciado o respuesta…"><button class="clear-search" type="button" data-action="clear-search" aria-label="Borrar búsqueda" ${search ? '' : 'hidden'}>×</button></div></div><div class="select-field"><label for="test-filter">Test de origen</label><select id="test-filter" name="test"><option value="">Todos los tests</option>${tests.map(([id,title])=>`<option value="${id}" ${test===id?'selected':''}>${esc(title.match(/Test\s*\d+/)?.[0] || title)}</option>`).join('')}</select></div><button class="btn secondary" type="submit">Buscar</button></form>
  <p class="result-count" role="status">${filtered.length ? `${start+1}–${Math.min(start+20,filtered.length)} de ${filtered.length} preguntas` : 'No hay preguntas con estos filtros'}</p>
  ${filtered.length ? `<div class="study-list">${filtered.slice(start,start+20).map((q,i)=>studyCard(q,start+i+1)).join('')}</div>` : '<div class="empty-state"><h2>No hemos encontrado esa pregunta.</h2><p>Prueba con otra palabra o consulta todos los tests del tema.</p><button class="btn secondary" data-action="reset-filters">Quitar filtros</button></div>'}
  ${filtered.length ? `<nav class="pagination" aria-label="Páginas de preguntas"><button class="btn secondary" data-action="page" data-page="${page-1}" ${page===1?'disabled':''}>← Anterior</button><span>Página ${page} de ${pageCount}</span><button class="btn secondary" data-action="page" data-page="${page+1}" ${page===pageCount?'disabled':''}>Siguiente →</button></nav>` : ''}`;
}
function distributionTable(result = null) {
  return `<div class="table-wrap"><table><caption class="sr-only">${result?'Resultado por unidad temática':'Distribución oficial de preguntas por unidad temática'}</caption><thead><tr><th scope="col">Unidad temática</th><th scope="col">${result?'Aciertos':'Preguntas'}</th><th scope="col">${result?'Errores¹':'Máx. errores'}</th></tr></thead><tbody>${bank.topics.map(t=>{
    const row = result?.byTopic[t.id-1]; const fail = row && row.limit!==null && row.errors>row.limit;
    return `<tr class="${fail?'row-danger':''}"><th scope="row"><span class="table-unit">${String(t.id).padStart(2,'0')}</span>${esc(t.title)}</th><td>${row ? `${row.correct} / ${row.total}` : QUOTAS[t.id-1]}</td><td>${row ? `${row.errors}${row.limit !== null ? ` / ${row.limit} máx.` : ''}${fail?' · Límite superado':''}` : LIMITS[t.id] ?? '—'}</td></tr>`;
  }).join('')}</tbody><tfoot><tr><th scope="row">Total del examen</th><td>${result ? `${result.correct} / 45` : 45}</td><td>${result ? `${result.errors} / 13 máx.` : 13}</td></tr></tfoot></table></div>`;
}
function setup() {
  const active = activeSession();
  return `${heading('Tu ensayo general.','Preguntas mezcladas. El mismo reparto, el mismo tiempo y los mismos límites del examen completo.','SIMULACRO DEL EXAMEN PER')}
  ${active ? `<aside class="resume-panel"><div><strong>Tienes un simulacro en marcha.</strong><p>El reloj sigue corriendo. ${Object.keys(active.answers).length} de 45 respondidas.</p></div><a class="btn" href="#/examen">Continuar simulacro →</a></aside>`:''}
  <div class="setup-grid"><section class="exam-brief"><div class="exam-numbers"><div><b>45</b><span>preguntas</span></div><div><b>90</b><span>minutos</span></div><div><b>32</b><span>aciertos mínimos</span></div></div><h2>Así será tu simulacro</h2><ul class="check-list"><li>Cuatro opciones por pregunta y una sola respuesta.</li><li>Selección aleatoria por tema, sin repetir la misma pregunta en el examen.</li><li>Puedes cambiar respuestas, dejarlas en blanco y marcar preguntas para revisar.</li><li>Las soluciones se muestran al entregar o al agotarse los 90 minutos.</li><li>Las preguntas sin contestar cuentan como error. Fallar no resta puntos adicionales.</li><li>El tiempo continúa al salir de la página. Puedes recuperar el simulacro en este navegador.</li></ul><div class="critical-rules"><h3>Tres límites que también debes cumplir</h3><p><strong>Balizamiento:</strong> 2 errores como máximo.<br><strong>Reglamento Internacional para Prevenir los Abordajes:</strong> 5 errores.<br><strong>Carta de navegación:</strong> 2 errores.</p></div><p class="small">Prepara la carta de prácticas del Estrecho de Gibraltar y tus útiles de trazado para las cuatro preguntas de carta. Este es el examen PER completo, sin exención por el título de Patrón para Navegación Básica.</p><button class="btn full" data-action="start">${active?'Empezar otro simulacro':'Empezar simulacro'} <span aria-hidden="true">→</span></button><p class="small">${active?'El simulacro actual se conservará como entregado si decides comenzar otro.':'Al empezar se inicia el reloj. No hay pausa.'}</p></section><section class="distribution"><div class="section-head compact"><div>${eyebrow('EL REPARTO OFICIAL')}<h2>Cada tema, en su medida.</h2></div></div>${distributionTable()}<p class="small">Anexo II del Real Decreto 875/2014. <a href="${RULES_URL}" target="_blank" rel="noopener">Consultar el BOE ↗</a></p></section></div>`;
}
function renderExam() {
  session = activeSession();
  if (!session) { main.innerHTML = `${heading('No hay un simulacro en marcha.','Puedes iniciar uno nuevo o consultar tus resultados anteriores.')}<a class="btn" href="#/simulacro">Preparar simulacro →</a>`; return; }
  if (remaining(session.deadline) === 0) { finish(true); return; }
  const q=questionMap.get(session.ids[session.index]); const answered=Object.keys(session.answers).length;
  main.innerHTML = `<div class="exam-top"><div><p class="eyebrow">SIMULACRO PER · EN CURSO</p><p class="exam-position">Pregunta <b>${session.index+1}</b> de 45</p></div><div class="clock-box"><span>Tiempo restante</span><strong id="clock" role="timer" aria-label="Tiempo restante">${formatTime(remaining(session.deadline))}</strong></div><button class="btn secondary" data-action="submit">Entregar simulacro</button></div><div class="exam-layout"><section class="question-panel"><div class="question-meta">${topicBadge(q.topic)}<span>${esc(topicTitle(q.topic))}</span></div><h1 class="exam-question">${esc(q.text)}</h1>${questionImage(q)}<fieldset class="answer-options"><legend class="sr-only">Elige una respuesta</legend>${q.options.map(o=>`<label class="answer-option ${session.answers[q.id]===o.key?'selected':''}"><input type="radio" name="answer" value="${o.key}" ${session.answers[q.id]===o.key?'checked':''}><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}</span></label>`).join('')}</fieldset><div class="question-tools"><button class="btn text" data-action="flag" aria-pressed="${session.flags.includes(q.id)}">${session.flags.includes(q.id)?'⚑ Marcada para revisar':'⚐ Marcar para revisar'}</button><button class="btn text" data-action="clear-answer" ${session.answers[q.id]?'':'disabled'}>Borrar respuesta</button></div><div class="exam-pagination"><button class="btn secondary" data-action="previous" ${session.index===0?'disabled':''}>← Anterior</button><button class="btn" data-action="${session.index===44?'submit':'next'}">${session.index===44?'Entregar simulacro':'Siguiente →'}</button></div></section><aside class="question-navigator" aria-label="Navegación de preguntas"><h2>Tu hoja de respuestas</h2><p id="answered-count">${answered} respondidas · ${45-answered} en blanco</p><div class="question-dots">${session.ids.map((id,i)=>`<button type="button" class="question-dot ${session.answers[id]?'answered':''} ${session.flags.includes(id)?'flagged':''} ${i===session.index?'current':''}" data-action="jump" data-index="${i}" aria-label="Pregunta ${i+1}, ${session.answers[id]?'respondida':'en blanco'}${session.flags.includes(id)?', marcada para revisar':''}" ${i===session.index?'aria-current="step"':''}>${i+1}${session.flags.includes(id)?'<span aria-hidden="true">•</span>':''}</button>`).join('')}</div><div class="navigator-key"><span><i class="key-answered"></i>Respondida</span><span><i></i>En blanco</span><span><b>•</b>Para revisar</span></div><p class="small">Tus respuestas se guardan en este navegador. Las soluciones se verán al entregar.</p><a href="#/simulacro" class="back-link">Salir y continuar después</a></aside></div>`;
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
  const fresh=activeSession();
  if(!fresh || fresh.id!==session?.id){ render(); return false; }
  if(remaining(fresh.deadline)===0){session=fresh;finish(true);return false;}
  change(fresh); write('session:'+fresh.id,fresh);session=fresh;return true;
}
function finish(expired=false) {
  const s=activeSession(); if(!s) return;
  if($('#dialog').open)$('#dialog').close();
  clearInterval(timer);
  s.finishedAt = Math.min(Date.now(),s.deadline);s.expired=expired;
  s.result=gradeExam(s.ids.map(id=>questionMap.get(id)),s.answers);
  write('session:'+s.id,s);
  if(read('active')===s.id)write('active',null);
  session=null; location.hash='/resultado/'+s.id;
}
function startExam() {
  const selected=generateExam(bank.questions);
  const now=Date.now();const id=crypto.randomUUID();
  session={id,ids:selected.map(q=>q.id),answers:{},flags:[],index:0,startedAt:now,deadline:now+DURATION,bankVersion:bank.version};
  write('session:'+id,session);write('active',id);location.hash='/examen';
}
const dateFormat = ms => new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(ms));
function resultsPage(id) {
  const s=read('session:'+id);if(!isValidSession(s,questionMap)||!s.finishedAt)return notFound();
  const questions=s.ids.map(id=>questionMap.get(id));const r=gradeExam(questions,s.answers);
  const filtered=questions.filter(q=>reviewFilter==='all'||s.answers[q.id]!==q.correct);
  return `<a class="back-link" href="#/historial">← Mi bitácora</a>${heading(r.passed?'Rumbo al aprobado.':'Una nueva ocasión para afinar.',dateFormat(s.startedAt)+' · '+(s.expired?'Tiempo agotado':'Simulacro entregado'),'RESULTADO DEL SIMULACRO')}
  <div class="result-banner ${r.passed?'passed':'failed'}"><div><span class="result-verdict">${r.passed?'APTO':'NO APTO'}</span><p>${r.passed?'Cumples el mínimo de aciertos y todos los límites por materia.':'Para aprobar necesitas cumplir el mínimo total y los tres límites por materia.'}</p></div><strong>${r.correct}<small> / 45</small></strong></div><div class="result-stats"><span><b>${r.wrong}</b> incorrectas</span><span><b>${r.blank}</b> en blanco</span><span><b>${formatTime(Math.min(DURATION,s.finishedAt-s.startedAt))}</b> tiempo empleado</span></div>
  ${r.reasons.length?`<aside class="inline-notice danger"><h2>Lo que hay que reforzar</h2><ul>${r.reasons.map(reason=>`<li>${esc(reason.replace(/Tema (\d+):/,(_,n)=>topicTitle(Number(n))+':'))}</li>`).join('')}</ul></aside>`:''}
  <div class="result-breakdown"><h2>El resultado, tema por tema.</h2>${distributionTable(r)}<p class="small">¹ Los errores incluyen las preguntas incorrectas y las que has dejado en blanco.</p></div><div class="section-head"><div>${eyebrow('REPASO DESPUÉS DEL EXAMEN')}<h2>Aprende de cada respuesta.</h2></div><div class="segmented" aria-label="Filtrar revisión"><button class="${reviewFilter==='errors'?'active':''}" data-action="review-filter" data-filter="errors" aria-pressed="${reviewFilter==='errors'}">Errores y blancos (${r.errors})</button><button class="${reviewFilter==='all'?'active':''}" data-action="review-filter" data-filter="all" aria-pressed="${reviewFilter==='all'}">Todas (45)</button></div></div>
  ${filtered.length ? filtered.map(q=>`<article class="study-question"><div class="question-meta"><span>Pregunta ${s.ids.indexOf(q.id)+1}</span>${topicBadge(q.topic)}<strong>${s.answers[q.id]===q.correct?'✓ Correcta':s.answers[q.id]?'✕ Incorrecta':'— En blanco'}</strong></div><h2>${esc(q.text)}</h2>${questionImage(q)}${optionsRead(q,s.answers[q.id],true)}</article>`).join('') : '<div class="empty-state"><h3>¡Todas correctas!</h3><p>No hay errores ni preguntas en blanco en este simulacro.</p></div>'}<div class="actions"><a class="btn" href="#/simulacro">Preparar otro simulacro →</a><a class="btn secondary" href="#/temas">Volver a los temas</a></div>`;
}
function historyPage() {
  const keys = new Set([...memory.keys()]);
  try { for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(PREFIX+'session:'))keys.add(k.slice(PREFIX.length));} } catch { warnStorage(); }
  const sessions=[...keys].filter(k=>k.startsWith('session:')).map(k=>read(k)).filter(s=>isValidSession(s,questionMap)&&s.finishedAt).sort((a,b)=>b.startedAt-a.startedAt);
  const active=activeSession();
  return `${heading('Tu bitácora de estudio.','Cada intento deja una lección. Aquí están los simulacros realizados en este navegador.','REGISTRO PERSONAL')}${active?`<aside class="resume-panel"><p><b>Hay un simulacro en marcha.</b> Puedes retomarlo mientras quede tiempo.</p><a class="btn" href="#/examen">Continuar simulacro →</a></aside>`:''}${sessions.length?`<div class="history-list">${sessions.map((s,i)=>{const r=gradeExam(s.ids.map(id=>questionMap.get(id)),s.answers);return `<a class="history-row" href="#/resultado/${esc(s.id)}"><span class="history-number">${String(sessions.length-i).padStart(2,'0')}</span><div><h2>Simulacro PER</h2><p>${dateFormat(s.startedAt)}${s.expired?' · Tiempo agotado':''}</p></div><span class="result-pill ${r.passed?'passed':'failed'}">${r.passed?'APTO':'NO APTO'}</span><strong>${r.correct}<small> / 45</small></strong><span aria-hidden="true">↗</span></a>`;}).join('')}</div>`:'<div class="empty-state"><img src="assets/compass.svg" width="68" height="68" alt=""><h2>Tu primera travesía empieza aquí.</h2><p>Cuando entregues un simulacro, podrás consultar su resultado y repasar tus errores.</p><a class="btn" href="#/simulacro">Preparar mi primer simulacro →</a></div>'}<p class="small">Los datos se guardan únicamente en este navegador. Borrar sus datos elimina el progreso. No se sincronizan entre dispositivos.</p>`;
}
function rulesPage() {
  return `${heading('Las reglas, a la vista.','Criterios del examen completo de Patrón de Embarcaciones de Recreo.','REGLAS Y PROCEDENCIA')}<section class="prose"><h2>Cómo se aprueba</h2><p>45 preguntas independientes, con cuatro respuestas posibles y una correcta. Dispones de 90 minutos. Debes conseguir al menos 32 aciertos y no superar los límites de error en Balizamiento (2), Reglamento Internacional para Prevenir los Abordajes (5) y Carta de navegación (2). Una pregunta en blanco no suma un acierto y se computa como error para estos criterios.</p>${distributionTable()}<p>Este simulador reproduce el examen completo. No aplica la prueba complementaria para quienes ya tienen el título de Patrón para Navegación Básica.</p><p><a href="${RULES_URL}" target="_blank" rel="noopener">Real Decreto 875/2014, anexo II, apartado 3 · Boletín Oficial del Estado ↗</a><br>Consulta realizada el 1 de noviembre de 2026.</p><h2>De dónde salen las preguntas</h2><p>Banco propio exportado de Boat Málaga el 1 de noviembre de 2026: 1.464 preguntas de 149 tests. Las respuestas correctas son las que figuraban en el banco de origen; no se ha realizado una revisión académica de todas las soluciones. Los simulacros no son exámenes emitidos por una administración.</p><p>En estudio se conservan las repeticiones entre tests. En cada simulacro se evitan preguntas idénticas. Las opciones mantienen el orden del banco, para respetar referencias como «todas las anteriores».</p><h2>Material para los ejercicios de carta</h2><p>Algunos ejercicios requieren la carta de prácticas del Estrecho de Gibraltar, regla, transportador y compás. La web incluye las ocho imágenes originales del banco. No incorpora una carta náutica interactiva ni recalcula los datos de los enunciados.</p><h2>Tu progreso</h2><p>Respuestas consultadas, simulacro en curso y resultados se guardan localmente en este navegador. El reloj del simulacro no se pausa al salir, cambiar de pestaña o recargar. Al regresar después del límite, se corrige con las respuestas que hubieras guardado.</p></section>`;
}
function notFound() { return `${heading('Ese rumbo no está en la carta.','La página o el simulacro ya no está disponible en este navegador.')}<a class="btn" href="#/temas">Volver a los temas</a>`; }
function render(focus=true) {
  if(!bank)return;
  clearInterval(timer);timer=null;
  const {path,params}=currentRoute();
  const nav=path.startsWith('/tema')?'temas':path.startsWith('/simulacro')||path==='/examen'?'simulacro':path.startsWith('/historial')||path.startsWith('/resultado')?'historial':'';
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  main.className=path==='/examen'?'exam-main':'';
  if(path==='/examen')renderExam();
  else if(path==='/temas'||path==='/')main.innerHTML=home();
  else if(/^\/tema\/\d+$/.test(path))main.innerHTML=topicPage(Number(path.split('/')[2]),params);
  else if(path==='/simulacro')main.innerHTML=setup();
  else if(path==='/historial')main.innerHTML=historyPage();
  else if(path.startsWith('/resultado/'))main.innerHTML=resultsPage(path.split('/')[2]);
  else if(path==='/reglas')main.innerHTML=rulesPage();
  else main.innerHTML=notFound();
  document.title=(main.querySelector('h1')?.innerText.replace(/\s+/g,' ')||'Estudiar')+' · Bitácora PER';
  if(focus){window.scrollTo(0,0);main.focus({preventScroll:true});}
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
function setFilters(reset=false) {
  const {path}=currentRoute();const params=new URLSearchParams();
  if(!reset){const q=$('#search').value.trim();const test=$('#test-filter').value;if(q)params.set('q',q);if(test)params.set('test',test);}
  const hash=path+(params.size?'?'+params:'');
  if(location.hash.slice(1)===hash)render();else location.hash=hash;
}
document.addEventListener('submit',e=>{if(e.target.id==='question-search'){e.preventDefault();setFilters();}});
document.addEventListener('input',e=>{if(e.target.id==='search')$('.clear-search').hidden=!e.target.value;});
document.addEventListener('change',e=>{
  if(e.target.id==='test-filter')setFilters();
  if(e.target.name==='answer') {
    const selected=e.target.value;
    if(updateSession(s=>{s.answers[s.ids[s.index]]=selected;})) {
      const optionFocus=selected;renderExamSafely();
      document.querySelector(`input[name="answer"][value="${optionFocus}"]`)?.focus({preventScroll:true});
    }
  }
});
function renderExamSafely(){clearInterval(timer);renderExam();}
document.addEventListener('click',e=>{
  if(e.target.closest('.skip')){e.preventDefault();main.focus();return;}
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;
  const a=button.dataset.action;
  if(a==='solution'){
    const expanded=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!expanded));
    const target=$('#solution-'+button.dataset.id);target.hidden=expanded;button.innerHTML=expanded?'Ver respuesta ↓':'Ocultar respuesta ↑';
    if(!expanded){const seen=seenIds();seen.add(button.dataset.id);write('seen',[...seen]);}
  }
  if(a==='clear-search'){$('#search').value='';button.hidden=true;setFilters();$('#search')?.focus();}
  if(a==='reset-filters')setFilters(true);
  if(a==='page'){const {path,params}=currentRoute();params.set('pagina',button.dataset.page);location.hash=path+'?'+params;}
  if(a==='start'){
    if(activeSession())ask('¿Empezar otro simulacro?','El simulacro actual se corregirá con las respuestas guardadas y quedará en tu bitácora. Después empezará uno nuevo de 90 minutos.','Entregar y empezar otro',()=>{finish(false);startExam();},'Continuar el actual');
    else startExam();
  }
  if(a==='submit'){
    const s=activeSession();if(!s)return;
    ask('¿Entregar el simulacro?',`Tienes ${45-Object.keys(s.answers).length} preguntas en blanco. Al entregar se cerrarán las respuestas y podrás ver la corrección.`,'Entregar simulacro',()=>finish(false));
  }
  if(['previous','next','jump'].includes(a)){
    if(updateSession(s=>{s.index=a==='jump'?Number(button.dataset.index):s.index+(a==='next'?1:-1);})){
      renderExamSafely();$('.exam-question')?.setAttribute('tabindex','-1');$('.exam-question')?.focus({preventScroll:true});window.scrollTo(0,0);
    }
  }
  if(a==='flag'){
    if(updateSession(s=>{const id=s.ids[s.index];s.flags=s.flags.includes(id)?s.flags.filter(x=>x!==id):[...s.flags,id];})){renderExamSafely();$('[data-action="flag"]').focus({preventScroll:true});}
  }
  if(a==='clear-answer'){
    if(updateSession(s=>{delete s.answers[s.ids[s.index]];})){renderExamSafely();$('.answer-option input')?.focus({preventScroll:true});}
  }
  if(a==='review-filter'){reviewFilter=button.dataset.filter;const y=window.scrollY;render(false);window.scrollTo(0,y);$(`[data-filter="${reviewFilter}"]`)?.focus({preventScroll:true});}
  if(a==='reload')location.reload();
});
window.addEventListener('hashchange',()=>render());
window.addEventListener('storage',e=>{
  if(!e.key?.startsWith(PREFIX))return;
  if(currentRoute().path==='/examen'){
    const focused=document.activeElement?.getAttribute('name');
    render(false);if(focused==='answer')$('.answer-option input:checked')?.focus({preventScroll:true});
  }
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentRoute().path==='/examen')render(false);});
async function init() {
  try {
    const response=await fetch('bank.json',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(data.topics?.length!==11||data.questions?.length!==1464)throw Error('Banco incompleto');
    bank=data;questionMap=new Map(bank.questions.map(q=>[q.id,q]));
    const saved=activeSession();if(saved&&remaining(saved.deadline)===0){finish(true);return;}
    render(false);
  } catch {
    main.innerHTML='<div class="empty-state"><h1>No se han podido cargar las preguntas.</h1><p>Comprueba tu conexión y vuelve a intentarlo. Tu progreso guardado sigue en este navegador.</p><button class="btn" data-action="reload">Volver a cargar</button></div>';
  }
}
init();
