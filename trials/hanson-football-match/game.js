'use strict';
// All positions and physics use the canvas's 1000 × 540 logical coordinates.
const canvas = document.querySelector('#pitch');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const bounds = { left: 48, right: 952, top: 34, bottom: 506, goalTop: 197, goalBottom: 343 };
const levels = [
  { name: 'WARM UP', speed: 158, shot: 460, delay: .8 },
  { name: 'PICK UP THE PACE', speed: 193, shot: 550, delay: .55 },
  { name: 'CLUB MATCH', speed: 214, shot: 600, delay: .5 },
  { name: 'LOCAL DERBY', speed: 230, shot: 640, delay: .45 },
  { name: 'RISING STARS', speed: 245, shot: 680, delay: .4 },
  { name: 'CUP NIGHT', speed: 258, shot: 720, delay: .36 },
  { name: 'QUARTER FINAL', speed: 270, shot: 760, delay: .32 },
  { name: 'SEMI FINAL', speed: 282, shot: 800, delay: .29 },
  { name: 'TITLE CHALLENGE', speed: 294, shot: 840, delay: .26 },
  { name: 'THE GRAND FINAL', speed: 305, shot: 880, delay: .23 }
];
let level = 0, home = 0, away = 0, state = 'ready', cooldown = 0, freeze = 0, toastTime = 0;
let sDownAt = null, previous = 0, rivalClock = 0, nextAction = 'start';
const keys = new Set();
const player = { x: 300, y: 270, r: 19, vx: 0, vy: 0 };
const rival = { x: 700, y: 270, r: 19, vx: 0, vy: 0 };
const ball = { x: 500, y: 270, r: 9, vx: 0, vy: 0, lock: 0 };
const trail = [];
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

const SAVE_KEY='pocket-football-career-v1';
const upgradeCosts=[3,4,5,6,7];
let storageAvailable=true;
function loadCareer() {
  const fresh={points:0,speed:0,power:0,unlocked:0,champion:false};
  try {
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(!saved||typeof saved!=='object')return fresh;
    for(const key of ['points','speed','power','unlocked']) {
      const max=key==='points'?1000000:key==='unlocked'?levels.length-1:5;
      if(Number.isInteger(saved[key]))fresh[key]=clamp(saved[key],0,max);
    }
    fresh.champion=saved.champion===true;
  } catch { storageAvailable=false; }
  return fresh;
}
const career=loadCareer();
const playerSpeed=()=>255+career.speed*15;
const shotPower=()=>545+career.power*65;
function saveCareer() {
  try { localStorage.setItem(SAVE_KEY,JSON.stringify(career)); }
  catch { storageAvailable=false; }
}
function renderLobby() {
  $('points').textContent=career.points;
  $('careerStatus').textContent=career.champion?'Champion · All 10 levels conquered':`${career.unlocked+1} / ${levels.length} levels unlocked`;
  $('saveStatus').textContent=storageAvailable?'Progress saves in this browser.':'Browser storage unavailable — progress lasts for this visit only.';
  for(const kind of ['speed','power']) {
    const rank=career[kind],maxed=rank===5,cost=upgradeCosts[rank];
    $(kind+'Rank').textContent=`${rank} / 5`;
    $(kind+'Stat').textContent=kind==='speed'?`${playerSpeed()} → ${maxed?330:playerSpeed()+15} · max +29%`:`${shotPower()} → ${maxed?870:shotPower()+65} · max +60%`;
    $(kind+'Buy').textContent=maxed?'Fully upgraded':`Upgrade · ${cost} points`;
    $(kind+'Buy').disabled=maxed||career.points<cost;
  }
  $('levelSelect').innerHTML=levels.map((entry,i)=>`<option value="${i}" ${i>career.unlocked?'disabled':''}>${String(i+1).padStart(2,'0')} · ${entry.name}${i>career.unlocked?' · LOCKED':''}</option>`).join('');
  $('levelSelect').value=String(level);
}
function showLobby() {
  state='lobby';keys.clear();sDownAt=null;$('toast').textContent='';
  $('lobby').hidden=false;$('arena').hidden=true;$('touchControls').hidden=true;
  $('levelLabel').textContent='LOBBY · 10 LEVELS';
  renderLobby();$('playMatch').focus();
}
function buyUpgrade(kind) {
  if(state!=='lobby'||!['speed','power'].includes(kind))return;
  const rank=career[kind],cost=upgradeCosts[rank];
  if(rank>=5||career.points<cost)return;
  career.points-=cost;career[kind]++;saveCareer();renderLobby();
  $('lobbyNotice').textContent=`${kind==='speed'?'Speed':'Shot power'} upgraded to tier ${career[kind]}!`;
}
$('speedBuy').onclick=()=>buyUpgrade('speed');
$('powerBuy').onclick=()=>buyUpgrade('power');
$('playMatch').onclick=()=>{const selected=Number($('levelSelect').value);if(Number.isInteger(selected)&&selected>=0&&selected<=career.unlocked){level=selected;startMatch();}};
$('lobbyButton').onclick=()=>{$('lobbyNotice').textContent=state==='finished'?'Spend your points or choose your next match.':'Match abandoned. No points awarded.';showLobby();};

