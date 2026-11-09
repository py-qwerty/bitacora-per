import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../dist/core.js';

// Exercise the real application event handlers with the touch-capture event
// sequence that differs from mouse dragging. No browser/hardware is emulated.
async function fixture() {
  const handlers = new Map(), stored = new Map();
  const classes = { add(){},remove(){},toggle(){} };
  const panel = {style:{removeProperty(name){delete this[name];}},classList:classes};
  const heading = {innerText:'Pregunta',setAttribute(){},focus(){}};
  const elements = new Map();
  const element = id => {
    if(!elements.has(id))elements.set(id,{open:false,addEventListener(){},focus(){},classList:classes});
    return elements.get(id);
  };
  let captured = false;
  const main = {
    innerHTML:'',classList:classes,
    addEventListener(type,handler){handlers.set(type,handler);},
    querySelector(selector){return selector==='h1'?heading:panel;},
    setPointerCapture(){captured=true;},
    hasPointerCapture(){return captured;},
    releasePointerCapture(){captured=false;},focus(){}
  };
  const document = {
    body:{classList:classes},addEventListener(){},querySelectorAll(){return [];},
    querySelector(selector){
      if(selector==='#main')return main;
      if(selector.includes('exam-question'))return heading;
      if(selector.includes('question-panel'))return panel;
      return element(selector);
    }
  };
  const window = {addEventListener(){},scrollTo(){}};
  const localStorage = {getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
  const bank=JSON.parse(readFileSync(new URL('../dist/bank.json',import.meta.url)));
  const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8')
    .replace(/^import[^\n]+\n/gm,'').replace(/\ninit\(\);\s*$/,'\nawait init();');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  await new AsyncFunction(...Object.keys(core),'openChart','closeChart','isChartOpen','document','window','location','localStorage','fetch','innerWidth',source)(
    ...Object.values(core),()=>{},()=>{},()=>false,document,window,{hash:'#/practica/1/1'},localStorage,
    async()=>({ok:true,json:async()=>bank}),390
  );
  assert(main.innerHTML.includes('Pregunta 1'));
  const answer={closest(){return null;}};
  const event=(x,y,target=answer)=>({isPrimary:true,pointerType:'touch',pointerId:7,clientX:x,clientY:y,target,preventDefault(){}});
  return {main,handlers,event,stored,answer,setCaptured:value=>{captured=value;}};
}

test('touch capture transfer from answer child does not cancel the swipe or mark an answer',async()=>{
  const f=await fixture();
  f.handlers.get('pointerdown')(f.event(290,260));
  f.handlers.get('pointermove')(f.event(190,262));
  // The child implicitly captured on touch-down loses capture to main. This
  // loss bubbles through main before the finger is lifted.
  f.handlers.get('lostpointercapture')(f.event(190,262,f.answer));
  f.handlers.get('pointerup')(f.event(90,264));
  const p=JSON.parse(f.stored.get('bitacora-per:v1:practice:1:1'));
  assert.equal(p.index,1);assert.deepEqual(p.answers,{});
});
test('actual main capture loss cancels the gesture',async()=>{
  const f=await fixture();f.handlers.get('pointerdown')(f.event(290,260));
  f.handlers.get('pointermove')(f.event(190,262));f.setCaptured(false);
  f.handlers.get('lostpointercapture')(f.event(190,262,f.main));
  f.handlers.get('pointerup')(f.event(90,264));
  assert.equal(f.stored.size,0);
});
test('vertical touch scrolling never changes the question',async()=>{
  const f=await fixture();f.handlers.get('pointerdown')(f.event(210,260));
  f.handlers.get('pointermove')(f.event(220,340));f.handlers.get('pointerup')(f.event(225,420));
  assert.equal(f.stored.size,0);
});
