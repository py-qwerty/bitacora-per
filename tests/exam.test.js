import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { QUOTAS, LIMITS, DURATION, generateExam, gradeExam, remaining, formatTime, signature, isValidSession } from '../dist/core.js';
const bank = JSON.parse(readFileSync(new URL('../dist/bank.json', import.meta.url)));
const map = new Map(bank.questions.map(q=>[q.id,q]));
const correctAnswers = qs => Object.fromEntries(qs.map(q=>[q.id,q.correct]));
const wrongAnswer = q => q.options.find(o=>o.key!==q.correct).key;
test('complete bank, valid options and local image assets',()=>{
  assert.equal(bank.questions.length,1464);assert.equal(map.size,1464);assert.equal(bank.topics.length,11);
  assert.equal(new Set(bank.questions.map(q=>q.testId)).size,149);
  assert.equal(bank.questions.filter(q=>q.image).length,8);
  for(const q of bank.questions){assert.equal(q.options.length,4);assert(q.options.some(o=>o.key===q.correct));if(q.image)assert(existsSync(new URL('../dist/'+q.image,import.meta.url)));}
});
test('1000 exams have 45 unique questions in the official proportions',()=>{
  assert.equal(QUOTAS.reduce((a,b)=>a+b,0),45);assert.deepEqual(LIMITS,{5:2,6:5,11:2});
  for(let i=0;i<1000;i++){
    const qs=generateExam(bank.questions);assert.equal(qs.length,45);assert.equal(new Set(qs.map(signature)).size,45);
    assert.deepEqual(QUOTAS,bank.topics.map(t=>qs.filter(q=>q.topic===t.id).length));
  }
});
test('passing requires 32 correct and all topic limits',()=>{
  const qs=generateExam(bank.questions);let a=correctAnswers(qs);assert(gradeExam(qs,a).passed);
  const safe=qs.filter(q=>![5,6,11].includes(q.topic));
  for(const q of safe.slice(0,13))a[q.id]=wrongAnswer(q);
  let r=gradeExam(qs,a);assert.equal(r.correct,32);assert.equal(r.errors,13);assert(r.passed);
  a[safe[13].id]=wrongAnswer(safe[13]);assert.equal(gradeExam(qs,a).correct,31);assert(!gradeExam(qs,a).passed);
});
for(const [topic,limit] of Object.entries(LIMITS))test(`topic ${topic} accepts ${limit} errors, rejects ${limit+1} despite enough total correct`,()=>{
  const qs=generateExam(bank.questions),a=correctAnswers(qs),selected=qs.filter(q=>q.topic===Number(topic));
  for(const q of selected.slice(0,limit))a[q.id]=wrongAnswer(q);
  assert(gradeExam(qs,a).passed);a[selected[limit].id]=wrongAnswer(selected[limit]);
  const r=gradeExam(qs,a);assert(r.correct>=32);assert(!r.passed);assert(r.reasons.some(s=>s.includes('Tema '+topic+':')));
});
test('blank answers count as errors for total and subject limits, no negative scoring',()=>{
  const qs=generateExam(bank.questions),a=correctAnswers(qs);for(const q of qs.filter(q=>q.topic===5).slice(0,3))delete a[q.id];
  const r=gradeExam(qs,a);assert.equal(r.blank,3);assert.equal(r.wrong,0);assert.equal(r.correct,42);assert(!r.passed);
  const empty=gradeExam(qs,{});assert.equal(empty.errors,45);assert.equal(empty.blank,45);assert(!empty.passed);
});
test('clock uses fixed deadline and handles background elapsed time',()=>{
  assert.equal(DURATION,5400000);assert.equal(formatTime(DURATION),'90:00');assert.equal(formatTime(1),'00:01');assert.equal(formatTime(0),'00:00');
  assert.equal(remaining(5400000,5399999),1);assert.equal(remaining(5400000,5500000),0);
});
test('session validation rejects corrupt or stale stored data',()=>{
  const qs=generateExam(bank.questions);const s={id:'test',ids:qs.map(q=>q.id),startedAt:0,deadline:DURATION,answers:{},flags:[],index:0};
  assert(isValidSession(s,map));assert(!isValidSession({...s,index:-1},map));assert(!isValidSession({...s,ids:['missing',...s.ids.slice(1)]},map));assert(!isValidSession({...s,answers:{[s.ids[0]]:'z'}},map));assert(!isValidSession(null,map));
});
test('random draw fails clearly if a topic cannot meet its quota',()=>assert.throws(()=>generateExam(bank.questions.filter(q=>q.topic!==11)),/tema 11/));

test('practice blocks are exactly ten and cover every question in every topic',async()=>{
  const {practiceBlocks,validPractice}=await import('../dist/core.js');
  for(const t of bank.topics){
    const blocks=practiceBlocks(bank.questions,t.id),original=bank.questions.filter(q=>q.topic===t.id);
    assert.equal(blocks.length,Math.ceil(original.length/10));assert.equal(new Set(blocks.flat().map(q=>q.id)).size,original.length);
    for(const block of blocks){assert.equal(block.length,10);assert.equal(new Set(block.map(q=>q.id)).size,10);assert(block.every(q=>q.topic===t.id));}
    const ids=blocks[0].map(q=>q.id),p={topic:t.id,block:1,ids,answers:{[ids[0]]:blocks[0][0].correct},index:4,checked:[ids[0]]};
    const restored=JSON.parse(JSON.stringify(p));assert(validPractice(restored,ids,map));assert.equal(restored.index,4);assert.equal(Object.keys(restored.answers).length,1);
    assert(!validPractice({...p,index:10},ids,map));assert(!validPractice({...p,answers:{bad:'a'}},ids,map));
  }
});
test('in-progress mock exams are never written to browser storage',()=>{
  const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
  const update=app.slice(app.indexOf('function updateSession('),app.indexOf('function finish('));
  const start=app.slice(app.indexOf('function startExam('),app.indexOf('const dateFormat'));
  assert(!update.includes('write('));assert(!start.includes('write('));
  const finish=app.slice(app.indexOf('function finish('),app.indexOf('function startExam('));
  assert(finish.indexOf('s.finishedAt =')<finish.indexOf("write('session:'"));
});
