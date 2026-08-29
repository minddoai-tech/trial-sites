(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const canvas = $('#court'), ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, floorY = 515;
  const keys = new Set(), justPressed = new Set();
  let mode = 'ai', minutes = 2, running = false, paused = false, ended = false;
  let remaining = 120, lastTime = 0, announceTimer = 0, resetTimer = 0;
  let players, ball, scores;

  const controls = {
    blue:{left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',shoot:'KeyL',steal:'KeyX',special:'KeyZ'},
    red:{left:'KeyA',right:'KeyD',up:'KeyW',down:'KeyS',shoot:'KeyC',steal:'KeyM',special:'KeyN'}
  };
  const prevent = new Set(Object.values(controls.blue).concat(Object.values(controls.red)));

  function makePlayer(team, x) { return {team,x,y:floorY,vx:0,vy:0,dir:team==='blue'?1:-1,color:team==='blue'?'#1677e8':'#ff514c',hasBall:false,charge:0,charging:false,action:0,block:0,dash:0,dashCd:0,lastTap:{left:-9,right:-9},special:0,specialTime:0,aiThink:0}; }
  function setup() {
    players = [makePlayer('blue',360),makePlayer('red',920)];
    ball = {x:W/2,y:210,vx:0,vy:0,owner:null,shotBy:null,points:2,inAir:true,lastTouch:null,isDunk:false};
    scores = {blue:0,red:0}; remaining=minutes*60; resetTimer=0; announceTimer=0; ended=false;
    updateHUD();
  }
  function updateHUD(){ $('#scoreBlue').textContent=scores.blue; $('#scoreRed').textContent=scores.red; const t=Math.max(0,Math.ceil(remaining)); $('#clock').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`; }
  function announce(text){ const el=$('#announcement'); el.textContent=text; el.classList.remove('hidden'); el.style.animation='none'; void el.offsetWidth; el.style.animation='pop .9s both'; clearTimeout(announceTimer); announceTimer=setTimeout(()=>el.classList.add('hidden'),900); }
  function start(){ setup(); $('#menu').classList.add('hidden'); $('#game').classList.remove('hidden'); $('#modeLabel').textContent=mode==='ai'?'VS COMPUTER':'LOCAL VERSUS'; $('#redHint').innerHTML=`<i class="dot red-dot"></i> ${mode==='ai'?'RED: COMPUTER':'P2: WASD MOVE · C SHOOT / DUNK · M STEAL · N SPECIAL'}`; running=true;paused=false;lastTime=performance.now();requestAnimationFrame(loop);announce('TIP OFF!'); }

  function controlPlayer(p,c,dt,now){
    if (p.action>0 || resetTimer>0) return;
    let axis=(keys.has(c.right)?1:0)-(keys.has(c.left)?1:0);
    let vertical=(keys.has(c.down)?1:0)-(keys.has(c.up)?1:0);
    if(axis){p.dir=axis; p.vx += axis*(p.specialTime>0?1900:1350)*dt;}
    if(vertical)p.vy += vertical*(p.specialTime>0?1500:1050)*dt;
    for(const side of ['left','right']) if(justPressed.has(c[side])){ if(now-p.lastTap[side]<280 && p.dashCd<=0){p.dash=0.18;p.dashCd=1.35;p.vx=(side==='right'?1:-1)*760;} p.lastTap[side]=now; }
    if(justPressed.has(c.steal)) steal(p);
    if(justPressed.has(c.special) && p.special>=100){p.special=0;p.specialTime=5;announce(`${p.team.toUpperCase()} HEAT MODE!`);}
    if(justPressed.has(c.shoot) && p.hasBall){p.charging=true;p.charge=Math.max(.05,p.charge);}
    if(keys.has(c.shoot) && p.hasBall){p.charging=true;p.charge=Math.min(1,p.charge+dt*1.15);}
    if(!keys.has(c.shoot) && p.charging){shoot(p);p.charging=false;p.charge=0;}
  }
  function aiPlayer(p,dt){
    if(p.action>0||resetTimer>0)return; const blue=players[0];
    if(p.hasBall){
      const dist=Math.abs(p.x-105); if(dist<128){ if(!p.charging){p.charging=true;p.charge=0;} p.charge+=dt*1.4; if(p.charge>.38){shoot(p);p.charging=false;p.charge=0;} }
      else {p.dir=-1;p.vx-=1300*dt;p.vy+=Math.sign(470-p.y)*900*dt; if(Math.hypot(p.x-blue.x,p.y-blue.y)<80 && p.dashCd<=0){p.vx=-740;p.dash=.16;p.dashCd=1.4;} }
    } else if(ball.owner===blue){ const target=blue.x-35; p.dir=Math.sign(target-p.x)||-1;p.vx+=p.dir*1250*dt;p.vy+=Math.sign(blue.y-p.y)*950*dt;if(Math.hypot(p.x-blue.x,p.y-blue.y)<65&&p.action<=0){steal(p);p.aiThink=.65;} if(blue.charging&&Math.hypot(p.x-blue.x,p.y-blue.y)<105)p.block=.18; }
    else {p.dir=Math.sign(ball.x-p.x)||-1;p.vx+=p.dir*1300*dt;p.vy+=Math.sign(Math.min(floorY,ball.y+55)-p.y)*900*dt;}
    if(p.special>=100){p.special=0;p.specialTime=5;announce('RED HEAT MODE!');}
  }
  function steal(p){ p.action=.28; const other=players.find(q=>q!==p); if(other.hasBall&&Math.hypot(p.x-other.x,p.y-other.y)<72&&other.action<=0){ const chance=other.charging?.78:.48;if(Math.random()<chance){giveBall(p);other.action=.48;p.special=Math.min(100,p.special+18);announce(`${p.team.toUpperCase()} STEAL!`);} } }
  function giveBall(p){players.forEach(q=>q.hasBall=false);p.hasBall=true;ball.owner=p;ball.inAir=false;ball.shotBy=null;ball.lastTouch=p;ball.isDunk=false;}
  function shoot(p){
    if(!p.hasBall)return; const hoopX=p.team==='blue'?1170:110, dist=Math.abs(hoopX-p.x), dunk=dist<145&&p.charge>=.34;
    p.hasBall=false;ball.owner=null;ball.inAir=true;ball.shotBy=p;ball.lastTouch=p;ball.points=dist>385?3:2;
    ball.isDunk=dunk;ball.x=p.x+p.dir*25;ball.y=p.y-90;
    const flight=dunk ? .42 : Math.max(.58,Math.min(1.18,dist/680));
    ball.vx=(hoopX-ball.x)/flight;
    ball.vy=(205-ball.y-.5*780*flight*flight)/flight;
    if(dunk){ball.points=2;p.action=.48;announce('DUNK!');}
    else p.action=.32;
  }
  function physics(dt){
    for(const p of players){p.action=Math.max(0,p.action-dt);p.block=Math.max(0,p.block-dt);p.dash=Math.max(0,p.dash-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.specialTime=Math.max(0,p.specialTime-dt);p.vx*=Math.pow(.0015,dt);p.vy*=Math.pow(.0015,dt);p.x+=p.vx*dt;p.y+=p.vy*dt;p.x=Math.max(75,Math.min(W-75,p.x));p.y=Math.max(350,Math.min(floorY,p.y));}
    const [a,b]=players,dx=b.x-a.x,dy=b.y-a.y,gap=Math.hypot(dx,dy);if(gap<44){const push=(44-gap)/2,nx=dx/(gap||1),ny=dy/(gap||1);a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;}
    if(ball.owner){ball.x=ball.owner.x+ball.owner.dir*27;ball.y=ball.owner.y-53+Math.sin(performance.now()/65)*10;}
    else if(ball.inAir){
      const prevY=ball.y;ball.vy+=780*dt;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;if(!ball.shotBy)ball.vx*=Math.pow(.985,dt*60);
      for(const p of players) if(p.block>0&&ball.shotBy&&p!==ball.shotBy&&Math.abs(ball.x-p.x)<58&&ball.y>p.y-155&&ball.y<p.y-40){ball.vx=p.dir*280;ball.vy=-220;ball.shotBy=null;p.special=Math.min(100,p.special+15);announce(`${p.team.toUpperCase()} BLOCK!`);}
      checkHoop(110,'red',prevY);checkHoop(1170,'blue',prevY);
      if(ball.y>=floorY-12){ball.y=floorY-12;ball.vy*=-.52;ball.vx*=.72;if(Math.abs(ball.vy)<65){ball.vy=0;ball.inAir=false;}}
      if(ball.x<20||ball.x>W-20){ball.x=Math.max(25,Math.min(W-25,ball.x));ball.vx*=-.6;}
    }
    if(!ball.owner && resetTimer<=0) for(const p of players){if(Math.hypot(ball.x-p.x,ball.y-(p.y-45))<76){giveBall(p);announce(`${p.team.toUpperCase()} BALL`);break;}}
  }
  function checkHoop(x, attackingTeam, prevY){
    if(!ball.shotBy||ball.shotBy.team!==attackingTeam||ball.vy<=0)return;
    if(prevY<205&&ball.y>=205&&Math.abs(ball.x-x)<27){const shooter=ball.shotBy;const defender=players.find(p=>p!==shooter);const contested=defender.block>0&&Math.abs(defender.x-x)<100;let make=ball.isDunk||shooter.specialTime>0||Math.random()<(contested?.36:.78);if(!ball.isDunk&&Math.abs(ball.vx)>1900)make=false;if(make){scores[attackingTeam]+=ball.points;shooter.special=Math.min(100,shooter.special+(ball.points===3?36:25));updateHUD();announce(ball.isDunk?'SLAM DUNK!':`${ball.points} POINTS!`);ball.shotBy=null;ball.isDunk=false;resetTimer=1.25;}else{ball.shotBy=null;ball.isDunk=false;}}
  }
  function resetPossession(){ players.forEach(p=>{p.hasBall=false;p.action=0;p.x=p.team==='blue'?360:920;p.y=floorY;p.vx=0;p.vy=0;}); const receiver=ball.lastTouch?.team==='blue'?players[1]:players[0]; giveBall(receiver); announce(`${receiver.team.toUpperCase()} BALL`); }
  function endGame(){running=false;ended=true;paused=true;$('#resultEyebrow').textContent='FINAL SCORE';const tie=scores.blue===scores.red;$('#resultTitle').textContent=tie?'OVERTIME TIE!':`${scores.blue>scores.red?'BLUE':'RED'} WINS!`;$('#resultScore').textContent=`Blue ${scores.blue} — ${scores.red} Red`;$('#resumeButton').classList.add('hidden');$('#pauseModal').classList.remove('hidden');}

  function draw(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#dfa35e';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(94,54,27,.13)';ctx.lineWidth=2;for(let x=0;x<W;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.strokeStyle='#fff4df';ctx.lineWidth=6;ctx.strokeRect(26,26,W-52,H-52);ctx.beginPath();ctx.moveTo(W/2,26);ctx.lineTo(W/2,H-26);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,86,0,Math.PI*2);ctx.stroke();
    ctx.strokeRect(26,150,200,335);ctx.strokeRect(W-226,150,200,335);ctx.beginPath();ctx.arc(226,317,82,-Math.PI/2,Math.PI/2);ctx.stroke();ctx.beginPath();ctx.arc(W-226,317,82,Math.PI/2,Math.PI*1.5);ctx.stroke();
    ctx.beginPath();ctx.arc(110,317,350,-1.18,1.18);ctx.stroke();ctx.beginPath();ctx.arc(W-110,317,350,Math.PI-1.18,Math.PI+1.18);ctx.stroke();
    drawHoop(110);drawHoop(1170);players.forEach(drawPlayer);drawBall();drawMeters();
  }
  function drawHoop(x){const left=x<W/2;ctx.fillStyle='#cfd8df';ctx.fillRect(left?39:1233,105,8,290);ctx.fillStyle='#eef4f5';ctx.fillRect(left?42:1178,128,60,105);ctx.strokeStyle='#f4f7f8';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x-28,205);ctx.lineTo(x+28,205);ctx.stroke();ctx.strokeStyle='#e66d32';ctx.lineWidth=8;ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=2;for(let i=-22;i<=22;i+=11){ctx.beginPath();ctx.moveTo(x+i,209);ctx.lineTo(x+i*.55,254);ctx.stroke();}}
  function drawPlayer(p){
    const x=p.x,y=p.y, lean=Math.max(-.18,Math.min(.18,p.vx/1800));ctx.save();ctx.translate(x,y);ctx.rotate(lean);
    if(p.specialTime>0){ctx.fillStyle=p.color+'44';ctx.beginPath();ctx.arc(0,-58,70+Math.sin(performance.now()/80)*7,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='rgba(32,35,42,.18)';ctx.beginPath();ctx.ellipse(0,5,38,10,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#172234';ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-12,-42);ctx.lineTo(-18,0);ctx.moveTo(12,-42);ctx.lineTo(20,0);ctx.stroke();
    ctx.fillStyle=p.color;ctx.beginPath();ctx.roundRect(-30,-112,60,70,15);ctx.fill();ctx.fillStyle='white';ctx.font='900 23px sans-serif';ctx.textAlign='center';ctx.fillText(p.team==='blue'?'1':'2',0,-70);
    ctx.fillStyle='#c98255';ctx.beginPath();ctx.arc(0,-136,22,0,Math.PI*2);ctx.fill();ctx.fillStyle='#172234';ctx.beginPath();ctx.arc(-3,-145,22,Math.PI,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#c98255';ctx.lineWidth=11;ctx.beginPath();if(p.block>0){ctx.moveTo(-24,-100);ctx.lineTo(-42,-158);ctx.moveTo(24,-100);ctx.lineTo(42,-158);}else{ctx.moveTo(-24,-96);ctx.lineTo(-38,-60);ctx.moveTo(24,-96);ctx.lineTo(38,-60);}ctx.stroke();ctx.restore();
  }
  function drawBall(){ctx.fillStyle='#ef7f32';ctx.strokeStyle='#172234';ctx.lineWidth=3;ctx.beginPath();ctx.arc(ball.x,ball.y,14,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(ball.x,ball.y,7,Math.PI/2,Math.PI*1.5);ctx.moveTo(ball.x-14,ball.y);ctx.lineTo(ball.x+14,ball.y);ctx.stroke();}
  function drawMeters(){players.forEach((p,i)=>{const x=i===0?35:W-235;ctx.fillStyle='rgba(23,34,52,.8)';ctx.fillRect(x,35,200,21);ctx.fillStyle=p.color;ctx.fillRect(x+3,38,194*(p.special/100),15);ctx.fillStyle='white';ctx.font='800 10px sans-serif';ctx.textAlign='center';ctx.fillText(p.special>=100?'SPECIAL READY':'SPECIAL',x+100,50);if(p.charging){ctx.fillStyle='rgba(23,34,52,.75)';ctx.fillRect(p.x-40,p.y-190,80,9);ctx.fillStyle=p.charge>.42&&p.charge<.72?'#73e092':'#f1ce57';ctx.fillRect(p.x-38,p.y-188,76*p.charge,5);}});}

  function loop(now){if(!running)return;const dt=Math.min(.032,(now-lastTime)/1000);lastTime=now;if(!paused){remaining-=dt;if(remaining<=0){remaining=0;updateHUD();endGame();draw();return;}controlPlayer(players[0],controls.blue,dt,now);if(mode==='local')controlPlayer(players[1],controls.red,dt,now);else aiPlayer(players[1],dt);physics(dt);if(resetTimer>0){resetTimer-=dt;if(resetTimer<=0)resetPossession();}updateHUD();}draw();justPressed.clear();requestAnimationFrame(loop);}

  document.addEventListener('keydown',e=>{if(prevent.has(e.code))e.preventDefault();if(!keys.has(e.code))justPressed.add(e.code);keys.add(e.code);if(e.code==='Escape'&&running)togglePause();});
  document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(running&&!paused)togglePause();});
  $('#modeChoices').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b)return;mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));});
  $('#durationChoices').addEventListener('click',e=>{const b=e.target.closest('[data-minutes]');if(!b)return;minutes=+b.dataset.minutes;document.querySelectorAll('[data-minutes]').forEach(x=>x.classList.toggle('active',x===b));});
  $('#startButton').onclick=start;$('#helpButton').onclick=()=>$('#helpModal').classList.remove('hidden');document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>$('#helpModal').classList.add('hidden'));
  function togglePause(){if(ended)return;paused=!paused;$('#pauseModal').classList.toggle('hidden',!paused);$('#resultEyebrow').textContent='GAME PAUSED';$('#resultTitle').textContent='Take a breather.';$('#resultScore').textContent=`Blue ${scores.blue} — ${scores.red} Red`;$('#resumeButton').classList.remove('hidden');}
  $('#pauseButton').onclick=togglePause;$('#resumeButton').onclick=togglePause;$('#restartButton').onclick=()=>{setup();ended=false;paused=false;$('#pauseModal').classList.add('hidden');if(!running){running=true;lastTime=performance.now();requestAnimationFrame(loop);}};
  $('#menuButton').onclick=()=>{running=false;paused=false;ended=false;$('#pauseModal').classList.add('hidden');$('#game').classList.add('hidden');$('#menu').classList.remove('hidden');};
})();
