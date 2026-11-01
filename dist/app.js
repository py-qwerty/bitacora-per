import { QUOTAS, LIMITS, DURATION, RULES_URL, generateExam, gradeExam, remaining, formatTime, isValidSession, practiceBlocks, validPractice, swipeDirection } from './core.js?v=6';
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
let bank, questionMap, practiceMap, timer, session = null, reviewFilter = 'errors', reviewPage = 0;
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
function questionImage(q) { return q.image ? `<figure class="question-image"><img src="${esc(q.image)}" width="600" height="360" loading="lazy" alt="Ilustración del enunciado. Consulta los detalles de la imagen para resolver la pregunta."><figcaption>Imagen original del banco de preguntas</figcaption></figure>` : ''; }
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
  return `<a class="back-link" href="#/tema/${topic}">← Tests del tema</a><div class="practice-heading"><div><p class="eyebrow">TEST ${block} · TEMA ${topic}</p><h1>Pregunta ${p.index+1}<span> / 10</span></h1></div><span class="saved-label">${storageFailed?'Sin guardar':'Guardado'}</span></div><progress class="practice-progress" value="${count}" max="10" aria-label="Preguntas respondidas"></progress>${reviewing?'':autoAdvanceControl()}<section class="question-panel practice-panel"><h2 class="exam-question">${esc(q.text)}</h2>${questionImage(q)}<fieldset class="answer-options"><legend class="sr-only">Elige una respuesta</legend>${q.options.map(o=>`<label class="answer-option ${selected===o.key?'selected':''} ${checked&&q.correct===o.key?'is-correct':''} ${checked&&selected===o.key&&selected!==q.correct?'is-incorrect':''}"><input type="radio" name="practice-answer" value="${o.key}" ${reviewing?'disabled':''} ${selected===o.key?'checked':''}><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}${checked&&q.correct===o.key?'<strong class="answer-label">✓ Respuesta correcta</strong>':''}</span></label>`).join('')}</fieldset>${checked?`<p class="practice-feedback ${selected===q.correct?'right':'wrong'}" role="status">${selected===q.correct?'✓ Correcto':'La respuesta correcta es '+q.correct.toUpperCase()+'.'}</p>`:`<button class="btn secondary full check-answer" data-action="practice-check" ${selected?'':'disabled'}>Comprobar respuesta</button>`}${questionButtons(p.index,10,'practice-finish',reviewing?'Ver resultado':'Terminar test')}${swipeHint()}${numberNavigation(p.index,10,'practice')}</section><p class="local-note">Respuestas y posición guardadas en este navegador.</p>`;
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
    return `<a class="topic-card" href="#/tema/${t.id}"><span class="unit-number">${String(t.id).padStart(2,'0')}</span><div><h2>${esc(title)}</h2><p>${blocks.length} tests · ${qs.length} preguntas${done ? ` · ${done} ${done===1?'terminado':'terminados'}` : ''}</p></div><span class="row-arrow" aria-hidden="true">›</span></a>`;
  }).join('')}</section><p class="local-note">Tu progreso se guarda solo en este navegador.</p><a class="rules-link" href="#/reglas">Reglas del examen y procedencia ↗</a>`;
}
function topicPage(n, params) {
  if(!bank.topics.some(t=>t.id===n))return notFound();
  const blocks=practiceMap.get(n);const all=bank.questions.filter(q=>q.topic===n);
  const completed=blocks.filter((_,i)=>getPractice(n,i+1).finishedAt).length;
  return `<a class="back-link" href="#/temas">← Temas</a>${heading(esc(topicTitle(n)),`${all.length} preguntas · Tests de 10 preguntas`)}<div class="progress-summary"><span>${completed} de ${blocks.length} tests terminados</span><span>Avance guardado</span></div>${n===11?'<p class="inline-notice">Prepara la carta de prácticas del Estrecho de Gibraltar y tus útiles de trazado.</p>':''}<section class="test-list" aria-label="Tests del tema">${blocks.map((qs,i)=>{
    const p=getPractice(n,i+1);const count=Object.keys(p.answers).length;const correct=p.ids.filter(id=>p.answers[id]===questionMap.get(id).correct).length;
    return `<a class="test-row" href="#/practica/${n}/${i+1}"><span class="test-number">${i+1}</span><div><h2>Test ${i+1}</h2><p>${p.finishedAt?`${correct}/10 aciertos · Terminado`:count?`${count}/10 respondidas · Continuar`:'10 preguntas'}</p></div><span class="test-state">${p.finishedAt?'✓':count?'Continuar':'›'}</span></a>`;
  }).join('')}</section>${all.length%10?'<p class="local-note">El último test completa sus 10 preguntas con algunas del inicio del tema. Así se incluye todo el banco.</p>':''}`;
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
  <section class="exam-brief"><div class="exam-numbers"><div><b>45</b><span>preguntas</span></div><div><b>90</b><span>minutos</span></div><div><b>32</b><span>aciertos mínimos</span></div></div><h2>Para aprobar</h2><p class="brief-text">Al menos 32 aciertos y un máximo de:</p><ul class="limits-list"><li><span>Balizamiento</span><b>2 errores</b></li><li><span>Reglamento de abordajes</span><b>5 errores</b></li><li><span>Carta de navegación</span><b>2 errores</b></li></ul><p class="small">Las preguntas en blanco cuentan como error. Una sola respuesta por pregunta. Puedes cambiarla y marcar preguntas para revisar.</p><p class="small">El reloj no se pausa mientras esta pestaña siga abierta. Si cierras o recargas, se pierde el simulacro. Solo se guarda el resultado al entregar.</p><details class="rules-disclosure"><summary>Ver reparto por temas</summary>${distributionTable()}</details><details class="rules-disclosure"><summary>Material y reglas oficiales</summary><p class="small">Para los ejercicios de carta, prepara la carta de prácticas del Estrecho de Gibraltar, regla, transportador y compás. Este simulacro corresponde al examen PER completo, sin exenciones.</p><p class="small"><a href="${RULES_URL}" target="_blank" rel="noopener">Boletín Oficial del Estado · Anexo II ↗</a></p></details><button class="btn full start-exam" data-action="start">${active?'Empezar otro simulacro':'Empezar simulacro'} →</button><p class="small start-note">${active?'El actual se entregará antes de empezar otro.':'El reloj empieza al pulsar. No hay pausa.'}</p></section>`;
}
function renderExam() {
  session = activeSession();
  if (!session) { main.innerHTML = `${heading('No hay un simulacro en marcha.','Al recargar o cerrar se descarta el intento. Puedes iniciar otro o consultar los resultados ya entregados.')}<a class="btn" href="#/simulacro">Preparar simulacro →</a>`; return; }
  if (remaining(session.deadline) === 0) { finish(true); return; }
  const q=questionMap.get(session.ids[session.index]); const answered=Object.keys(session.answers).length;
  main.innerHTML = `<div class="exam-top"><div><p class="eyebrow">SIMULACRO PER · EN CURSO</p><p class="exam-position">Pregunta <b>${session.index+1}</b> de 45</p></div><div class="clock-box"><span>Tiempo restante</span><strong id="clock" role="timer" aria-label="Tiempo restante">${formatTime(remaining(session.deadline))}</strong></div><button class="btn secondary" data-action="submit">Entregar simulacro</button></div>${autoAdvanceControl()}<div class="exam-layout"><section class="question-panel"><div class="question-meta">${topicBadge(q.topic)}<span>${esc(topicTitle(q.topic))}</span></div><h1 class="exam-question">${esc(q.text)}</h1>${questionImage(q)}<fieldset class="answer-options"><legend class="sr-only">Elige una respuesta</legend>${q.options.map(o=>`<label class="answer-option ${session.answers[q.id]===o.key?'selected':''}"><input type="radio" name="answer" value="${o.key}" ${session.answers[q.id]===o.key?'checked':''}><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}</span></label>`).join('')}</fieldset><div class="question-tools"><button class="btn text" data-action="flag" aria-pressed="${session.flags.includes(q.id)}">${session.flags.includes(q.id)?'⚑ Marcada para revisar':'⚐ Marcar para revisar'}</button><button class="btn text" data-action="clear-answer" ${session.answers[q.id]?'':'disabled'}>Borrar respuesta</button></div>${questionButtons(session.index,45,'submit','Entregar simulacro')}${swipeHint()}</section><aside class="question-navigator" aria-label="Navegación de preguntas"><details class="navigator-disclosure"><summary>Hoja de respuestas <span>${answered}/45</span></summary><p id="answered-count">${answered} respondidas · ${45-answered} en blanco</p><div class="question-dots">${session.ids.map((id,i)=>`<button type="button" class="question-dot ${session.answers[id]?'answered':''} ${session.flags.includes(id)?'flagged':''} ${i===session.index?'current':''}" data-action="jump" data-index="${i}" aria-label="Pregunta ${i+1}, ${session.answers[id]?'respondida':'en blanco'}${session.flags.includes(id)?', marcada para revisar':''}" ${i===session.index?'aria-current="step"':''}>${i+1}${session.flags.includes(id)?'<span aria-hidden="true">•</span>':''}</button>`).join('')}</div><div class="navigator-key"><span><i class="key-answered"></i>Respondida</span><span><i></i>En blanco</span><span><b>•</b>Para revisar</span></div><p class="small">Este simulacro no guarda el avance. Al recargar se pierde. Las soluciones se ven al entregar.</p></details><a href="#/simulacro" class="back-link">Salir y continuar después</a></aside></div>`;
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
  const selected=generateExam(bank.questions);
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
  ${filtered.length ? filtered.slice(Math.min(reviewPage,filtered.length-1),Math.min(reviewPage,filtered.length-1)+1).map(q=>`<article class="study-question"><div class="question-meta"><span>Pregunta ${s.ids.indexOf(q.id)+1}</span>${topicBadge(q.topic)}<strong>${s.answers[q.id]===q.correct?'✓ Correcta':s.answers[q.id]?'✕ Incorrecta':'— En blanco'}</strong></div><h2>${esc(q.text)}</h2>${questionImage(q)}${optionsRead(q,s.answers[q.id],true)}</article>`).join('') : '<div class="empty-state"><h3>¡Todas correctas!</h3><p>No hay errores ni preguntas en blanco en este simulacro.</p></div>'}${filtered.length ? `${questionButtons(Math.min(reviewPage,filtered.length-1),filtered.length)}${swipeHint()}${numberNavigation(Math.min(reviewPage,filtered.length-1),filtered.length,'review')}` : ''}<div class="actions"><a class="btn" href="#/simulacro">Otro simulacro →</a><a class="btn secondary" href="#/temas">Volver a los temas</a></div>`;
}
function historyPage() {
  const keys = new Set([...memory.keys()]);
  try { for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(PREFIX+'session:'))keys.add(k.slice(PREFIX.length));} } catch { warnStorage(); }
  const sessions=[...keys].filter(k=>k.startsWith('session:')).map(k=>read(k)).filter(s=>isValidSession(s,questionMap)&&s.finishedAt).sort((a,b)=>b.startedAt-a.startedAt);
  const active=activeSession();
  return `${heading('Mi bitácora','Tus simulacros, guardados en este navegador.','REGISTRO PERSONAL')}${active?`<aside class="resume-panel"><p><b>Hay un simulacro en marcha.</b> Puedes retomarlo mientras quede tiempo.</p><a class="btn" href="#/examen">Continuar simulacro →</a></aside>`:''}${sessions.length?`<div class="history-list">${sessions.map((s,i)=>{const r=gradeExam(s.ids.map(id=>questionMap.get(id)),s.answers);return `<a class="history-row" href="#/resultado/${esc(s.id)}"><span class="history-number">${String(sessions.length-i).padStart(2,'0')}</span><div><h2>Simulacro PER</h2><p>${dateFormat(s.startedAt)}${s.expired?' · Tiempo agotado':''}</p></div><span class="result-pill ${r.passed?'passed':'failed'}">${r.passed?'APTO':'NO APTO'}</span><strong>${r.correct}<small> / 45</small></strong><span aria-hidden="true">↗</span></a>`;}).join('')}</div>`:'<div class="empty-state"><img src="assets/compass.svg" width="68" height="68" alt=""><h2>Tu primera travesía empieza aquí.</h2><p>Cuando entregues un simulacro, podrás consultar su resultado y repasar tus errores.</p><a class="btn" href="#/simulacro">Preparar mi primer simulacro →</a></div>'}<p class="small">Los datos se guardan únicamente en este navegador. Borrar sus datos elimina el progreso. No se sincronizan entre dispositivos.</p>`;
}
function rulesPage() {
  return `${heading('Las reglas, a la vista.','Criterios del examen completo de Patrón de Embarcaciones de Recreo.','REGLAS Y PROCEDENCIA')}<section class="prose"><h2>Cómo se aprueba</h2><p>45 preguntas independientes, con cuatro respuestas posibles y una correcta. Dispones de 90 minutos. Debes conseguir al menos 32 aciertos y no superar los límites de error en Balizamiento (2), Reglamento Internacional para Prevenir los Abordajes (5) y Carta de navegación (2). Una pregunta en blanco no suma un acierto y se computa como error para estos criterios.</p>${distributionTable()}<p>Este simulador reproduce el examen completo. No aplica la prueba complementaria para quienes ya tienen el título de Patrón para Navegación Básica.</p><p><a href="${RULES_URL}" target="_blank" rel="noopener">Real Decreto 875/2014, anexo II, apartado 3 · Boletín Oficial del Estado ↗</a><br>Consulta realizada el 1 de noviembre de 2026.</p><h2>De dónde salen las preguntas</h2><p>Banco propio exportado de Boat Málaga el 1 de noviembre de 2026: 1.464 preguntas de 149 tests. Las respuestas correctas son las que figuraban en el banco de origen; no se ha realizado una revisión académica de todas las soluciones. Los simulacros no son exámenes emitidos por una administración.</p><p>En estudio se conservan las repeticiones entre tests. En cada simulacro se evitan preguntas idénticas. Las opciones mantienen el orden del banco, para respetar referencias como «todas las anteriores».</p><h2>Material para los ejercicios de carta</h2><p>Algunos ejercicios requieren la carta de prácticas del Estrecho de Gibraltar, regla, transportador y compás. La web incluye las ocho imágenes originales del banco. No incorpora una carta náutica interactiva ni recalcula los datos de los enunciados.</p><h2>Tu progreso</h2><p>Los avances de los tests por tema y los resultados finales de los simulacros se guardan localmente en este navegador. Los tests de 10 preguntas guardan sus respuestas y posición. El simulacro de 45 no guarda el avance: recargar o cerrar la pestaña lo descarta. Mientras permanezca abierta el tiempo continúa y, al entregar, se guarda el resultado final.</p></section>`;
}
function notFound() { return `${heading('Ese rumbo no está en la carta.','La página o el simulacro ya no está disponible en este navegador.')}<a class="btn" href="#/temas">Volver a los temas</a>`; }
function render(focus=true) {
  if(!bank)return;
  cancelQuestionTransition();
  clearInterval(timer);timer=null;
  const {path,params}=currentRoute();
  const nav=path.startsWith('/tema')||path.startsWith('/practica')?'temas':path.startsWith('/simulacro')||path==='/examen'?'simulacro':path.startsWith('/historial')||path.startsWith('/resultado')?'historial':'';
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  main.className=path==='/examen'?'exam-main':'';
  document.body.classList.toggle('in-exam',path==='/examen');
  if(path==='/examen')renderExam();
  else if(path==='/temas'||path==='/')main.innerHTML=home();
  else if(/^\/tema\/\d+$/.test(path))main.innerHTML=topicPage(Number(path.split('/')[2]),params);
  else if(/^\/practica\/\d+\/\d+$/.test(path))main.innerHTML=practicePage(Number(path.split('/')[2]),Number(path.split('/')[3]));
  else if(path==='/simulacro')main.innerHTML=setup();
  else if(path==='/historial')main.innerHTML=historyPage();
  else if(path.startsWith('/resultado/'))main.innerHTML=resultsPage(path.split('/')[2]);
  else if(path==='/reglas')main.innerHTML=rulesPage();
  else main.innerHTML=notFound();
  document.title=(main.querySelector('h1')?.innerText.replace(/\s+/g,' ')||'Estudiar')+' · Bitácora PER';
  if(focus){main.style?.removeProperty('min-height');window.scrollTo(0,0);main.focus({preventScroll:true});}
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
  if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target.closest('input,button,a,select,textarea,summary,[contenteditable="true"]'))return;
  const direction=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0;
  if(direction&&navigateQuestion(direction))e.preventDefault();
});
function renderExamSafely(){clearInterval(timer);renderExam();}
document.addEventListener('click',e=>{
  if(e.target.closest('.skip')){e.preventDefault();main.focus();return;}
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;
  const a=button.dataset.action;
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
  if(a==='reload')location.reload();
});
window.addEventListener('hashchange',()=>render());
window.addEventListener('storage',e=>{const path=currentRoute().path;if(e.key?.startsWith(PREFIX)&&(path.startsWith('/practica/')||(e.key===PREFIX+'autoAdvance'&&path==='/examen')))render(false);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentRoute().path==='/examen')render(false);});
async function init() {
  try {
    const response=await fetch('bank.json',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(data.topics?.length!==11||data.questions?.length!==1464)throw Error('Banco incompleto');
    bank=data;questionMap=new Map(bank.questions.map(q=>[q.id,q]));practiceMap=new Map(bank.topics.map(t=>[t.id,practiceBlocks(bank.questions,t.id)]));
    const saved=activeSession();if(saved&&remaining(saved.deadline)===0){finish(true);return;}
    render(false);
  } catch {
    main.innerHTML='<div class="empty-state"><h1>No se han podido cargar las preguntas.</h1><p>Comprueba tu conexión y vuelve a intentarlo. Tu progreso guardado sigue en este navegador.</p><button class="btn" data-action="reload">Volver a cargar</button></div>';
  }
}
init();
