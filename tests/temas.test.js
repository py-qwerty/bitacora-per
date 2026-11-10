import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTema} from '../dist/core.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const bank=json('../dist/bank.json'),index=json('../dist/temas/index.json');
test('every unit has a published study topic that matches its source',()=>{
  assert.deepEqual(index.temas.map(t=>t.topic),bank.topics.map(t=>t.id));
  for(const info of index.temas){
    const tema=json(`../dist/temas/${info.topic}.json`);
    validateTema(tema,bank);
    assert.equal(info.sections,tema.sections.length);
    assert.deepEqual(tema,json(`../content/temas/tema-${String(info.topic).padStart(2,'0')}.json`),'run npm run temas');
  }
});
test('no bank question is left out of the study topics',()=>{
  const covered=new Set(index.temas.flatMap(info=>Object.keys(json(`../dist/temas/${info.topic}.json`).questions)));
  assert.equal(covered.size,bank.questions.length);
  for(const q of bank.questions)assert(covered.has(q.id),q.id);
});
test('a topic that drops or misplaces a question is rejected',()=>{
  const tema=json('../dist/temas/2.json'),id=Object.keys(tema.questions)[0];
  const without=structuredClone(tema);delete without.questions[id];
  assert.throws(()=>validateTema(without,bank),/sin apartado/);
  const wrong=structuredClone(tema);wrong.questions[id]='no-existe';
  assert.throws(()=>validateTema(wrong,bank),/inexistente/);
  const foreign=structuredClone(tema);foreign.questions[bank.questions.find(q=>q.topic===3).id]=tema.sections[0].id;
  assert.throws(()=>validateTema(foreign,bank),/no es de este tema/);
});
