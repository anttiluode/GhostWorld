/* GhostWorld UI: browser-only, no libraries / server / webcam / model download.
   Core world model never receives hidden positions. See README for falsification gates. */
(() => {
'use strict';
const C=window.GhostCore;
if(!C){document.body.textContent='GhostWorld core failed to load.';return;}
const $=id=>document.getElementById(id);
const worldCanvas=$('world'), beliefCanvas=$('belief'), mediumCanvas=$('medium');
const wc=worldCanvas.getContext('2d'),bc=beliefCanvas.getContext('2d'),mc=mediumCanvas.getContext('2d');
const W=C.WIDTH,H=C.HEIGHT,TAU=Math.PI*2;
let world,belief,medium,paused=false,blackout=false,blackoutAt=0,autoUntil=null;
let mode='multi',wall=true,trails=true,frames=[],replayIndex=-1,lastFrameAt=performance.now(),carry=0;
let lastScore=null,reveals=0,modelWins=0,judged=0,seed=1302,measured=0,mediumValue=0;
const sensorTrails=[[],[]],ghostTrails=[[],[]],scores=[];
const starRand=C.rand(892734);
const stars=Array.from({length:130},()=>({x:starRand()*W,y:starRand()*H,r:starRand()*1.5+.24,a:starRand()*.45+.1}));
const shortTime=n=>{const m=Math.floor(n/60),s=(n%60);return `${String(m).padStart(2,'0')}:${s.toFixed(1).padStart(4,'0')}`};
const fixed=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';
const color=(c,a=1)=>{let hex=c.replace('#','');let n=parseInt(hex,16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
function restart(){
  world=new C.World(seed++);belief=new C.Belief();medium=new C.Medium();
  medium.learning=$('plasticToggle').checked;medium.plasticity=+$('plasticity').value;
  paused=false;blackout=false;blackoutAt=0;autoUntil=null;frames=[];replayIndex=-1;measured=0;
  sensorTrails.forEach(a=>a.length=0);ghostTrails.forEach(a=>a.length=0);
  reveals=0;modelWins=0;judged=0;lastScore=null;scores.length=0;carry=0;
  $('liveError').textContent='—';$('baselineError').textContent='—';$('blindTime').textContent='—';$('reveals').textContent='0';
  $('liveErrorNote').textContent='Start a blackout to measure';$('baselineNote').textContent='Same last observed states';
  $('winNote').textContent='No winner claimed';$('verdict').textContent='The predictor sees positions only while visible. Its forecasts evolve during blackouts, then are scored before new observations arrive.';
  updateButtons();
}
function startBlackout(auto=false){
 if(blackout)return;
 blackout=true;blackoutAt=world.time;autoUntil=auto?world.time+6:null;
 updateButtons();
}
function reveal(){
 if(!blackout)return;
 // EVALUATOR IS THE ONLY PLACE THAT JOINS TRUTH WITH BLIND PREDICTIONS.
 // Predictions are calculated BEFORE the sensor is reconnected or the memory is updated.
 const predicted=belief.predict(world.time,mode);
 const control=belief.baseline(world.time);
 const truth=world.snapshot();
 const e=C.score(predicted,truth),b=C.score(control,truth),elapsed=world.time-blackoutAt;
 lastScore={error:e,baseline:b,elapsed,at:world.time};reveals++;
 if(e!==null && b!==null){judged++;if(e<b)modelWins++;scores.push(lastScore);}
 blackout=false;autoUntil=null;
 $('liveError').textContent=e===null?'—':fixed(e,1);
 $('baselineError').textContent=b===null?'—':fixed(b,1);
 $('blindTime').textContent=fixed(elapsed,1)+'s';$('reveals').textContent=String(reveals);
 $('liveErrorNote').textContent='Pre-observation displacement';
 $('baselineNote').textContent='Simple constant velocity';
 $('winNote').textContent=judged?`${modelWins} / ${judged} reveals better`:'No comparable tracks yet';
 if(e===null){$('verdict').textContent='No usable prior observations existed. Let the objects move in view before blackout.';}
 else {$('verdict').textContent=`Blind reveal: ${e<b?'3-path model improved over':e>b?'3-path model lost to':'3-path model tied'} the linear baseline (${fixed(e,1)} vs ${fixed(b,1)} scene units). This is a measured result, not a guaranteed win.`;}
 updateButtons();
}
function updateButtons(){
 $('blackoutText').textContent=blackout?'REVEAL':'BLACKOUT';$('blackout').classList.toggle('revealing',blackout);
 $('pauseText').textContent=paused?'RESUME':'PAUSE';$('pauseIcon').textContent=paused?'▶':'Ⅱ';
 $('liveChip').textContent=blackout?'SENSOR OFFLINE':paused?'PAUSED':'OBSERVING';
 $('liveChip').classList.toggle('active',!blackout&&!paused);$('liveChip').classList.toggle('danger',blackout);
 $('blackoutLabel').classList.toggle('hidden',!blackout);
 $('beliefBadge').textContent=blackout?'BLIND PREDICTION':paused?'TIME FROZEN':'LIVE FORECAST';
 $('replayStatus').textContent=replayIndex>=0?'REPLAY':'LIVE';
}
function addTrail(to,p,t){const a=to[p.id];if(!a)return;a.push({x:p.x,y:p.y,t});if(a.length>145)a.shift();}
function tick(dt){
 world.step(dt);medium.tick(dt);
 if(blackout && autoUntil!==null && world.time>=autoUntil)reveal();
 // Only sampled, visible sensor measurements are passed to Belief.observe().
 if(world.time-measured>=.095){
   measured=world.time;
   const observations=world.observe(blackout,wall,1.1);
   for(const o of observations){
     const prev=belief.tracks.get(o.id);
     if(prev){const dx=o.x-prev.x,dy=o.y-prev.y;
       const c=prev.vx*dy-prev.vy*dx;
       // Signal is derived from observed innovation only, never hidden ground truth.
       medium.excite(o.id,C.clamp(c/700,-.8,.8));
     }else medium.excite(o.id,.25);
     belief.observe(o);addTrail(sensorTrails,o,world.time);
   }
 }
 if(Math.floor(world.time*12)!==Math.floor((world.time-dt)*12)){
   const pred=belief.predict(world.time,mode);
   pred.forEach(o=>addTrail(ghostTrails,o,world.time));
   frames.push({t:world.time,blackout,wall,truth:world.snapshot(),pred,baseline:belief.baseline(world.time),
     wave:medium.snapshot(),sensorTrails:sensorTrails.map(a=>a.slice(-58)),ghostTrails:ghostTrails.map(a=>a.slice(-58))});
   if(frames.length>480)frames.shift(); // 40 seconds at 12 samples/s
 }
}
function backdrop(ctx,view,t){
 ctx.clearRect(0,0,W,H);
 const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#070f20');g.addColorStop(.56,'#0c1d2e');g.addColorStop(1,'#080f20');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 const halo=ctx.createRadialGradient(W*.52,H*.52,8,W*.52,H*.52,450);
 halo.addColorStop(0,view==='belief'?'#12536340':'#24416436');halo.addColorStop(1,'#07101d00');ctx.fillStyle=halo;ctx.fillRect(0,0,W,H);
 for(const s of stars){ctx.globalAlpha=s.a*(.8+.2*Math.sin(t*.4+s.x));ctx.fillStyle='#b4dae5';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,TAU);ctx.fill();}ctx.globalAlpha=1;
 ctx.strokeStyle='#2e536444';ctx.lineWidth=1;for(let x=0;x<=W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
 for(let y=0;y<=H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 ctx.strokeStyle='#6397b322';for(let x=0;x<=W;x+=192){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
 const horizon=ctx.createLinearGradient(0,H*.7,0,H);horizon.addColorStop(0,'#0c1a2900');horizon.addColorStop(1,'#18527730');ctx.fillStyle=horizon;ctx.fillRect(0,H*.7,W,H*.3);
 ctx.font='11px monospace';ctx.fillStyle='#67859a';ctx.fillText('X / POSITION',28,H-19);
 ctx.textAlign='right';ctx.fillText(view==='belief'?'INFERRED / UNOBSERVED':'CAMERA / MEASURED',W-24,H-19);ctx.textAlign='left';
}
function drawWall(ctx,infront=true){
 const x=450,w=110;
 ctx.fillStyle=infront?'#080f1eee':'#10192765';ctx.fillRect(x,0,w,H);
 const grad=ctx.createLinearGradient(x,0,x+w,0);grad.addColorStop(0,'#446b8150');grad.addColorStop(.5,'#0c1b2b66');grad.addColorStop(1,'#446b8150');ctx.fillStyle=grad;ctx.fillRect(x,0,w,H);
 ctx.strokeStyle=infront?'#56738a70':'#53758835';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.moveTo(x+w,0);ctx.lineTo(x+w,H);ctx.stroke();
 ctx.save();ctx.translate(x+w/2,H/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.font='bold 12px monospace';ctx.fillStyle=infront?'#71899d':'#547082';ctx.fillText('OCCLUSION ZONE',0,0);ctx.restore();
}
function path(ctx,points,col,alpha=1,width=2,dash=[]){
 if(points.length<2)return;ctx.save();ctx.strokeStyle=color(col,alpha);ctx.lineWidth=width;ctx.setLineDash(dash);ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.stroke();ctx.restore();
}
function orb(ctx,o,ghost=false,opacity=1){
 const c=o.color??'#5ae6f1';ctx.save();ctx.globalAlpha=opacity;
 const r=ghost?18:16;const glow=ctx.createRadialGradient(o.x,o.y,1,o.x,o.y,58);
 glow.addColorStop(0,color(c,ghost?.40:.36));glow.addColorStop(.27,color(c,.16));glow.addColorStop(1,color(c,0));ctx.fillStyle=glow;ctx.beginPath();ctx.arc(o.x,o.y,58,0,TAU);ctx.fill();
 ctx.strokeStyle=color(c,ghost?.52:.83);ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(o.x,o.y,r+8,0,TAU);ctx.stroke();
 const g=ctx.createRadialGradient(o.x-6,o.y-7,2,o.x,o.y,r);
 g.addColorStop(0,'#ffffff');g.addColorStop(.15,c);g.addColorStop(1,color(c,.35));ctx.fillStyle=g;ctx.beginPath();ctx.arc(o.x,o.y,r,0,TAU);ctx.fill();
 const mx=o.x+6,my=o.y-6;ctx.fillStyle='#fff0ab';ctx.shadowColor='#f6c45a';ctx.shadowBlur=13;
 ctx.beginPath();if(o.mark==='◆'){ctx.moveTo(mx,my-5);ctx.lineTo(mx+5,my);ctx.lineTo(mx,my+5);ctx.lineTo(mx-5,my);}else ctx.arc(mx,my,4.5,0,TAU);ctx.fill();ctx.shadowBlur=0;
 ctx.fillStyle=color(c,.9);ctx.font='12px monospace';ctx.fillText(`ID ${o.id}`,o.x+30,o.y-28);
 ctx.restore();
}
function drawObserved(ctx,frame){
 const t=frame.t;backdrop(ctx,'real',t);
 for(const a of frame.sensorTrails)path(ctx,a,a.length&&a[0]?.id===1?'#f4a1db':'#5ae6f1',.46,2);
 for(const o of frame.truth){if(frame.blackout)continue;if(frame.wall&&o.x>450&&o.x<560)continue;orb(ctx,o,false,1);}
 if(frame.wall)drawWall(ctx,true);
 if(frame.blackout){ctx.fillStyle='#050a13f0';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#263e58';ctx.strokeRect(8,8,W-16,H-16);}
 ctx.save();ctx.fillStyle=frame.blackout?'#d3a780':'#6ff1d0';ctx.font='bold 13px monospace';ctx.fillText(frame.blackout?'● SENSOR CUT':'● SENSOR ACTIVE',24,33);ctx.restore();
}
function drawPrediction(ctx,frame){
 const t=frame.t;backdrop(ctx,'belief',t);
 for(let id=0;id<2;id++){
  const a=frame.ghostTrails[id];path(ctx,a,C.COLORS[id],.32,1.9);
 }
 if(frame.wall)drawWall(ctx,false);
 for(const p of frame.pred){
   const col=p.color;
   if(trails&&p.age>.08&&p.source){
    for(let i=0;i<p.paths.length;i++){
     const omega=p.turns[i],steps=30,pts=[];
     for(let k=0;k<=steps;k++)pts.push(C.targetPath(p.source,(p.age*k/steps),omega));
     path(ctx,pts,i===1?col:'#f7c779',i===1?.65:.34,i===1?2.6:1.4,i===1?[]:[5,8]);
     if(i!==1){ctx.fillStyle=color('#f7c779',.40);ctx.beginPath();ctx.arc(p.paths[i].x,p.paths[i].y,5,0,TAU);ctx.fill();}
    }
   }
   const rr=Math.min(230,p.uncertain);
   ctx.fillStyle=color(col,.035);ctx.strokeStyle=color(col,.25);ctx.lineWidth=1.4;ctx.setLineDash([5,8]);
   ctx.beginPath();ctx.ellipse(p.x,p.y,rr,rr*.65,0,0,TAU);ctx.fill();ctx.stroke();ctx.setLineDash([]);
   if(p.age>.08){path(ctx,[p.anchor,{x:p.x,y:p.y}],col,.24,1.4,[4,7]);}
   orb(ctx,p,true,Math.max(.47,1-p.age*.022));
   ctx.fillStyle='#a6b9c8';ctx.font='12px monospace';ctx.fillText(`Δ ${p.age.toFixed(1)}s`,p.x+30,p.y-12);
 }
 ctx.font='bold 13px monospace';ctx.fillStyle='#e8a4dd';ctx.fillText(frame.blackout?'◈ RUNNING WITHOUT SENSORS':'◈ OBSERVATION-CONDITIONED',24,33);
}
function drawMedium(data){
 const ctx=mc,w=mediumCanvas.width,h=mediumCanvas.height;
 ctx.clearRect(0,0,w,h);const t=data.t||0;
 const bg=ctx.createRadialGradient(w/2,h/2,15,w/2,h/2,250);bg.addColorStop(0,'#123a4b');bg.addColorStop(1,'#080e1a');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#17394d';ctx.lineWidth=1;for(let r=52;r<200;r+=44){ctx.beginPath();ctx.arc(w/2,h/2,r,0,TAU);ctx.stroke();}
 const pts=data.nodes.map((n,i)=>{const a=i*TAU/8-Math.PI/2;return {x:w/2+Math.cos(a)*(102+n.x*25),y:h/2+Math.sin(a)*(102+n.x*25)};});
 for(const e of data.edges){const a=pts[e.a],b=pts[e.b],strength=C.clamp((e.w-.018)/.35,0,1);
    ctx.strokeStyle=color(e.b===(e.a+1)%8?'#5be3eb':'#ecae87',.25+.66*strength);ctx.lineWidth=1+strength*4;
    ctx.shadowColor='#49d6eb';ctx.shadowBlur=5*strength;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.shadowBlur=0;
    // An optical flow marker moves with simulation time. Visual only.
    const p=(t*.14+e.a*.17+e.b*.07)%1;ctx.fillStyle=color('#aeedfa',.16+strength*.55);ctx.beginPath();ctx.arc(a.x+(b.x-a.x)*p,a.y+(b.y-a.y)*p,1.6,0,TAU);ctx.fill();
 }
 for(const sp of data.sparks){const p=pts[sp.i],r=sp.t*52;ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.strokeStyle=color('#ffd99a',Math.max(0,(1-sp.t/1.25)*.55));ctx.lineWidth=1.3;ctx.stroke();}
 for(let i=0;i<pts.length;i++){
   const p=pts[i],amp=Math.abs(data.nodes[i].x);
   const g=ctx.createRadialGradient(p.x,p.y,1,p.x,p.y,19);
   g.addColorStop(0,color('#b3fcff',.6));g.addColorStop(1,color('#50dcec',0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,19,0,TAU);ctx.fill();
   ctx.fillStyle='#081d2b';ctx.strokeStyle=amp>.2?'#a6f6fc':'#5aafc6';ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(p.x,p.y,7+Math.min(5,amp*3),0,TAU);ctx.fill();ctx.stroke();
 }
 ctx.font='11px monospace';ctx.fillStyle='#8eb5c5';ctx.fillText('STRUCTURAL EDGE WEIGHTS',15,22);ctx.fillStyle='#b1d9d8';ctx.fillText('FAST MOTION / SLOW WRITES',15,h-14);
}
function takeSnapshot(){return {t:world.time,blackout,wall,truth:world.snapshot(),pred:belief.predict(world.time,mode),
 baseline:belief.baseline(world.time),wave:medium.snapshot(),sensorTrails:sensorTrails.map(a=>a.slice(-58)),ghostTrails:ghostTrails.map(a=>a.slice(-58))};}
function render(){
 const frame=replayIndex>=0&&frames[replayIndex]?frames[replayIndex]:takeSnapshot();
 drawObserved(wc,frame);drawPrediction(bc,frame);drawMedium(frame.wave);
 $('clock').textContent=shortTime(frame.t);$('elapsed').textContent=shortTime(frame.t);
 $('knownCount').textContent=String(frame.pred.length);$('sensorCount').textContent=belief.observationCount+' sensor observations';
 const hidden=Math.max(0,blackout?world.time-blackoutAt:Math.max(...frame.pred.map(p=>p.age),0));
 $('historyChip').textContent=hidden.toFixed(1)+'s unseen';
 $('blackoutLabel').classList.toggle('hidden',!frame.blackout);
 if(replayIndex>=0){$('replayStatus').textContent='REPLAY';}else $('replayStatus').textContent='LIVE';
 $('scrub').max=String(Math.max(1,frames.length-1));$('scrub').value=String(replayIndex>=0?replayIndex:Math.max(0,frames.length-1));
}
let lastProbeAt=0;function animation(now){
 const delta=Math.max(0,Math.min(.08,(now-lastFrameAt)/1000));lastFrameAt=now;
 if(!paused){carry+=delta;let steps=0;while(carry>=1/60&&steps<5){tick(1/60);carry-=1/60;steps++;}}
 render();
 if(now-lastProbeAt>400){lastProbeAt=now;mediumValue=medium.probe(+$('probe').value);
   $('echo').textContent=mediumValue.toFixed(4);$('fps').textContent=Math.round(1/Math.max(.009,delta))+' FPS';}
 requestAnimationFrame(animation);
}
function pause(p){paused=p;carry=0;if(!paused)replayIndex=-1;updateButtons();}
$('blackout').addEventListener('click',()=>{if(blackout)reveal();else startBlackout();});
$('timed').addEventListener('click',()=>{if(blackout)reveal();startBlackout(true);});
$('pause').addEventListener('click',()=>pause(!paused));
$('reset').addEventListener('click',restart);
$('resetMedium').addEventListener('click',()=>{const on=medium.learning,rate=medium.plasticity;medium=new C.Medium();medium.learning=on;medium.plasticity=rate;});
$('probe').addEventListener('input',e=>{$('probeVal').textContent=(+e.target.value).toFixed(2)+' Hz';});
$('plasticity').addEventListener('input',e=>{medium.plasticity=+e.target.value;$('plasticVal').textContent=medium.plasticity.toFixed(2);});
$('plasticToggle').addEventListener('change',e=>{medium.learning=e.target.checked;});
$('wallToggle').addEventListener('change',e=>{wall=e.target.checked;});
$('trailsToggle').addEventListener('change',e=>{trails=e.target.checked;});
$('scrub').addEventListener('input',e=>{if(!paused)pause(true);replayIndex=C.clamp(+e.target.value,0,Math.max(0,frames.length-1));updateButtons();});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
  mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('chosen',x===b));
  const explanations={hold:'Frozen last-observed position. The strictest static memory baseline.',straight:'Constant-velocity extrapolation. A strong, cheap motion baseline.',multi:'Three autonomous constant-turn hypotheses advance between sightings. Their spread visualizes uncertainty. No future frames are supplied.'};
  $('modeExplanation').textContent=explanations[mode];
}));
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;
 if(e.code==='Space'){e.preventDefault();pause(!paused);}if(e.key==='b'||e.key==='B')startBlackout();if(e.key==='r'||e.key==='R')reveal();});
restart();requestAnimationFrame(animation);
})();