function resetPositions() {
  Object.assign(player,{x:300,y:270,vx:0,vy:0});
  Object.assign(rival,{x:700,y:270,vx:0,vy:0});
  Object.assign(ball,{x:500,y:270,vx:0,vy:0,lock:0});
  cooldown=0; rivalClock=.8; trail.length=0; keys.clear(); sDownAt=null;
}
function updateScore() { $('homeScore').textContent=home; $('awayScore').textContent=away; }
function message(text,seconds=1.6) { $('toast').textContent=text; toastTime=seconds; }
function showModal(tag,title,text,button,action) {
  $('modalTag').textContent=tag; $('modalTitle').textContent=title; $('modalText').textContent=text;
  $('action').textContent=button; nextAction=action; $('overlay').hidden=false;
}
function startMatch() {
  $('lobby').hidden=true;$('arena').hidden=false;$('touchControls').hidden=false;
  home=0; away=0; updateScore(); resetPositions(); freeze=.75; state='playing';
  $('levelLabel').textContent=`LEVEL ${String(level+1).padStart(2,'0')} · ${levels[level].name}`;
  $('overlay').hidden=true; $('pause').textContent='Pause'; $('pause').setAttribute('aria-label','Pause game'); $('status').textContent='MATCH IN PLAY';
  canvas.focus(); message('Kickoff! Attack the right goal →');
}
function goal(isHome) {
  if(state!=='playing')return;
  if (isHome) home++; else away++; updateScore();
  if(home===3 || away===3) {
    state='finished'; keys.clear(); $('status').textContent=home===3?'MATCH WON':'MATCH LOST';
    const won=home===3,reward=won?3:1;
    career.points+=reward;
    if(won){career.unlocked=Math.max(career.unlocked,Math.min(level+1,levels.length-1));if(level===levels.length-1)career.champion=true;}
    saveCareer();
    $('lobbyNotice').textContent=`${won?'Win':'Loss'}: +${reward} points. Choose an upgrade or your next match.`;
    showModal(won?'MATCH WON · +3 POINTS':'MATCH LOST · +1 POINT',won?(level===levels.length-1?'You own the pitch.':'Beautiful finish.'):'A rematch awaits.',`${home}–${away}. You earned ${reward} ${reward===1?'point':'points'}. Balance: ${career.points}. Visit the lobby to upgrade.`, 'Return to lobby →','lobby');
    if(won&&level<levels.length-1)level++;
  } else { resetPositions(); freeze=1.1; message(isHome?'GOAL! A great finish.':'Rival scores. Get the next one!',1.8); }
}
function shoot() {
  if(state!=='playing' || freeze>0 || cooldown>0) return;
  if(distance(player,ball)>65) { message('Get closer to the ball to shoot.',.9); return; }
  const aim=(keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
  const targetY=270+aim*56;
  const dx=985-ball.x, dy=targetY-ball.y, d=Math.hypot(dx,dy);
  ball.vx=dx/d*shotPower(); ball.vy=dy/d*shotPower();
  ball.lock=.14; cooldown=.32; message('Shot away!',.55);
}
function pause() {
  if(state==='playing') { state='paused'; keys.clear(); sDownAt=null; $('pause').textContent='Resume'; $('status').textContent='MATCH PAUSED'; showModal('TAKE A BREATHER','Half-time energy.','Ready when you are.','Resume match →','resume'); }
  else if(state==='paused') { state='playing'; $('overlay').hidden=true; $('pause').textContent='Pause'; $('status').textContent='MATCH IN PLAY'; canvas.focus(); }
  $('pause').setAttribute('aria-label',state==='paused'?'Resume game':'Pause game');
}
$('action').onclick=()=>{ if(nextAction==='resume') return pause(); if(nextAction==='lobby')return showLobby(); startMatch(); };
$('restart').onclick=startMatch;
$('pause').onclick=pause;
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  // Leave native controls (especially the lobby level selector) keyboard accessible.
  if(['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) {
    if(e.target.tagName==='BUTTON' && k===' ') return;
    if(state!=='playing') return; e.preventDefault();
    if(k==='s'&&!e.repeat) sDownAt=performance.now();
    keys.add(k); if(k===' '&&!e.repeat) shoot();
  }
  if((k==='escape'||k==='p')&&!e.repeat) pause();
});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase(); if(k==='s'&&sDownAt!==null){if(performance.now()-sDownAt<190) shoot(); sDownAt=null;} keys.delete(k);});
window.addEventListener('blur',()=>{if(state==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
document.querySelectorAll('[data-key]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);});
  const release=()=>keys.delete(button.dataset.key);
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
});
$('touchShoot').addEventListener('pointerdown',e=>{e.preventDefault();shoot();});
function move(body,dx,dy,speed,dt) {
  const length=Math.hypot(dx,dy);body.vx=length?dx/length*speed:0;body.vy=length?dy/length*speed:0;
  body.x=clamp(body.x+body.vx*dt,bounds.left+body.r,bounds.right-body.r);
  body.y=clamp(body.y+body.vy*dt,bounds.top+body.r,bounds.bottom-body.r);
}
function collide(body) {
  const dx=ball.x-body.x,dy=ball.y-body.y,d=Math.hypot(dx,dy),min=body.r+ball.r;
  if(d>=min||ball.lock>0)return;
  const nx=d?dx/d:1,ny=d?dy/d:0;
  ball.x=body.x+nx*(min+.5); ball.y=body.y+ny*(min+.5);
  const incoming=(ball.vx-body.vx)*nx+(ball.vy-body.vy)*ny;
  if(incoming<0){ball.vx-=1.45*incoming*nx;ball.vy-=1.45*incoming*ny;}
  if(Math.hypot(body.vx,body.vy)>0){ball.vx+=body.vx*.18;ball.vy+=body.vy*.18;}
}
function step(dt) {
  if(state!=='playing')return;
  if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').textContent='';}
  if(freeze>0){freeze-=dt;return;}
  cooldown=Math.max(0,cooldown-dt);ball.lock=Math.max(0,ball.lock-dt);rivalClock-=dt;
  const down=keys.has('arrowdown')||(keys.has('s')&&sDownAt!==null&&performance.now()-sDownAt>=190);
  move(player,Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),Number(down)-Number(keys.has('w')||keys.has('arrowup')),playerSpeed(),dt);
  // Approach from behind the ball so the rival attacks the left goal.
  let tx=ball.x+34,ty=ball.y;
  if(rival.x<ball.x+12){tx=ball.x+65;ty=ball.y+(rival.y<ball.y?-65:65);}
  const dx=tx-rival.x,dy=ty-rival.y;
  move(rival,Math.abs(dx)>3?dx:0,Math.abs(dy)>3?dy:0,levels[level].speed,dt);
  // Resolve player bodies before ball contact.
  const gap=distance(player,rival);
  if(gap<38){const nx=(player.x-rival.x)/(gap||1),ny=(player.y-rival.y)/(gap||1),push=(38-gap)/2;player.x=clamp(player.x+nx*push,67,933);player.y=clamp(player.y+ny*push,53,487);rival.x=clamp(rival.x-nx*push,67,933);rival.y=clamp(rival.y-ny*push,53,487);}
  if(distance(rival,ball)<49&&rival.x>ball.x+5&&rivalClock<=0&&ball.lock<=0){
    const targetY=270+Math.sin(performance.now()/1300)*48,dx=18-ball.x,dy=targetY-ball.y,d=Math.hypot(dx,dy);
    ball.vx=dx/d*levels[level].shot;ball.vy=dy/d*levels[level].shot;ball.lock=.12;rivalClock=levels[level].delay;
  }
  ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
  const friction=Math.exp(-.48*dt);ball.vx*=friction;ball.vy*=friction;
  collide(player);collide(rival);
  const speed=Math.hypot(ball.vx,ball.vy),maxSpeed=Math.max(levels[level].shot+150,shotPower());if(speed>maxSpeed){ball.vx*=maxSpeed/speed;ball.vy*=maxSpeed/speed;}
  if(ball.y<bounds.top+9){ball.y=bounds.top+9;ball.vy=Math.abs(ball.vy)*.8;}
  if(ball.y>bounds.bottom-9){ball.y=bounds.bottom-9;ball.vy=-Math.abs(ball.vy)*.8;}
  const inGoal=ball.y>bounds.goalTop+9&&ball.y<bounds.goalBottom-9;
  if(inGoal&&(ball.x<bounds.left-9||ball.x>bounds.right+9)){goal(ball.x>500);return;}
  if(!inGoal){if(ball.x<bounds.left+9){ball.x=bounds.left+9;ball.vx=Math.abs(ball.vx)*.8;}if(ball.x>bounds.right-9){ball.x=bounds.right-9;ball.vx=-Math.abs(ball.vx)*.8;}}
}
function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function draw() {
  ctx.clearRect(0,0,1000,540);ctx.fillStyle='#284c38';ctx.fillRect(0,0,1000,540);
  for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#31593e':'#2d533b';ctx.fillRect(48+i*90.4,34,90.4,472);}
  ctx.strokeStyle='#91b99165';ctx.lineWidth=2;ctx.strokeRect(48,34,904,472);
  ctx.beginPath();ctx.moveTo(500,34);ctx.lineTo(500,506);ctx.stroke();circle(500,270,72,null,'#91b99165');circle(500,270,3,'#abcda5');
  ctx.strokeRect(48,148,133,244);ctx.strokeRect(819,148,133,244);ctx.strokeRect(48,211,48,118);ctx.strokeRect(904,211,48,118);
  circle(145,270,3,'#8aa981');circle(855,270,3,'#8aa981');
  for(const x of [10,952]){ctx.fillStyle='#172e25';ctx.fillRect(x,197,38,146);ctx.strokeStyle='#acc5ac32';ctx.lineWidth=1;for(let y=197;y<=343;y+=12){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+38,y);ctx.stroke();}for(let n=0;n<4;n++){ctx.beginPath();ctx.moveTo(x+n*12,197);ctx.lineTo(x+n*12,343);ctx.stroke();}ctx.strokeStyle=x===10?'#c3f48b':'#ff9672';ctx.lineWidth=3;ctx.strokeRect(x,197,38,146);}
  ctx.fillStyle='#b1c5a880';ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText('DEFEND',95,526);ctx.fillText('ATTACK →',900,526);
  if(state==='playing'&&distance(player,ball)<65){circle(player.x,player.y,35,null,'#c3f48b50');}
  for(const [body,color,label] of [[player,'#c3f48b','YOU'],[rival,'#ff9672','RIVAL']]){
    circle(body.x+2,body.y+6,20,'#112d2460');circle(body.x,body.y,19,color);circle(body.x,body.y,13,null,'#18372830');
    ctx.fillStyle='#24352a';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText(body===player?'7':'9',body.x,body.y+5);
    ctx.fillStyle=body===player?'#dcffc3':'#ffd9cc';ctx.font='bold 9px system-ui';ctx.fillText(label,body.x,body.y-30);
  }
  if(state==='playing'&&freeze<=0){trail.push({x:ball.x,y:ball.y});if(trail.length>7)trail.shift();}
  trail.forEach((p,i)=>circle(p.x,p.y,3+i*.55,`rgba(238,243,222,${i*.024})`));
  circle(ball.x+1,ball.y+4,10,'#102f2270');circle(ball.x,ball.y,9,'#f7f5df','#253e30');circle(ball.x,ball.y,3,'#425343');
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;circle(ball.x+6*Math.cos(a),ball.y+6*Math.sin(a),1.6,'#58644b');}
}
function frame(now){const dt=Math.min((now-previous)/1000||0, .04);previous=now;const count=Math.max(1,Math.ceil(dt/.008));for(let i=0;i<count;i++)step(dt/count);draw();requestAnimationFrame(frame);}
level=career.unlocked;
showLobby();
requestAnimationFrame(frame);
