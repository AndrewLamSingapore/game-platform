import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function harness(remembered=false){
  const timeouts=new Map(),intervals=new Map(),events={},writes=[],elements=new Map();let id=0,canceled=0;
  const element=()=>({hidden:false,value:0,children:[],offsetWidth:1,
    classList:{add(){},remove(){}},setAttribute(){},
    addEventListener(name,fn){this[name]=fn},
    querySelector(){return null},querySelectorAll(){return []},
    animate(){return{cancel(){canceled++}}}
  });
  for(const name of ['cinematicStage','cinematicVignette','cinematicPlaceholder','cinematicStatus','cinematicProgress','generateCinematic','replayCinematic'])elements.set('#'+name,element());
  elements.get('#cinematicVignette').querySelectorAll=selector=>selector==='.cinematic-shot'?[element(),element(),element()]:[];
  const document={hidden:false,querySelector:selector=>elements.get(selector)||null,querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn};
  vm.runInNewContext(readFileSync('cinematics.js','utf8'),{
    document,matchMedia:()=>({matches:false}),performance:{now:()=>0},
    localStorage:{getItem:()=>remembered?'1':null,setItem:(...args)=>writes.push(args)},
    setTimeout:fn=>{timeouts.set(++id,fn);return id},clearTimeout:key=>timeouts.delete(key),
    setInterval:fn=>{intervals.set(++id,fn);return id},clearInterval:key=>intervals.delete(key)
  });
  return{timeouts,intervals,events,elements,writes,document,canceled:()=>canceled,
    load:(campaignId,sourceTurn=1)=>events['game:scene-ready']({detail:{campaignId,sourceTurn,worldState:{}}})};
}
test('changing scenes cancels completion and progress from the previous cinematic',()=>{
  const h=harness();h.load('first');h.elements.get('#generateCinematic').click();
  assert.equal(h.timeouts.size,1);assert.equal(h.intervals.size,1);
  h.load('second',2);
  assert.equal(h.timeouts.size,0);assert.equal(h.intervals.size,0);
  assert.ok(h.canceled()>0);assert.equal(h.writes.length,0);
  assert.equal(h.elements.get('#cinematicStage').hidden,true);
});
test('changing scenes cancels remembered-scene autoplay before it can play the new scene',()=>{
  const h=harness(true);h.load('first');assert.equal(h.timeouts.size,1);
  h.load('second');assert.equal(h.timeouts.size,1,'only the second scene autoplay remains');
});
test('backgrounding stops playback without marking an unfinished scene remembered',()=>{
  const h=harness();h.load('first');h.elements.get('#generateCinematic').click();
  h.document.hidden=true;h.events.visibilitychange();
  assert.equal(h.timeouts.size,0);assert.equal(h.intervals.size,0);assert.equal(h.writes.length,0);
});
