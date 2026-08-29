(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const screens = ['#startScreen','#countdownScreen','#roundScreen','#shopScreen','#endScreen'];
  const rounds = [10, 15, 20];
  const worldWidth = 4800;
  const weapons = [
    {name:'Sidearm', cost:0, rate:350, damage:1, spread:0, range:800, icon:'⌐━', owned:true},
    {name:'Repeater', cost:8, rate:190, damage:1, spread:8, range:930, icon:'╾━╤', owned:false},
    {name:'Long Rifle', cost:16, rate:520, damage:3, spread:2, range:1300, icon:'╾━━╤', owned:false}
  ];
  let state, lastTime = 0, raf = 0, audio;
  const keys = {}, mouse = {x:0,y:0,down:false};

  function resetState() {
    state = {mode:'menu', round:0, health:10, diamonds:0, earned:0, weapon:0, player:{x:240,y:0,vy:0,grounded:true}, camera:0, targets:[], shots:[], particles:[], lastShot:0, shake:0, paused:false};
    weapons.forEach((w,i) => w.owned = i === 0);
    updateHud(); renderShop();
  }
  function resize() { const r=canvas.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2); canvas.width=r.width*d; canvas.height=r.height*d; ctx.setTransform(d,0,0,d,0,0); }
  function size() { return {w:canvas.clientWidth,h:canvas.clientHeight}; }
  function groundY(){ return size().h - 76; }
  function hideScreens(){ screens.forEach(s => $(s).classList.add('hidden')); }
  function show(s){ hideScreens(); $(s).classList.remove('hidden'); }
  function startGame(){ initAudio(); $('#hud').classList.remove('hidden'); state.round=0; state.health=10; beginCountdown(); }
  function beginCountdown(){ state.mode='countdown'; show('#countdownScreen'); $('#countdownLabel').textContent=`ROUND ${state.round+1}`; let n=5; $('#countdownNumber').textContent=n; const timer=setInterval(()=>{ n--; if(n<=0){ clearInterval(timer); $('#countdownNumber').textContent='GO'; setTimeout(startRound,450); } else { $('#countdownNumber').textContent=n; beep(250+n*45,.05); } },1000); }
  function startRound(){ hideScreens(); state.mode='playing'; state.health=10; state.player.x=200; state.player.y=0; state.player.vy=0; state.player.grounded=true; state.camera=0; spawnTargets(rounds[state.round]); updateHud(); }
  function spawnTargets(count){
    state.targets=[];
    const spacing=(worldWidth-700)/count;
    for(let i=0;i<count;i++){
      const building=i%3, windowRow=i%2;
      const x=520+i*spacing+Math.random()*90;
      state.targets.push({x,homeX:x,patrol:45+Math.random()*65,direction:Math.random()<.5?-1:1,speed:38+Math.random()*35,yOffset: building===0 ? 150+windowRow*75 : (building===1?40:0), alive:true, hp:1, shooter:i%3===1 || (state.round>0&&i%4===0), cooldown:900+Math.random()*2200, flash:0, bob:Math.random()*6.28, hit:0});
    }
  }
  function update(dt, now){
    if(state.mode!=='playing'||state.paused) return;
    const p=state.player, speed=310;
    let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
    p.x=Math.max(60,Math.min(worldWidth-60,p.x+dx*speed*dt));
    p.vy+=900*dt;
    p.y+=p.vy*dt;
    if(p.y>=0){p.y=0;p.vy=0;p.grounded=true;}
    state.camera += ((p.x-size().w*.35)-state.camera)*Math.min(1,dt*5);
    state.camera=Math.max(0,Math.min(worldWidth-size().w,state.camera));
    if(mouse.down) shoot(now);
    for(const t of state.targets){
      if(!t.alive) continue; t.cooldown-=dt*1000; t.flash=Math.max(0,t.flash-dt); t.hit=Math.max(0,t.hit-dt);
      t.x+=t.direction*t.speed*dt;
      if(t.x>t.homeX+t.patrol){t.x=t.homeX+t.patrol;t.direction=-1;}
      if(t.x<t.homeX-t.patrol){t.x=t.homeX-t.patrol;t.direction=1;}
      const screenX=t.x-state.camera;
      if(t.shooter && screenX>-50 && screenX<size().w+50 && t.cooldown<=0){
        t.flash=.18; t.cooldown=Math.max(850,2300-state.round*300)+Math.random()*1600;
        const moving=dx!==0||!p.grounded, hitChance=moving?.23:.52;
        if(Math.random()<hitChance){ state.health--; state.shake=10; beep(90,.09); burst(size().w*.35,groundY()-52+p.y,'#ff6138',10); updateHud(); if(state.health<=0) lose(); }
      }
    }
    state.shots=state.shots.filter(s=>(s.life-=dt)>0); state.particles=state.particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;return p.life>0}); state.shake*=.82;
  }
  function shoot(now){
    const w=weapons[state.weapon]; if(now-state.lastShot<w.rate) return; state.lastShot=now; beep(150+state.weapon*70,.035);
    const {w:cw,h:ch}=size(), px=cw*.35, py=groundY()-55+state.player.y;
    const angle=Math.atan2(mouse.y-py,mouse.x-px)+(Math.random()-.5)*w.spread*Math.PI/180;
    const ex=px+Math.cos(angle)*w.range, ey=py+Math.sin(angle)*w.range;
    let best=null,bestDist=Infinity;
    for(const t of state.targets){ if(!t.alive) continue; const tx=t.x-state.camera, ty=targetY(t); const d=pointLineDistance(tx,ty,px,py,ex,ey); const along=(tx-px)*Math.cos(angle)+(ty-py)*Math.sin(angle); if(d<27&&along>0&&along<w.range&&along<bestDist){best=t;bestDist=along;} }
    let hitX=ex,hitY=ey;
    if(best){ hitX=best.x-state.camera;hitY=targetY(best); best.hp-=w.damage;best.hit=.12;burst(hitX,hitY,'#d6a769',8); if(best.hp<=0){best.alive=false;state.diamonds++;state.earned++;updateHud();beep(520,.07);setTimeout(checkRound,200);} }
    state.shots.push({x1:px,y1:py,x2:hitX,y2:hitY,life:.07}); state.shake=3;
  }
  function pointLineDistance(x,y,x1,y1,x2,y2){ const A=x-x1,B=y-y1,C=x2-x1,D=y2-y1,d=C*C+D*D; const t=Math.max(0,Math.min(1,(A*C+B*D)/d)); return Math.hypot(x-(x1+t*C),y-(y1+t*D)); }
  function checkRound(){ if(state.mode==='playing'&&state.targets.every(t=>!t.alive)){state.mode='between';$('#roundResultTitle').textContent=`ROUND ${state.round+1} CLEAR`;$('#resultDiamonds').textContent=`${state.diamonds} ◆`;show('#roundScreen');} }
  function nextRound(){ if(state.round>=rounds.length-1){win();return;} state.round++;beginCountdown(); }
  function lose(){state.mode='end';$('#endIcon').textContent='×';$('#endIcon').style.color='#ff6138';$('#endEyebrow').textContent='COURSE FAILED';$('#endTitle').textContent='TARGETS GOT YOU';$('#endText').textContent='Your health hit zero. Reset the course and try moving while enemies aim.';$('#finalScore').textContent=`${state.earned} ◆`;show('#endScreen');}
  function win(){state.mode='end';$('#endIcon').textContent='◆';$('#endIcon').style.color='#ffc857';$('#endEyebrow').textContent='COURSE COMPLETE';$('#endTitle').textContent='RANGE MASTERED';$('#endText').textContent='All 45 cardboard targets are down. Clean shooting.';$('#finalScore').textContent=`${state.earned} ◆`;show('#endScreen');}
  function restart(){resetState();$('#hud').classList.add('hidden');show('#startScreen');}
  function updateHud(){ if(!state)return; $('#healthText').textContent=`${state.health} / 10`;$('#healthFill').style.width=`${state.health*10}%`;$('#roundText').textContent=`${state.round+1} / 3`;const down=state.targets.filter(t=>!t.alive).length;$('#targetText').textContent=`${down} / ${rounds[state.round]||10}`;$('#diamondText').textContent=state.diamonds;$('#gunText').textContent=weapons[state.weapon].name.toUpperCase(); }
  function renderShop(){ if(!state)return;$('#shopDiamonds').textContent=state.diamonds;$('#weaponCards').innerHTML=weapons.map((w,i)=>`<article class="weapon-card ${state.weapon===i?'equipped':''}"><div class="weapon-art">${w.icon}</div><h3>${w.name.toUpperCase()}</h3><div class="weapon-stat"><span>FIRE RATE</span><div class="stat-bar"><i style="width:${Math.min(100,40000/w.rate)}%"></i></div></div><div class="weapon-stat"><span>POWER</span><div class="stat-bar"><i style="width:${w.damage*30}%"></i></div></div><div class="weapon-stat"><span>RANGE</span><div class="stat-bar"><i style="width:${w.range/13}%"></i></div></div><button data-buy="${i}" ${state.weapon===i||(!w.owned&&state.diamonds<w.cost)?'disabled':''}>${state.weapon===i?'EQUIPPED':w.owned?'EQUIP':`${w.cost} ◆ — BUY`}</button></article>`).join(''); }
  function buy(i){const w=weapons[i];if(!w.owned){if(state.diamonds<w.cost)return;state.diamonds-=w.cost;w.owned=true;}state.weapon=i;updateHud();renderShop();beep(620,.08);}
  function targetY(t){return groundY()-48-t.yOffset+Math.sin(t.bob+performance.now()/450)*3;}
  function burst(x,y,color,n){for(let i=0;i<n;i++)state.particles.push({x,y,vx:(Math.random()-.5)*160,vy:(Math.random()-.7)*170,life:.3+Math.random()*.35,color});}
  function draw(){
    const {w,h}=size();ctx.save();ctx.clearRect(0,0,w,h);const sx=(Math.random()-.5)*state.shake,sy=(Math.random()-.5)*state.shake;ctx.translate(sx,sy);
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#8dcacc');sky.addColorStop(1,'#d6d7bf');ctx.fillStyle=sky;ctx.fillRect(-10,-10,w+20,h+20);
    ctx.fillStyle='#fff3';ctx.beginPath();ctx.arc(w*.78,90,42,0,7);ctx.fill();
    for(let layer=0;layer<2;layer++) drawBuildings(layer,w,h);
    ctx.fillStyle='#707d78';ctx.fillRect(0,groundY(),w,h-groundY());ctx.fillStyle='#c9b570';ctx.fillRect(0,groundY()+46,w,5);
    for(const t of state.targets)if(t.alive)drawTarget(t);
    drawPlayer();
    for(const s of state.shots){ctx.strokeStyle=`rgba(255,232,154,${s.life*12})`;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();}
    for(const p of state.particles){ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
    ctx.restore();
    if(state.paused&&state.mode==='playing'){ctx.fillStyle='#07151ccc';ctx.fillRect(0,0,w,h);ctx.fillStyle='white';ctx.textAlign='center';ctx.font="800 64px 'Arial Narrow', Arial, sans-serif";ctx.fillText('PAUSED',w/2,h/2);ctx.font="600 16px Arial, sans-serif";ctx.fillText('Press ESC to resume',w/2,h/2+38);}
  }
  function drawBuildings(layer,w,h){ const par=layer?.38:.68, base=groundY(), bw=layer?170:240; ctx.save();ctx.translate(-(state.camera*par)%bw,0);for(let i=-1;i<w/bw+2;i++){const x=i*bw,y=layer?115+(i%3)*35:210+(i%2)*55;ctx.fillStyle=layer?'#54777a':'#334f55';ctx.fillRect(x,y,bw-12,base-y);ctx.fillStyle=layer?'#294b51':'#182f37';for(let wy=y+30;wy<base-25;wy+=58)for(let wx=x+22;wx<x+bw-30;wx+=48){ctx.fillRect(wx,wy,25,30);if((i+wy+wx)%4===0){ctx.fillStyle='#e8c86a';ctx.fillRect(wx+3,wy+3,19,24);ctx.fillStyle=layer?'#294b51':'#182f37';}}}ctx.restore();}
  function drawTarget(t){const x=t.x-state.camera,y=targetY(t);ctx.save();ctx.translate(x,y);if(t.hit)ctx.translate((Math.random()-.5)*8,0);ctx.fillStyle='#654b31';ctx.fillRect(-4,28,8,60);ctx.fillRect(-26,82,52,7);ctx.fillStyle=t.hit?'#ffdf87':'#c89b61';ctx.strokeStyle='#71502d';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,-28,20,0,7);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-28,29);ctx.lineTo(-22,-8);ctx.quadraticCurveTo(0,-22,22,-8);ctx.lineTo(29,29);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#26343a';ctx.fillRect(-13,-34,7,5);ctx.fillRect(7,-34,7,5);ctx.fillRect(-8,-19,16,4);if(t.shooter){ctx.fillStyle='#a42f25';ctx.fillRect(-28,3,56,9);ctx.fillStyle='#18252b';ctx.fillRect(20,2,25,7);}if(t.flash){ctx.fillStyle='#fff0a3';ctx.beginPath();ctx.moveTo(47,5);ctx.lineTo(64,-5);ctx.lineTo(57,8);ctx.lineTo(68,18);ctx.lineTo(46,12);ctx.fill();}ctx.restore();}
  function drawPlayer(){
    const {w}=size(),x=w*.35,y=groundY()+state.player.y;
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle='#172c35';ctx.fillRect(-15,-58,30,52);
    ctx.fillStyle='#e7b579';ctx.beginPath();ctx.arc(0,-70,15,0,7);ctx.fill();
    ctx.restore();

    const shoulderY=y-55;
    const a=Math.atan2(mouse.y-shoulderY,mouse.x-x);
    ctx.save();
    ctx.translate(x,shoulderY);
    ctx.rotate(a);
    ctx.strokeStyle='#e7b579';ctx.lineWidth=9;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(18,5);ctx.stroke();
    ctx.fillStyle='#263b43';ctx.fillRect(8,-5,43,10);
    ctx.fillStyle='#e7b579';ctx.beginPath();ctx.arc(17,7,6,0,7);ctx.fill();
    ctx.restore();
  }
  function loop(now){const dt=Math.min(.033,(now-lastTime)/1000||0);lastTime=now;update(dt,now);draw();raf=requestAnimationFrame(loop);}
  function initAudio(){audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();}
  function beep(freq,dur){if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='square';o.frequency.value=freq;g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur);}

  addEventListener('resize',resize);addEventListener('keydown',e=>{const key=e.key.toLowerCase();keys[key]=true;if((key==='w'||key==='arrowup')&&state.mode==='playing'&&!state.paused&&state.player.grounded){state.player.vy=-455;state.player.grounded=false;beep(180,.04);}if(e.key==='Escape'&&state.mode==='playing')state.paused=!state.paused;if(key==='r'&&state.mode==='end')restart();});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;});canvas.addEventListener('mousedown',e=>{if(e.button===0){mouse.down=true;initAudio();}});addEventListener('mouseup',()=>mouse.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  $('#startBtn').onclick=startGame;$('#shopBtn').onclick=()=>{show('#shopScreen');renderShop();};$('#closeShopBtn').onclick=()=>show('#roundScreen');$('#nextBtn').onclick=nextRound;$('#rangeBtn').onclick=nextRound;$('#restartBtn').onclick=restart;$('#weaponCards').onclick=e=>{const b=e.target.closest('[data-buy]');if(b)buy(+b.dataset.buy);};
  resize();resetState();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
})();
