'use strict';
const assert=require('node:assert/strict');
const {World,Belief,Medium,turnMove,targetPath,score}=require('./core.js');
function approx(a,b,e=1e-8){assert.ok(Math.abs(a-b)<e,`${a} != ${b}`)}
const w=new World(12),p=new Belief();
assert.equal(w.observe(true,true).length,0,'blackout yields no measurements');
const first=w.observe(false,false);
assert.equal(first.length,2);first.forEach(x=>p.observe(x));
w.step(.10);w.observe(false,false).forEach(x=>p.observe(x));
const base=p.predict(w.time,'multi');const future=p.predict(w.time+2,'multi');
assert.equal(future.length,2);assert.notDeepEqual(base.map(o=>[o.x,o.y]),future.map(o=>[o.x,o.y]),'state evolves autonomously');
const cloned=new World(12); cloned.step(.10);cloned.objects[0].x=50;
assert.deepEqual(p.predict(w.time+1,'multi'),p.predict(w.time+1,'multi'),'prediction deterministic from memory');
const before=JSON.stringify([...p.tracks.values()]);
for(let i=0;i<120;i++){w.step(1/60);w.observe(true,true).forEach(x=>p.observe(x));}
assert.equal(JSON.stringify([...p.tracks.values()]),before,'no hidden truth leaked to memory');
const q=p.predict(w.time,'straight')[0],held=p.predict(w.time,'hold')[0];
assert.equal(held.x,p.tracks.get(0).x);assert.ok(Number.isFinite(q.x));
const m=new Medium(),same=JSON.stringify(m.snapshot());m.probe(1.5);m.probe(2.5);
assert.equal(JSON.stringify(m.snapshot()),same,'probe must not write or advance the medium');
const a=new Medium();for(let i=0;i<1000;i++){a.excite(i%2,.3);a.tick(.016);}
assert.ok(a.edges.every(e=>e.w>=.018 && e.w<=.38),'bounded conductances');
const other=new Medium();other.learning=false;other.excite(0,.4);other.tick(.016);assert.ok(other.edges.every(e=>e.w===e.base));
const trial=turnMove({x:50,y:50,vx:100,vy:0},1,0);approx(trial.x,150);approx(trial.y,50);
assert.equal(score([{id:0,x:0,y:0}],[{id:0,x:3,y:4}]),5);
const l=targetPath({x:50,y:50,vx:100,vy:0},1,0);approx(l.x,150);
console.log('PASS: blind observation, autonomous prediction, time-based state, no leakage, non-writing probes, bounded edge writes, baselines');
