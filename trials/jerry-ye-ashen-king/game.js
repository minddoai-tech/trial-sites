const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id); let audioOn=true,running=false,last=0,shake=0,flash=0,announcementTimer;
const keys={}; let particles=[],waves=[],flames=[];
const arena={ground:590,left:70,right:1210};
const player={x:255,y:arena.ground,vx:0,vy:0,w:46,h:110,facing:1,hp:10,maxHp:10,attack:0,attackCd:0,dash:0,dashCd:0,block:false,inv:0};
const boss={x:940,y:arena.ground,vx:0,w:72,h:155,facing:-1,hp:100,maxHp:100,phase:1,state:'idle',timer:80,attack:0,blocking:false,inv:0};

function reset(){Object.assign(player,{x:255,y:arena.ground,vx:0,vy:0,hp:10,attack:0,attackCd:0,dash:0,dashCd:0,block:false,inv:0});Object.assign(boss,{x:940,vx:0,hp:100,phase:1,state:'idle',timer:90,attack:0,blocking:false,inv:0});particles=[];waves=[];flames=[];updateHud();}
function start(){reset();running=true;$('startScreen').classList.remove('visible');$('endScreen').classList.remove('visible');announce('PHASE I');}
function announce(t){const el=$('announcement');el.textContent=t;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function updateHud(){$('bossHealth').style.width=boss.hp+'%';$('phaseLabel').textContent='PHASE '+['I','II','III'][boss.phase-1];$('hitsLabel').textContent=player.hp+' / 10';$('playerHealth').innerHTML=Array.from({length:10},(_,i)=>`<i class="${i>=player.hp?'lost':''}"></i>`).join('');document.querySelectorAll('.phase-pips b').forEach((e,i)=>e.classList.toggle('active',i===boss.phase-1));}
function tone(freq,d=.08,type='sine',vol=.05){if(!audioOn)return;const ac=tone.ac||(tone.ac=new(window.AudioContext||window.webkitAudioContext)());const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(vol,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+d);}
function burst(x,y,color,n=12){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*10,vy:(Math.random()-.7)*9,life:30+Math.random()*20,color,s:2+Math.random()*4});}
function hitPlayer(kind){if(player.inv>0||!running)return;const blocked=player.block&&kind==='sword';if(blocked){player.vx=-player.facing*3;player.guardFlash=12;boss.vx=-boss.facing*5;shake=4;burst(player.x+player.facing*45,player.y-78,'#ffe2a0',14);tone(760,.1,'square',.035);return}player.hp--;player.inv=55;player.vx=boss.facing*9;player.vy=-5;shake=12;flash=8;burst(player.x,player.y-55,'#d95040',18);tone(95,.22,'sawtooth',.08);updateHud();if(player.hp<=0)end(false);}
function hitBoss(){if(boss.inv>0||boss.blocking)return false;boss.hp-=12;boss.inv=12;shake=5;burst(boss.x+boss.facing*25,boss.y-75,'#d8b16b',12);tone(170,.08,'square',.05);if(boss.hp<=0)nextPhase();updateHud();return true;}
function nextPhase(){if(boss.phase===3){end(true);return}boss.phase++;boss.hp=100;boss.state='idle';boss.timer=130;player.hp=Math.min(10,player.hp+4);player.x=240;boss.x=960;flames=[];waves=[];updateHud();announce('PHASE '+['I','II','III'][boss.phase-1]);}
function end(win){running=false;setTimeout(()=>{$('endEyebrow').textContent=win?'THE CROWN IS BROKEN':'THE ASH CLAIMS ANOTHER';$('endTitle').textContent=win?'VICTORY':'DEFEATED';$('endText').textContent=win?'The Ashen King has fallen. You survived all three phases.':'You endured '+(10-player.hp)+' hits and reached phase '+boss.phase+'. Rise and face him again.';$('endScreen').classList.add('visible')},500);}

