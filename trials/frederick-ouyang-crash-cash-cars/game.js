(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const ui = {
    cash: document.querySelector('#cash'), speed: document.querySelector('#speed'), wrecks: document.querySelector('#wrecks'),
    damageBar: document.querySelector('#damageBar'), overlay: document.querySelector('#overlay'), title: document.querySelector('#overlayTitle'),
    copy: document.querySelector('#overlayCopy'), start: document.querySelector('#startButton'), restart: document.querySelector('#restartButton'), goal: document.querySelector('#goalText')
  };
  const keys = Object.create(null), GOAL = 2000;
  const streets = ['Broadway','7th Street','Figueroa Street','Olympic Boulevard','Grand Avenue','6th Street','Spring Street','Wilshire Boulevard'];
  let state, last = 0, animationId;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const rand = (a,b) => a+Math.random()*(b-a);

  function reset() {
    state = {
      playing:false, won:false, cash:0, damage:0, crashes:0, speed:0, x:0, roadOffset:0, steer:0,
      cameraX:0, cameraY:0, shake:0, flash:0, invincible:0, objects:[], particles:[], spawnTimer:.4, time:0,
      intersectionZ:62, turning:0, turnProgress:0, streetIndex:0
    };
    for (let z=16;z<125;z+=rand(8,14)) spawn(z);
    updateUI();
    showOverlay('Drive. Crash. Get paid.', 'A 3D downtown run where every collision leaves a mark. Earn cash, turn onto side streets, and wreck without limits.', 'Start engine');
  }

  function start() {
    if (state.won) reset();
    state.playing=true; ui.overlay.classList.remove('show'); last=performance.now();
  }
  function showOverlay(title,copy,button){ui.title.textContent=title;ui.copy.textContent=copy;ui.start.textContent=button;ui.overlay.classList.add('show');}
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);}
  function spawn(z=120){
    const lanes=[-1.5,-.5,.5,1.5], lane=lanes[Math.floor(rand(0,4))];
    const traffic=Math.random()<.72;
    state.objects.push({z,x:lane+(traffic?rand(-.08,.08):0),type:traffic?'traffic':'crate',speed:traffic?rand(18,52):0,color:['#ff4f5e','#46a8ee','#f3cd3b','#a76af0'][Math.floor(rand(0,4))],hit:false,damage:0,spin:0});
  }
  function update(dt){
    const s=state;s.time+=dt;s.invincible-=dt;s.flash=Math.max(0,s.flash-dt*3);s.shake*=Math.pow(.03,dt);
    if(s.playing){
      const gas=(keys.KeyW?1:0)-(keys.KeyS?1:0), turn=(keys.KeyD?1:0)-(keys.KeyA?1:0);
      s.speed+=gas*72*dt;s.speed-=Math.min(s.speed,15*dt);s.speed=clamp(s.speed,0,92);
      if(!s.turning&&s.intersectionZ<12&&s.intersectionZ>3&&turn){s.turning=turn;s.turnProgress=.01;s.steer=turn;}
      if(s.turning){s.turnProgress+=dt*1.25;s.speed=Math.min(s.speed,55);if(s.turnProgress>=1){s.streetIndex=(s.streetIndex+s.turning+streets.length)%streets.length;s.turning=0;s.turnProgress=0;s.x=0;s.intersectionZ=68;s.objects=[];for(let z=18;z<120;z+=rand(9,14))spawn(z);}}
      else{s.steer+=(turn-s.steer)*8*dt;s.x+=s.steer*(.75+s.speed/55)*dt;s.x=clamp(s.x,-2.35,2.35);}
      if(Math.abs(s.x)>2.04)s.speed*=Math.pow(.62,dt);
      const travel=s.speed*dt*.14;s.roadOffset=(s.roadOffset+s.speed*dt)%12;s.intersectionZ-=travel;s.cash+=s.speed*dt*.19;
      if(s.intersectionZ<-7&&!s.turning)s.intersectionZ=rand(60,80);
      s.cameraX+=((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*1.8*dt;s.cameraY+=((keys.ArrowDown?1:0)-(keys.ArrowUp?1:0))*1.2*dt;
      s.cameraX=clamp(s.cameraX,-1.6,1.6);s.cameraY=clamp(s.cameraY,-.7,.85);
      for(const o of s.objects){o.z-=(s.speed-o.speed)*dt*.14;if(!o.hit&&s.invincible<=0&&o.z<4.7&&o.z>2.2&&Math.abs(o.x-s.x)<.55)crash(o);}
      s.objects=s.objects.filter(o=>o.z>-4&&!o.remove);
      s.spawnTimer-=dt;if(s.spawnTimer<=0){spawn(rand(105,135));s.spawnTimer=rand(.65,1.25);}
      if(s.cash>=GOAL&&!s.won){s.won=true;s.playing=false;showOverlay('Downtown payday!',`You banked $${Math.floor(s.cash).toLocaleString()} after ${s.crashes} crashes.`, 'Drive again');}
    }
    for(const p of s.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vy+=60*dt;}
    s.particles=s.particles.filter(p=>p.life>0);updateUI();
  }
  function crash(o){
    const s=state,impact=o.type==='crate'?11:18;s.damage=clamp(s.damage+impact,0,100);s.crashes++;s.speed*=o.type==='crate'?.62:.38;s.invincible=.7;s.shake=o.type==='crate'?10:19;s.flash=.65;o.hit=true;
    if(o.type==='crate')o.remove=true;else{o.damage=clamp(o.damage+rand(28,48),0,100);o.x+=Math.sign(o.x-s.x||1)*.7;o.speed*=.42;o.spin=Math.sign(o.x-s.x||1)*rand(.12,.3);setTimeout(()=>o.hit=false,900);}
    for(let i=0;i<22;i++)s.particles.push({x:canvas.clientWidth/2+rand(-45,45),y:canvas.clientHeight*.78+rand(-25,25),vx:rand(-170,170),vy:rand(-180,-30),life:rand(.25,.85),color:o.type==='crate'?'#d28b3e':'#ff7653'});
  }
  function updateUI(){ui.cash.textContent='$'+Math.floor(state.cash).toLocaleString();ui.speed.textContent=Math.round(state.speed*1.15);ui.wrecks.textContent=state.crashes;ui.damageBar.style.width=state.damage+'%';ui.damageBar.style.background=state.damage>65?'#ff4054':state.damage>30?'#ffb03f':'#b8f53f';ui.goal.textContent=streets[state.streetIndex];}

  function project(x,z){
    const w=canvas.clientWidth,h=canvas.clientHeight,horizon=h*(.31+state.cameraY*.08);const depth=Math.max(.1,z);const scale=310/depth;
    return{x:w/2+(x-state.cameraX)*scale,y:horizon+scale*2.45,scale};
  }
  function poly(points,fill,stroke){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function drawBackground(){
    const w=canvas.clientWidth,h=canvas.clientHeight,hy=h*(.31+state.cameraY*.08);let g=ctx.createLinearGradient(0,0,0,hy);g.addColorStop(0,'#78a6b1');g.addColorStop(1,'#d8c88f');ctx.fillStyle=g;ctx.fillRect(0,0,w,hy);
    ctx.fillStyle='#d7d29b';ctx.beginPath();ctx.arc(w*.77-state.cameraX*40,hy*.35,34,0,Math.PI*2);ctx.fill();
    // Downtown LA silhouette: US Bank Tower crown, Wilshire Grand spire and dense blocks.
    const shift=state.cameraX*45;ctx.fillStyle='#627176';ctx.fillRect(w*.18-shift,hy-105,54,105);ctx.beginPath();ctx.ellipse(w*.18+27-shift,hy-105,27,11,0,Math.PI,0);ctx.fill();
    ctx.fillStyle='#53676d';ctx.fillRect(w*.72-shift,hy-132,48,132);poly([[w*.72-shift,hy-132],[w*.72+48-shift,hy-132],[w*.72+38-shift,hy-160],[w*.72+30-shift,hy-132]],'#53676d');ctx.fillStyle='#2d4148';ctx.fillRect(w*.72+35-shift,hy-190,3,58);
    for(let i=0;i<13;i++){const bw=38+(i%3)*18,bh=45+(i*37)%92,bx=(i*w/12)-35-shift*.35;ctx.fillStyle=i%2?'#755f53':'#53605f';ctx.fillRect(bx,hy-bh,bw,bh);ctx.fillStyle='#e9c97655';for(let yy=hy-bh+10;yy<hy-8;yy+=13)for(let xx=bx+7;xx<bx+bw-5;xx+=13)ctx.fillRect(xx,yy,5,5);}
    ctx.fillStyle='#263a29';ctx.fillRect(0,hy,w,h-hy);
  }
  function drawRoad(){
    const h=canvas.clientHeight,far=project(0,125),near=project(0,2.25);poly([[far.x-12,far.y],[far.x+12,far.y],[near.x+610,near.y],[near.x-610,near.y]],'#3b3d3c');
    poly([[far.x-13,far.y],[far.x-11,far.y],[near.x-590,near.y],[near.x-620,near.y]],'#e7dfbd');poly([[far.x+11,far.y],[far.x+13,far.y],[near.x+620,near.y],[near.x+590,near.y]],'#e7dfbd');
    for(let lane=-1;lane<=1;lane++)for(let z=4-(state.roadOffset%8);z<125;z+=8){if(z<2.5)continue;const a=project(lane,z),b=project(lane,z+3.5),wa=Math.max(1,a.scale*.018),wb=Math.max(1,b.scale*.018);poly([[a.x-wa,a.y],[a.x+wa,a.y],[b.x+wb,b.y],[b.x-wb,b.y]],'#f0e9cd99');}
    // A real turnable cross street, with crosswalks and a street-name sign.
    if(state.intersectionZ>2.3&&state.intersectionZ<125){const a=project(0,state.intersectionZ-3.8),b=project(0,state.intersectionZ+3.8);poly([[-4000,b.y],[4000,b.y],[4000,a.y],[-4000,a.y]],'#353837');ctx.fillStyle='#ece8d0';for(let i=-5;i<=5;i++){const x=a.x+i*a.scale*.16;ctx.fillRect(x,a.y-(a.y-b.y)*.12,a.scale*.09,(a.y-b.y)*.12);}
      const sign=project(2.35,state.intersectionZ+2);ctx.fillStyle='#173d2c';ctx.fillRect(sign.x,sign.y-sign.scale*.7,sign.scale*.06,sign.scale*.7);ctx.fillRect(sign.x-sign.scale*.55,sign.y-sign.scale*.82,sign.scale*1.1,sign.scale*.24);ctx.fillStyle='#fff';ctx.font=`700 ${Math.max(8,sign.scale*.11)}px sans-serif`;ctx.textAlign='center';ctx.fillText(streets[(state.streetIndex+1)%streets.length],sign.x,sign.y-sign.scale*.66);}
    ctx.fillStyle='#789045';for(let z=8-(state.roadOffset%12);z<120;z+=12){for(const side of[-1,1]){const p=project(side*2.55,z);ctx.fillRect(p.x-p.scale*.025,p.y-p.scale*.65,p.scale*.05,p.scale*.65);ctx.beginPath();ctx.arc(p.x,p.y-p.scale*.72,p.scale*.19,0,Math.PI*2);ctx.fill();}}
  }
  function drawObject(o){const p=project(o.x,o.z);if(p.y<0||p.y>canvas.clientHeight+180)return;const s=p.scale*.95;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(o.spin||0);
    if(o.type==='crate'){poly([[-s*.62,0],[s*.62,0],[s*.54,-s],[0,-s*1.25],[-s*.54,-s]],'#b87538');poly([[-s*.54,-s],[0,-s*1.25],[s*.54,-s],[0,-s*.73]],'#d9944d');ctx.strokeStyle='#6c3f23';ctx.lineWidth=Math.max(1,s*.07);ctx.beginPath();ctx.moveTo(-s*.45,-s*.85);ctx.lineTo(s*.45,-s*.15);ctx.moveTo(s*.45,-s*.85);ctx.lineTo(-s*.45,-s*.15);ctx.stroke();}
    else{const d=o.damage/100;poly([[-s*.52,0],[s*.52,0],[s*(.45-d*.12),-s*1.25],[s*.25,-s*1.55],[-s*.25,-s*1.55],[-s*(.45+d*.08),-s*1.25]],o.color);poly([[-s*.31,-s*1.23],[s*.31,-s*1.23],[s*.19,-s*1.48],[-s*.19,-s*1.48]],d>.45?'#273135':'#173039');ctx.fillStyle=d>.28?'#47151b':'#ff3246';ctx.fillRect(-s*.39,-s*.21,s*.17,s*.1);ctx.fillStyle=d>.65?'#222':'#ff3246';ctx.fillRect(s*.22,-s*.21,s*.17,s*.1);ctx.fillStyle='#151515';ctx.fillRect(-s*.61,-s*.82,s*.12,s*.48);ctx.fillRect(s*.49,-s*.82,s*.12,s*.48);if(d>.15){ctx.strokeStyle='#eee';ctx.lineWidth=Math.max(1,s*.018);ctx.beginPath();ctx.moveTo(-s*.35,-s*.5);ctx.lineTo(s*.18,-s*.3);ctx.moveTo(s*.32,-s*.72);ctx.lineTo(-s*.1,-s*.62);ctx.stroke();}if(d>.55){ctx.fillStyle='#5559';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(s*.15+i*3,-s*1.5-i*s*.18,s*(.08+i*.02),0,Math.PI*2);ctx.fill();}}}
    ctx.restore();}
  function drawPlayer(){
    const w=canvas.clientWidth,h=canvas.clientHeight,damage=state.damage/100,x=w/2-state.cameraX*42+state.x*7,y=h*.89+state.cameraY*8,s=Math.min(w,h)*.19;
    ctx.save();ctx.translate(x+rand(-state.shake,state.shake),y+rand(-state.shake,state.shake));ctx.rotate(-state.steer*.045+damage*.025);
    ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(0,3,s*.68,s*.25,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111';ctx.fillRect(-s*.6,-s*.42,s*.17,s*.45);ctx.fillRect(s*.43,-s*.42,s*.17,s*.45);
    const body=damage>.65?'#849c32':'#b8f53f';poly([[-s*.57,0],[s*.57,0],[s*.51-damage*s*.12,-s*.67],[s*.28,-s*.93],[-s*.28,-s*.93],[-s*.51-damage*s*.05,-s*.67]],body,'#50681d');
    poly([[-s*.35,-s*.66],[s*.35,-s*.66],[s*.24,-s*.88],[-s*.24,-s*.88]],'#183038');
    // Cracks accumulate across the rear glass.
    if(damage>.18){ctx.strokeStyle='#dffaff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-s*.75);ctx.lineTo(s*.1,-s*.83);ctx.moveTo(0,-s*.75);ctx.lineTo(-s*.14,-s*.69);ctx.moveTo(0,-s*.75);ctx.lineTo(s*.18,-s*.71);ctx.stroke();}
    // Dented trunk and scraped paint grow with each hit.
    if(damage>.28){ctx.fillStyle='#526422';ctx.beginPath();ctx.ellipse(-s*.13,-s*.38,s*.2*damage,s*.11*damage,-.35,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#dceaa5';for(let i=0;i<damage*7;i++){ctx.beginPath();ctx.moveTo(rand(-s*.42,s*.4),rand(-s*.55,-s*.14));ctx.lineTo(rand(-s*.35,s*.45),rand(-s*.55,-s*.14));ctx.stroke();}}
    ctx.fillStyle=damage>.52?'#411':'#ff3348';ctx.fillRect(-s*.43,-s*.24,s*.18,s*.1);ctx.fillStyle=damage>.72?'#222':'#ff3348';ctx.fillRect(s*.25,-s*.24,s*.18,s*.1);
    // Hanging bumper at medium damage, missing section at severe damage.
    if(damage<.72){ctx.save();ctx.translate(0,damage>.45?s*.07:0);ctx.rotate(damage>.45?.08:0);ctx.fillStyle='#c5d1aa';ctx.fillRect(-s*.48,-s*.07,s*.96,s*.07);ctx.restore();}else{ctx.fillStyle='#c5d1aa';ctx.fillRect(-s*.48,-s*.02,s*.29,s*.06);}
    if(damage>.45){ctx.fillStyle='#222';ctx.fillRect(s*.32,-s*.6,s*.2*damage,s*.08);}
    if(damage>.62){for(let i=0;i<5;i++){const rise=((state.time*45+i*19)%70);ctx.fillStyle=`rgba(90,90,85,${.5-rise/150})`;ctx.beginPath();ctx.arc(s*.25+Math.sin(i)*10,-s*.92-rise,s*(.08+rise/400),0,Math.PI*2);ctx.fill();}}
    ctx.restore();
  }
  function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);drawBackground();ctx.save();if(state.turning){const a=state.turning*Math.sin(state.turnProgress*Math.PI/2)*Math.PI/2;ctx.translate(w/2,h*.55);ctx.rotate(-a);ctx.translate(-w/2,-h*.55);}drawRoad();[...state.objects].sort((a,b)=>b.z-a.z).forEach(drawObject);ctx.restore();drawPlayer();for(const p of state.particles){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,5,5);}ctx.globalAlpha=1;if(state.flash){ctx.fillStyle=`rgba(255,55,35,${state.flash*.2})`;ctx.fillRect(0,0,w,h);}let v=ctx.createRadialGradient(w/2,h*.55,h*.15,w/2,h*.55,h*.8);v.addColorStop(0,'transparent');v.addColorStop(1,'#0008');ctx.fillStyle=v;ctx.fillRect(0,0,w,h);}
  function frame(t){const dt=Math.min((t-last)/1000||0,.033);last=t;update(dt);draw();animationId=requestAnimationFrame(frame);}
  addEventListener('keydown',e=>{keys[e.code]=true;if(e.code.startsWith('Arrow'))e.preventDefault();if(e.code==='Enter'&&!state.playing)start();if(e.code==='KeyR')reset();});
  addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>Object.keys(keys).forEach(k=>keys[k]=false));ui.start.addEventListener('click',start);ui.restart.addEventListener('click',reset);addEventListener('resize',resize);
  reset();resize();cancelAnimationFrame(animationId);animationId=requestAnimationFrame(frame);
})();
