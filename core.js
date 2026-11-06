/* GhostWorld's deterministic experiment core. No DOM and no external dependencies.
 * World state is PRIVATE: predictors only receive sampled observations, never truth.
 * Mechanics are synthetic and intentionally auditable, not trained neural inference.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GhostCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WIDTH = 1000, HEIGHT = 620, TAU = Math.PI * 2;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const lerp = (a,b,t) => a + (b-a)*t;
  const length = (x,y) => Math.hypot(x,y);
  function rand(seed) { let n=seed>>>0 || 1; return () => { n ^= n<<13; n^=n>>>17; n^=n<<5; return (n>>>0)/4294967296; }; }
  function turnMove(s, dt, omega) {
    let x=s.x,y=s.y,vx=s.vx,vy=s.vy;
    const a=omega*dt, speed=Math.hypot(vx,vy);
    if(Math.abs(omega)>1e-5){
      x+=(Math.sin(a)*vx-(1-Math.cos(a))*vy)/omega;
      y+=((1-Math.cos(a))*vx+Math.sin(a)*vy)/omega;
    } else { x+=vx*dt; y+=vy*dt; }
    const c=Math.cos(a),sn=Math.sin(a);
    return {x,y,vx:c*vx-sn*vy,vy:sn*vx+c*vy,omega,speed};
  }
  function targetPath(s, elapsed, omega) { // only from a remembered measurement
    const q=turnMove(s, elapsed, omega);
    // Mirror reflections are an explicit prior, not hidden ground-truth access.
    const reflect=(v, lo, hi)=>{
      const size=hi-lo, n=((v-lo)%(2*size)+2*size)%(2*size);
      return lo+(n>size?2*size-n:n);
    };
    q.x=reflect(q.x,30,WIDTH-30); q.y=reflect(q.y,35,HEIGHT-35);
    return q;
  }
  const COLORS=['#5ae6f1','#f6a3dc'];
  class World {
    constructor(seed=7){this.rng=rand(seed);this.time=0;this.objects=[];
      for(let i=0;i<2;i++){
        const phase=i?2.35:-.9, speed=i?83:98;
        this.objects.push({id:i,x:i?770:220,y:i?390:228,vx:Math.cos(phase)*speed,vy:Math.sin(phase)*speed,
        theta:phase,omega:i?-.32:.47,r:16,color:COLORS[i],mark:i?'◆':'●',seq:i?2.2:0.3});
      }
    }
    step(dt){this.time+=dt;for(const o of this.objects){
      // Turns are smooth but not perfectly forecastable; randomized seed changes cadence.
      let desired=(o.id?-.33:.44)+.2*Math.sin(this.time*.43+o.seq)+.18*Math.sin(this.time*.19+2.3*o.seq);
      if(o.x<90 || o.x>WIDTH-90) desired+=clamp((WIDTH/2-o.x)/360,-1,1)*1.25;
      if(o.y<90 || o.y>HEIGHT-90) desired+=clamp((HEIGHT/2-o.y)/210,-1,1)*.95;
      o.omega=lerp(o.omega,desired,clamp(dt*1.35,0,1));
      const newAngle=o.theta+o.omega*dt;
      o.theta=newAngle;const speed=o.id?83:98;
      o.vx=speed*Math.cos(newAngle);o.vy=speed*Math.sin(newAngle);
      o.x+=o.vx*dt;o.y+=o.vy*dt;
      if(o.x<25){o.x=25;o.theta=Math.PI-o.theta;}
      if(o.x>WIDTH-25){o.x=WIDTH-25;o.theta=Math.PI-o.theta;}
      if(o.y<25){o.y=25;o.theta=-o.theta;}
      if(o.y>HEIGHT-25){o.y=HEIGHT-25;o.theta=-o.theta;}
    }}
    // Objects within the wall are not observed. No sensor output during blackout.
    observe(blackout=false, wall=true, noise=0){
      if(blackout)return [];
      return this.objects.filter(o=>!wall || !(o.x>450 && o.x<560)).map(o=>({
        id:o.id,x:o.x+(this.rng()-.5)*2*noise,y:o.y+(this.rng()-.5)*2*noise,
        color:o.color,mark:o.mark,t:this.time
      }));
    }
    snapshot(){return this.objects.map(o=>({id:o.id,x:o.x,y:o.y,color:o.color,mark:o.mark,theta:o.theta}));}
  }
  class Belief {
    constructor(){this.tracks=new Map();this.observationCount=0;}
    observe(m){
      let b=this.tracks.get(m.id);
      if(!b){this.tracks.set(m.id,{...m,vx:0,vy:0,omega:0,speed:0,ready:false,observedAt:m.t,
        lastRaw:{x:m.x,y:m.y,t:m.t},uncertainty:18});this.observationCount++;return;}
      const delta=m.t-b.lastRaw.t;
      if(delta<.055)return;
      const rawvx=(m.x-b.lastRaw.x)/delta,rawvy=(m.y-b.lastRaw.y)/delta;
      if(delta<.48){
        if(!b.ready){b.vx=rawvx;b.vy=rawvy;b.ready=true;}
        else{
          const newHeading=Math.atan2(rawvy,rawvx), oldHeading=Math.atan2(b.vy,b.vx);
          const measuredTurn=clamp(wrap(newHeading-oldHeading)/delta,-2,2);
          b.omega=lerp(b.omega,measuredTurn,.21);
          b.vx=lerp(b.vx,rawvx,.55);b.vy=lerp(b.vy,rawvy,.55);
        }
      } else {
        // Reacquisition: do not infer giant false velocity from the hidden interval.
        // Retain prior velocity until a second new visible observation arrives.
        b.ready=false;
      }
      b.x=m.x;b.y=m.y;b.observedAt=m.t;b.lastRaw={x:m.x,y:m.y,t:m.t};
      b.color=m.color;b.mark=m.mark;b.uncertainty=14;
      this.observationCount++;
    }
    // Predictions depend only on measurements from observe(), not World state.
    predict(t, mode='multi') {
      const result=[];
      for(const b of this.tracks.values()){
        const dt=Math.max(0,t-b.observedAt);
        const turn=b.ready?clamp(b.omega,-1.4,1.4):0;
        const split=clamp(.19+dt*.085,.19,.42);
        const turns=mode==='straight'?[0]:mode==='hold'?[0]:[turn-.42,turn,turn+.42];
        const weights=mode==='multi'?[split,1-2*split,split]:[1];
        const paths=turns.map(w=>mode==='hold'?{x:b.x,y:b.y,vx:0,vy:0}:targetPath(b,dt,w));
        const x=paths.reduce((s,p,i)=>s+p.x*weights[i],0);
        const y=paths.reduce((s,p,i)=>s+p.y*weights[i],0);
        const spread=Math.sqrt(paths.reduce((s,p,i)=>s+weights[i]*((p.x-x)**2+(p.y-y)**2),0));
        const uncertainty=clamp(12+dt*8+spread*.75,12,230);
        result.push({id:b.id,x,y,color:b.color,mark:b.mark,age:dt,paths,weights,turns,source:{x:b.x,y:b.y,vx:b.vx,vy:b.vy},
          uncertain:uncertainty,spread,omega:turn,ready:b.ready,observedAt:b.observedAt,
          vx:b.vx,vy:b.vy,anchor:{x:b.x,y:b.y}});
      }
      return result;
    }
    // Exact observed track state for independently computed baseline.
    baseline(t){return this.predict(t,'straight');}
    reset(){this.tracks.clear();this.observationCount=0;}
  }
  class Medium {
    constructor(){this.edges=[];this.nodes=Array.from({length:8},()=>({x:0,v:0}));
      for(let i=0;i<8;i++)for(const d of [1,2]){const j=(i+d)%8;
        this.edges.push({a:i,b:j,base:d===1?.20:.052,w:d===1?.20:.052,energy:0});}
      this.t=0;this.learning=true;this.damping=.985;this.plasticity=.27;this.sparks=[];
    }
    excite(id,innovation){const i=(id?4:0)+Math.min(2,Math.floor(Math.abs(innovation)*2));
      this.nodes[i].v+=clamp(innovation*1.6,-1.6,1.6);
      this.nodes[(i+1)%8].v+=.15;
      this.sparks.push({i,t:0});if(this.sparks.length>15)this.sparks.shift();}
    tick(dt){dt=clamp(dt,0,.05);this.t+=dt;
      const acc=this.nodes.map((n,i)=>-.7*n.x);
      let avg=0;
      for(const e of this.edges){const d=this.nodes[e.b].x-this.nodes[e.a].x;
        acc[e.a]+=6*e.w*d;acc[e.b]-=6*e.w*d;
        e.energy=lerp(e.energy,d*d,Math.min(1,dt*8));avg+=e.energy;}
      avg/=this.edges.length;
      const damp=Math.pow(this.damping,dt*60);
      this.nodes.forEach((n,i)=>{n.v=(n.v+acc[i]*dt)*damp;n.x=clamp(n.x+n.v*dt,-2,2);});
      if(this.learning){for(const e of this.edges){
        // Centered local exposure with a homeostatic term prevents monotonic saturation.
        e.w=clamp(e.w+dt*(this.plasticity*(e.energy-avg)-.008*(e.w-e.base)),.018,.38);
      }}
      this.sparks=this.sparks.filter(s=>(s.t+=dt)<1.25);
    }
    // Snapshot-only wave probe: neither fast state nor conductances are changed.
    probe(freq=1.4, port=2){
      const x=Array(8).fill(0),v=Array(8).fill(0),dt=1/90,steps=120;let response=0;
      for(let k=0;k<steps;k++){
        const a=x.map(z=>-.7*z);
        for(const e of this.edges){const d=(x[e.b]-x[e.a])*6*e.w;a[e.a]+=d;a[e.b]-=d;}
        a[port]+=.2*Math.sin(TAU*freq*k*dt);
        for(let i=0;i<8;i++){v[i]=(v[i]+a[i]*dt)*.997;x[i]+=v[i]*dt;}
        response+=(x[0]*.7+x[3]*-.4+x[6]*.3)**2;
      }
      return Math.sqrt(response/steps);
    }
    snapshot(){return {nodes:this.nodes.map(n=>({...n})),edges:this.edges.map(e=>({...e})),
      sparks:this.sparks.map(s=>({...s})),t:this.t};}
  }
  function score(pred,truth){
    const pairs=pred.map(p=>{const q=truth.find(o=>o.id===p.id);return q?Math.hypot(q.x-p.x,q.y-p.y):null;}).filter(v=>v!==null);
    return pairs.length?pairs.reduce((a,b)=>a+b,0)/pairs.length:null;
  }
  return {World,Belief,Medium,WIDTH,HEIGHT,COLORS,clamp,turnMove,targetPath,score,rand};
});
