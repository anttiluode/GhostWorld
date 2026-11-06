'use strict';
// Fake-canvas smoke runner: verifies app.js controls/RAF path without a browser.
// Not a visual-layout test. Run: node test_browser_smoke.js
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('./core.js');
const noop=()=>{};
const gradient={addColorStop:noop};
const ctx=new Proxy({}, {get:(obj,k)=> k in obj?obj[k]:(k==='createLinearGradient'||k==='createRadialGradient'?()=>gradient:noop),set:(obj,k,v)=>(obj[k]=v,true)});
const elements=new Map();
function element(id){if(!elements.has(id)){const listeners={};elements.set(id,{
  id,value:id==='probe'?'1.4':id==='plasticity'?'0.27':'1',checked:true,
  classList:{toggle:noop},style:{},textContent:'',innerText:'',
  getContext:()=>ctx,addEventListener:(type,fn)=>{listeners[type]=fn;},
  click(){listeners.click?.({target:this});},change(v){this.value=v;listeners.input?.({target:this});},
  matches:()=>false,dataset:{},
 });}return elements.get(id)}
const buttons=['hold','straight','multi'].map(mode=>{const e=element('mode-'+mode);e.dataset.mode=mode;return e;});
const document={body:{textContent:''},getElementById:element,
  querySelectorAll:s=>s==='[data-mode]'?buttons:[],addEventListener:noop};
let pending,clock=0;
const env={window:{GhostCore:core},document,performance:{now:()=>clock},requestAnimationFrame:cb=>{pending=cb;},console,Math};
vm.runInNewContext(fs.readFileSync(require.resolve('./app.js'),'utf8'),env,{filename:'app.js'});
function tick(ms=16.7){clock+=ms;const run=pending;pending=null;assert.equal(typeof run,'function');run(clock)}
for(let i=0;i<140;i++)tick();
assert.equal(element('liveChip').textContent,'OBSERVING');
element('blackout').click();for(let i=0;i<180;i++)tick();
assert.equal(element('liveChip').textContent,'SENSOR OFFLINE');
element('blackout').click();tick();assert.equal(element('reveals').textContent,'1');
element('pause').click();assert.equal(element('pauseText').textContent,'RESUME');
element('pause').click();
element('probe').change('1.9');assert.equal(element('probeVal').textContent,'1.90 Hz');
console.log('PASS: initial frame, 140 observed frames, blackout, blind prediction, reveal scoring, pause, probe UI');