function update(dt){if(!running)return; const s=dt/16.67;player.attackCd-=s;player.dashCd-=s;player.inv-=s;player.guardFlash=Math.max(0,(player.guardFlash||0)-s);boss.inv-=s;
  player.block=!!keys.f&&!player.attack&&player.y===arena.ground;
  let move=(keys.d?1:0)-(keys.a?1:0);if(player.block)move*=.25;if(player.attack)move*=.35;
  if(player.dash>0){player.dash-=s;player.vx=player.facing*19}else player.vx+=(move*7.25-player.vx)*.29;
  player.x+=player.vx*s;player.vy+=.72*s;player.y+=player.vy*s;if(player.y>=arena.ground){player.y=arena.ground;player.vy=0}player.x=Math.max(arena.left,Math.min(arena.right,player.x));if(move)player.facing=move>0?1:-1;
  if(player.attack>0){player.attack-=s;if(player.attack<12&&player.attack>8&&!player.attackHit){const tip=player.x+player.facing*92;if(Math.abs(tip-boss.x)<85&&Math.abs(player.y-boss.y)<120)hitBoss();player.attackHit=true}}
  bossAI(s); updateProjectiles(s); particles.forEach(p=>{p.x+=p.vx*s;p.y+=p.vy*s;p.vy+=.3*s;p.life-=s});particles=particles.filter(p=>p.life>0);shake*=.82;flash=Math.max(0,flash-s);
}
function chooseBossMove(dist){
  // Decisions depend on spacing and what the player is doing instead of a blind random roll.
  if(player.attack>8&&dist<175&&Math.random()<.62)return 'block';
  if(dist<105&&boss.phase>=3&&Math.random()<.52)return 'ripple';
  if(dist<185)return Math.random()<.78?'slash':'block';
  if(dist>330&&boss.phase>=2)return Math.random()<.72?'flame':'chase';
  if(boss.phase>=3&&dist<285&&Math.random()<.28)return 'ripple';
  return Math.random()<.66?'chase':(boss.phase>=2?'flame':'slash');
}
function beginBossMove(state){boss.state=state;boss.attack=0;boss.blocking=false;boss.timer=state==='block'?44:state==='ripple'?76:state==='flame'?66:state==='chase'?34:44}
function bossAI(s){boss.facing=player.x<boss.x?-1:1;boss.timer-=s;const dist=Math.abs(player.x-boss.x),speed=2.7+boss.phase*.75;boss.x+=boss.vx*s;boss.vx*=.84;boss.x=Math.max(arena.left+90,Math.min(arena.right-60,boss.x));
  if(boss.state==='idle'){
    boss.blocking=false;
    // Continually track the player, with a small retreat when they crowd the boss.
    if(dist>175)boss.vx=boss.facing*speed;else if(dist<78)boss.vx=-boss.facing*(2.2+boss.phase*.35);
    if(player.y<arena.ground-45&&dist<235)boss.vx=-boss.facing*1.8;
    if(boss.timer<=0){const move=chooseBossMove(dist);beginBossMove(move)}
  }
  else if(boss.state==='chase'){
    boss.vx=boss.facing*(speed+2.1);
    if(dist<155||boss.timer<=0)beginBossMove(dist<190?'slash':(boss.phase>=2?'flame':'slash'));
  }
  else if(boss.state==='block'){
    boss.blocking=true;boss.vx=-boss.facing*.55;
    if(boss.timer<=0){boss.state='idle';boss.timer=12}
  }
  else if(boss.state==='slash'){
    boss.attack++;if(boss.timer>23&&dist>80)boss.vx=boss.facing*(6.2+boss.phase*.45);
    if(boss.timer<22&&boss.timer>18&&dist<178)hitPlayer('sword');
    if(boss.timer<=0){boss.state='idle';boss.timer=Math.max(10,34-boss.phase*6)}
  }
  else if(boss.state==='flame'){
    boss.attack++;if(dist<125&&boss.timer>38)boss.vx=-boss.facing*3.8;
    if(boss.timer<36&&boss.timer>33){flames.push({x:boss.x+boss.facing*65,y:arena.ground-25,vx:boss.facing*(8+boss.phase),life:100,hit:false});tone(120,.25,'sawtooth',.04)}
    if(boss.timer<=0){boss.state='idle';boss.timer=18}
  }
  else if(boss.state==='ripple'){
    boss.attack++;if(boss.timer>42&&dist>190)boss.vx=boss.facing*2.2;
    if(boss.timer<40&&boss.timer>37){waves.push({x:boss.x,r:20,life:48,hit:false});shake=8;tone(60,.5,'sine',.1)}
    if(boss.timer<=0){boss.state='idle';boss.timer=16}
  }
}
function updateProjectiles(s){flames.forEach(f=>{f.x+=f.vx*s;f.life-=s;if(!f.hit&&Math.abs(f.x-player.x)<42&&player.y>arena.ground-80){f.hit=true;hitPlayer('flame')}});flames=flames.filter(f=>f.life>0&&f.x>0&&f.x<1280);waves.forEach(w=>{w.r+=13*s;w.life-=s;if(!w.hit&&Math.abs(player.x-w.x)<w.r+18&&Math.abs(player.x-w.x)>w.r-45&&player.y===arena.ground){w.hit=true;hitPlayer('ripple')}});waves=waves.filter(w=>w.life>0)}

