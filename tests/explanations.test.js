import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const bank = JSON.parse(readFileSync(new URL('../dist/bank.json', import.meta.url)));
const { version, items } = JSON.parse(readFileSync(new URL('../dist/explanations.json', import.meta.url)));
test('every question explains each of its options',()=>{
  assert.equal(version,bank.version);
  assert.equal(Object.keys(items).length,bank.questions.length);
  for(const q of bank.questions){
    const e=items[q.id];assert(e,`sin explicación: ${q.id}`);
    for(const o of q.options)assert(typeof e[o.key]==='string'&&e[o.key].trim().length>10,`${q.id}: opción ${o.key}`);
    assert.deepEqual(Object.keys(e).filter(k=>k!=='review').sort(),q.options.map(o=>o.key).sort());
  }
});
test('repeated questions share their explanation',()=>{
  const seen=new Map();
  for(const q of bank.questions){
    const key=q.text.trim()+'|'+q.options.map(o=>o.text.trim()).join('|');
    if(seen.has(key))assert.deepEqual(items[q.id],items[seen.get(key)]);else seen.set(key,q.id);
  }
});
