export const QUOTAS = Object.freeze([4, 2, 4, 2, 5, 10, 2, 3, 4, 5, 4]);
export const LIMITS = Object.freeze({ 5: 2, 6: 5, 11: 2 });
export const DURATION = 90 * 60 * 1000;
export const RULES_URL = 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-10344#ai-2';
export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const signature = q => JSON.stringify([q.text.trim().toLowerCase(), q.options.map(o => o.text.trim()), q.correct, q.image]);
export function generateExam(questions, random = Math.random) {
  const selected = QUOTAS.flatMap((count, i) => {
    const unique = [...new Map(questions.filter(q => q.topic === i + 1).map(q => [signature(q), q])).values()];
    if (unique.length < count) throw Error(`No hay suficientes preguntas en el tema ${i + 1}.`);
    return shuffle(unique, random).slice(0, count);
  });
  return shuffle(selected, random);
}
export function gradeExam(questions, answers) {
  const byTopic = QUOTAS.map((_, i) => ({ topic: i + 1, total: 0, correct: 0, wrong: 0, blank: 0, errors: 0, limit: LIMITS[i + 1] ?? null }));
  questions.forEach(q => {
    const row = byTopic[q.topic - 1];
    row.total++;
    if (answers[q.id] === q.correct) row.correct++;
    else { row.errors++; answers[q.id] ? row.wrong++ : row.blank++; }
  });
  const correct = byTopic.reduce((sum, t) => sum + t.correct, 0);
  const blank = byTopic.reduce((sum, t) => sum + t.blank, 0);
  const errors = questions.length - correct;
  const reasons = [];
  if (correct < 32) reasons.push(`Necesitas al menos 32 aciertos; has conseguido ${correct}.`);
  for (const t of byTopic) if (t.limit !== null && t.errors > t.limit) reasons.push(`Tema ${t.topic}: ${t.errors} errores; máximo ${t.limit}.`);
  return { correct, blank, errors, wrong: errors - blank, passed: reasons.length === 0, reasons, byTopic };
}
export function remaining(deadline, now = Date.now()) { return Math.max(0, deadline - now); }
export function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}
export function isValidSession(s, questionMap) {
  return s && typeof s.id === 'string' && s.ids?.length === 45 && new Set(s.ids).size === 45 && s.ids.every(id => questionMap.has(id)) && Number.isFinite(s.deadline) && Number.isFinite(s.startedAt) && s.answers && typeof s.answers === 'object' && Array.isArray(s.flags) && Number.isInteger(s.index) && s.index >= 0 && s.index < 45 && Object.entries(s.answers).every(([id, value]) => s.ids.includes(id) && questionMap.get(id).options.some(o => o.key === value));
}

export function practiceBlocks(questions, topic) {
  const list = questions.filter(q => q.topic === topic).sort((a,b) => a.test.localeCompare(b.test,'es',{numeric:true}) || a.order-b.order || a.id.localeCompare(b.id));
  const blocks = [];
  for(let i=0;i<list.length;i+=10) {
    const block=list.slice(i,i+10);
    for(const q of list) { if(block.length>=10)break; if(!block.some(x=>x.id===q.id))block.push(q); }
    if(block.length!==10)throw Error('No hay suficientes preguntas para un test de diez.');
    blocks.push(block);
  }
  return blocks;
}
export function validPractice(p,ids,map) {
  return p && Array.isArray(p.ids) && p.ids.join(',')===ids.join(',') && Number.isInteger(p.index) && p.index>=0 && p.index<10 && p.answers && typeof p.answers==='object' && Array.isArray(p.checked) && Object.entries(p.answers).every(([id,a])=>ids.includes(id)&&map.get(id)?.options.some(o=>o.key===a));
}

export function swipeDirection(dx,dy) {
  return Math.abs(dx)>=44&&Math.abs(dx)>Math.abs(dy)*1.25?(dx<0?1:-1):0;
}