function draw(){const ox=(Math.random()-.5)*shake,oy=(Math.random()-.5)*shake;ctx.save();ctx.translate(ox,oy);drawWorld();drawProjectiles();drawFighter(boss,true);drawFighter(player,false);drawParticles();ctx.restore();if(flash){ctx.fillStyle=`rgba(190,30,20,${flash/30})`;ctx.fillRect(0,0,1280,720)}requestAnimationFrame(loop)}
function drawWorld(){let g=ctx.createLinearGradient(0,0,0,720);g.addColorStop(0,'#16131b');g.addColorStop(.58,'#292126');g.addColorStop(1,'#100e10');ctx.fillStyle=g;ctx.fillRect(0,0,1280,720);ctx.fillStyle='#211b20';ctx.beginPath();ctx.moveTo(0,315);for(let x=0;x<=1280;x+=80)ctx.lineTo(x,280+Math.sin(x*.021)*70+Math.random()*6);ctx.lineTo(1280,590);ctx.lineTo(0,590);ctx.fill();ctx.globalAlpha=.25;for(let i=0;i<7;i++){ctx.fillStyle='#c65a38';ctx.beginPath();ctx.arc(90+i*190,455+(i%2)*40,3,0,7);ctx.fill()}ctx.globalAlpha=1;ctx.fillStyle='#171416';ctx.fillRect(0,590,1280,130);ctx.strokeStyle='#44383a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,590);ctx.lineTo(1280,590);ctx.stroke();for(let x=0;x<1280;x+=70){ctx.strokeStyle='#282326';ctx.beginPath();ctx.moveTo(x,590);ctx.lineTo(x-35,720);ctx.stroke()}let fog=ctx.createLinearGradient(0,390,0,600);fog.addColorStop(0,'transparent');fog.addColorStop(1,'#6f555522');ctx.fillStyle=fog;ctx.fillRect(0,390,1280,210)}
function drawFighter(o,isBoss){ctx.save();ctx.translate(o.x,o.y);ctx.scale(o.facing,1);if(o.inv>0&&Math.floor(o.inv/4)%2)ctx.globalAlpha=.4;const h=o.h,guard=!isBoss&&o.block,bossGuard=isBoss&&boss.blocking;
  ctx.fillStyle='rgba(0,0,0,.48)';ctx.beginPath();ctx.ellipse(0,4,isBoss?59:40,11,0,0,7);ctx.fill();
  // Cape, split legs and boots
  ctx.fillStyle=isBoss?'#301b20':'#18232b';ctx.beginPath();ctx.moveTo(-18,-h+34);ctx.lineTo(-35,-18);ctx.lineTo(-4,-31);ctx.lineTo(3,-h+40);ctx.fill();
  ctx.fillStyle=isBoss?'#171417':'#11171d';ctx.fillRect(-23,-45,17,43);ctx.fillRect(7,-45,17,43);ctx.fillStyle='#090b0e';ctx.fillRect(-29,-10,25,10);ctx.fillRect(5,-10,27,10);
  // Torso armor with layered plates
  ctx.fillStyle=isBoss?'#572e2d':'#293946';ctx.beginPath();ctx.moveTo(-28,-43);ctx.lineTo(-24,-h+25);ctx.lineTo(-15,-h);ctx.lineTo(17,-h);ctx.lineTo(29,-h+29);ctx.lineTo(26,-43);ctx.closePath();ctx.fill();
  ctx.strokeStyle=isBoss?'#956052':'#547083';ctx.lineWidth=3;for(let y=-h+31;y<-49;y+=17){ctx.beginPath();ctx.moveTo(-22,y);ctx.lineTo(23,y);ctx.stroke()}
  ctx.fillStyle=isBoss?'#8a4a3c':'#405968';ctx.beginPath();ctx.arc(-25,-h+30,15,0,7);ctx.arc(25,-h+30,15,0,7);ctx.fill();
  // Head, helmet, scarf and eye slit
  ctx.fillStyle=isBoss?'#171419':'#141b21';ctx.fillRect(-17,-h-25,34,30);ctx.fillStyle=isBoss?'#71382f':'#314854';ctx.beginPath();ctx.moveTo(-21,-h-15);ctx.lineTo(-13,-h-31);ctx.lineTo(16,-h-31);ctx.lineTo(22,-h-15);ctx.closePath();ctx.fill();ctx.fillStyle='#09090b';ctx.fillRect(-14,-h-17,29,8);ctx.fillStyle=isBoss?'#ff7650':'#9fe2f0';ctx.fillRect(7,-h-15,6,3);
  if(isBoss){ctx.fillStyle='#883f34';ctx.beginPath();ctx.moveTo(-18,-h-29);ctx.lineTo(-10,-h-51);ctx.lineTo(-2,-h-30);ctx.lineTo(9,-h-56);ctx.lineTo(17,-h-29);ctx.fill()}
  // Off-hand arm changes pose while guarding
  ctx.strokeStyle=isBoss?'#693a34':'#344957';ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-20,-h+35);ctx.lineTo(guard?-3:-30,guard?-h+61:-h+74);ctx.stroke();
  let ang=-1.08,handX=22,handY=-h+57; // lower ready guard, blade still angled upward
  if(!isBoss&&o.attack>0){const p=1-o.attack/18;ang=-1.22+p*2.18} // low wind-up into a downward forward cut
  if(isBoss&&boss.state==='slash'){const p=Math.max(0,Math.min(1,(44-boss.timer)/26));ang=-1.22+p*2.18}
  if(guard||bossGuard){ang=-.72;handX=12;handY=-h+48} // diagonal cross-body guard
  if(isBoss&&boss.state==='ripple')ang=boss.timer>40?-1.28:1.48;
  // Sword arm follows the hilt
  ctx.strokeStyle=isBoss?'#693a34':'#344957';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(20,-h+34);ctx.lineTo(handX,handY);ctx.stroke();
  ctx.save();ctx.translate(handX,handY);ctx.rotate(ang);ctx.fillStyle='#221d1d';ctx.fillRect(-6,-5,12,25);ctx.fillStyle='#8e765d';ctx.fillRect(-16,-9,32,7);let blade= isBoss?108:88;let steel=ctx.createLinearGradient(-5,-blade,7,0);steel.addColorStop(0,'#ffffff');steel.addColorStop(.45,isBoss?'#bba997':'#d7e4e7');steel.addColorStop(1,'#657078');ctx.fillStyle=steel;ctx.beginPath();ctx.moveTo(-5,-8);ctx.lineTo(-3,-blade);ctx.lineTo(1,-blade-12);ctx.lineTo(6,-8);ctx.closePath();ctx.fill();ctx.restore();
  if(guard){ctx.strokeStyle=player.guardFlash?'#fff0b0':'#8bb6c7';ctx.lineWidth=player.guardFlash?5:2;ctx.globalAlpha=.75;ctx.beginPath();ctx.arc(15,-82,58,-1.15,1.15);ctx.stroke();ctx.globalAlpha=1}
  if(bossGuard){ctx.strokeStyle='#e2b967aa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(12,-91,69,-1.15,1.15);ctx.stroke()}ctx.restore()}
function drawProjectiles(){flames.forEach(f=>{const grd=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,35);grd.addColorStop(0,'#fff0a1');grd.addColorStop(.35,'#ed6936');grd.addColorStop(1,'transparent');ctx.fillStyle=grd;ctx.beginPath();ctx.arc(f.x,f.y,38,0,7);ctx.fill()});waves.forEach(w=>{ctx.strokeStyle=`rgba(206,86,49,${w.life/48})`;ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(w.x,arena.ground,w.r,w.r*.18,0,0,7);ctx.stroke()})}
function drawParticles(){particles.forEach(p=>{ctx.globalAlpha=Math.min(1,p.life/12);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.s,p.s)});ctx.globalAlpha=1}
function loop(t){const dt=Math.min(32,t-last||16);last=t;update(dt);draw()}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;if(e.code==='KeyF')keys.f=true;if(['a','d','w','q','f',' '].includes(k))e.preventDefault();if(!running)return;if(k==='w'&&player.y===arena.ground&&!player.block)player.vy=-14;if(k==='q'&&player.dashCd<=0&&!player.block){player.dash=12;player.dashCd=70;player.inv=12;tone(260,.09,'sawtooth',.03)}});addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;if(e.code==='KeyF')keys.f=false});
canvas.addEventListener('mousedown',e=>{if(e.button===0&&running&&player.attackCd<=0&&!player.block){player.attack=18;player.attackCd=28;player.attackHit=false;tone(420,.07,'sawtooth',.025)}});canvas.addEventListener('contextmenu',e=>e.preventDefault());
$('startBtn').onclick=start;$('restartBtn').onclick=start;$('muteBtn').onclick=()=>{audioOn=!audioOn;$('muteBtn').textContent=audioOn?'SOUND ON':'SOUND OFF'};updateHud();requestAnimationFrame(loop);
