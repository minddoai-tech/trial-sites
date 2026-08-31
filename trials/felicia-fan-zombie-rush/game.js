(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const W = canvas.width, H = canvas.height;
  const keys = Object.create(null);
  const WEAPONS = {
    pistol:  { name:'SIDEARM', rate:330, damage:1, speed:780, color:'#d8ff3e' },
    shotgun: { name:'SHOTGUN', rate:650, damage:1, speed:720, color:'#ffb84a', pellets:5 },
    machine: { name:'MACHINE GUN', rate:95, damage:1, speed:900, color:'#57d9ff' },
    rocket:  { name:'ROCKET LAUNCHER', rate:850, damage:4, speed:500, color:'#ff5c50', explosive:true }
  };
  const platforms = [
    {x:0,y:604,w:1200,h:71}, {x:95,y:488,w:235,h:24}, {x:430,y:530,w:210,h:24},
    {x:760,y:454,w:260,h:24}, {x:1020,y:560,w:180,h:20}, {x:360,y:375,w:190,h:22},
    {x:670,y:300,w:220,h:22}, {x:30,y:260,w:205,h:22}, {x:955,y:220,w:245,h:22}
  ];
  let state, player, zombies, bullets, particles, pickups, lastTime, raf;

  function reset() {
    state = { running:true, kills:0, hits:0, time:0, nextDrop:10, spawnClock:0, shake:0, banner:'', bannerTime:0 };
    player = { x:570,y:520,w:32,h:52,vx:0,vy:0,grounded:false,facing:1,weapon:'pistol',weaponTime:0,lastShot:-999,flash:0,invuln:0 };
    zombies=[]; bullets=[]; particles=[]; pickups=[]; lastTime=performance.now();
    startScreen.classList.remove('visible'); gameOverScreen.classList.remove('visible');
    canvas.focus(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
  }

  function spawnZombie() {
    const x=35+Math.random()*(W-105);
    const drift=(Math.random()-.5)*55;
    zombies.push({x,y:-70-Math.random()*100,w:34,h:58,vx:drift,vy:25+Math.random()*45,grounded:false,falling:true,hp:Math.random()<Math.min(.35,state.time/180)?3:2,hit:0,attack:0});
  }
  function dropWeapon() {
    const types=['shotgun','machine','rocket'], type=types[Math.floor(Math.random()*types.length)];
    const p=platforms[1+Math.floor(Math.random()*(platforms.length-1))];
    pickups.push({x:p.x+30+Math.random()*Math.max(10,p.w-80),y:p.y-34,w:38,h:28,type,t:0});
    state.banner='WEAPON CACHE INBOUND'; state.bannerTime=2.5;
  }
  function shoot(now) {
    const gun=WEAPONS[player.weapon];
    if(now-player.lastShot<gun.rate) return;
    player.lastShot=now; player.flash=.08;
    const count=gun.pellets||1;
    for(let i=0;i<count;i++) {
      const spread=count>1?(i-(count-1)/2)*.075:0;
      bullets.push({x:player.x+player.w/2+player.facing*22,y:player.y+20,vx:player.facing*gun.speed,vy:spread*gun.speed,life:1.7,damage:gun.damage,color:gun.color,explosive:gun.explosive,r:gun.explosive?6:3});
    }
  }
  function rectHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function platformPhysics(o,dt) {
    const oldBottom=o.y+o.h; o.vy+=1500*dt; o.x+=o.vx*dt; o.y+=o.vy*dt; o.grounded=false;
    for(const p of platforms) if(o.x+o.w>p.x&&o.x<p.x+p.w&&oldBottom<=p.y+4&&o.y+o.h>=p.y&&o.vy>=0){o.y=p.y-o.h;o.vy=0;o.grounded=true;}
  }
  function burst(x,y,color,n=8){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*260,vy:(Math.random()-.7)*240,life:.35+Math.random()*.35,color,r:2+Math.random()*3});}
  function explode(b) {
    state.shake=10; burst(b.x,b.y,'#ff673d',25);
    for(const z of zombies){const dx=z.x+z.w/2-b.x,dy=z.y+z.h/2-b.y;if(Math.hypot(dx,dy)<115){z.hp-=b.damage;z.hit=.15;}}
  }
  function killZombie(z) {
    state.kills++; burst(z.x+17,z.y+25,'#b7dc45',14);
    if(state.kills>=state.nextDrop){dropWeapon();state.nextDrop+=10;}
  }
  function endGame(){state.running=false;document.getElementById('finalKills').textContent=state.kills;document.getElementById('finalTime').textContent=formatTime(state.time);gameOverScreen.classList.add('visible');}
  function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;}

  function update(dt,now) {
    state.time+=dt; state.spawnClock-=dt; state.bannerTime-=dt; state.shake=Math.max(0,state.shake-35*dt);
    player.invuln=Math.max(0,player.invuln-dt); player.flash=Math.max(0,player.flash-dt);
    if(player.weapon!=='pistol'){player.weaponTime-=dt;if(player.weaponTime<=0){player.weapon='pistol';state.banner='POWER WEAPON EXPIRED';state.bannerTime=1.7;}}
    const move=(keys.KeyD?1:0)-(keys.KeyA?1:0); player.vx=move*245;if(move)player.facing=move;
    platformPhysics(player,dt); player.x=Math.max(0,Math.min(W-player.w,player.x));
    if(keys.KeyE)shoot(now);
    if(state.spawnClock<=0){spawnZombie();state.spawnClock=Math.max(.55,1.85-state.time*.012)*(.75+Math.random()*.55);}
    for(let i=zombies.length-1;i>=0;i--){const z=zombies[i];z.hit=Math.max(0,z.hit-dt);z.attack-=dt;if(!z.falling){z.vx=Math.sign(player.x-z.x)*(55+Math.min(75,state.time*1.2));if(Math.abs(player.x-z.x)<18)z.vx=0;}platformPhysics(z,dt);if(z.falling&&z.grounded){z.falling=false;burst(z.x+17,z.y+z.h,'#718268',7);}z.x=Math.max(0,Math.min(W-z.w,z.x));if(rectHit(player,z)&&z.attack<=0&&player.invuln<=0){state.hits++;z.attack=1.15;player.invuln=.8;player.vx=(player.x<z.x?-1:1)*370;player.vy=-360;state.shake=9;burst(player.x+16,player.y+25,'#ff5148',12);if(state.hits>=10){endGame();return;}}if(z.hp<=0){killZombie(z);zombies.splice(i,1);}}
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let gone=b.life<=0||b.x<0||b.x>W||b.y<0||b.y>H;for(const z of zombies){if(!gone&&b.x>z.x&&b.x<z.x+z.w&&b.y>z.y&&b.y<z.y+z.h){if(b.explosive)explode(b);else{z.hp-=b.damage;z.hit=.12;burst(b.x,b.y,b.color,4);}gone=true;}}if(gone)bullets.splice(i,1);}
    for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.t+=dt;if(rectHit(player,p)){player.weapon=p.type;player.weaponTime=60;state.banner=`${WEAPONS[p.type].name} EQUIPPED // 60 SEC`;state.bannerTime=2.3;pickups.splice(i,1);}}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=700*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
  }

  function drawBackground() {
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#a9d5d2');g.addColorStop(.55,'#779f91');g.addColorStop(1,'#31453a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#e8f29b';ctx.globalAlpha=.72;ctx.beginPath();ctx.arc(1015,105,52,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle='#759889';ctx.beginPath();ctx.moveTo(0,210);for(let x=0;x<=W;x+=70)ctx.lineTo(x,160+Math.sin(x*.018)*32+Math.sin(x*.047)*8);ctx.lineTo(W,440);ctx.lineTo(0,440);ctx.fill();
    ctx.fillStyle='#3b594c';for(let x=0;x<W;x+=80){const h=90+(x*17%140);ctx.fillRect(x,440-h,62,h);ctx.fillRect(x+11,420-h,5,20);}
    ctx.strokeStyle='#8db6a4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,350);ctx.lineTo(W,350);ctx.stroke();
    ctx.fillStyle='#101713';for(const p of platforms){ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#53624f';ctx.fillRect(p.x,p.y,p.w,4);ctx.fillStyle='#101713';}
  }
  function drawPlayer(){ctx.save();if(player.invuln>0&&Math.floor(player.invuln*12)%2)ctx.globalAlpha=.35;ctx.translate(player.x+16,player.y);ctx.scale(player.facing,1);ctx.fillStyle='#c5d0c6';ctx.fillRect(-11,7,22,28);ctx.fillStyle='#d8ff3e';ctx.fillRect(-12,5,24,5);ctx.fillStyle='#202722';ctx.fillRect(-10,35,8,17);ctx.fillRect(3,35,8,17);ctx.fillStyle='#bac6bc';ctx.fillRect(-8,-5,16,14);ctx.fillStyle='#0c100d';ctx.fillRect(2,-1,7,3);ctx.fillStyle=WEAPONS[player.weapon].color;ctx.fillRect(7,15,30,6);if(player.flash){ctx.beginPath();ctx.moveTo(37,12);ctx.lineTo(52,18);ctx.lineTo(37,23);ctx.fill();}ctx.restore();}
  function drawZombie(z){ctx.save();ctx.translate(z.x+17,z.y);ctx.scale(Math.sign(z.vx)||1,1);ctx.fillStyle=z.hit?'#e7ff88':'#6f8b56';ctx.fillRect(-12,4,24,25);ctx.fillStyle='#384734';ctx.fillRect(-14,28,28,17);ctx.fillStyle='#242c27';ctx.fillRect(-13,45,10,13);ctx.fillRect(4,45,10,13);ctx.fillStyle='#ff5148';ctx.fillRect(5,11,4,3);ctx.fillStyle='#6f8b56';ctx.fillRect(10,29,20,7);ctx.restore();}
  function drawPickup(p){const bob=Math.sin(p.t*4)*5;ctx.save();ctx.translate(p.x,p.y+bob);ctx.shadowColor=WEAPONS[p.type].color;ctx.shadowBlur=18;ctx.fillStyle='#111713';ctx.fillRect(0,0,p.w,p.h);ctx.strokeStyle=WEAPONS[p.type].color;ctx.lineWidth=2;ctx.strokeRect(0,0,p.w,p.h);ctx.fillStyle=WEAPONS[p.type].color;ctx.fillRect(8,11,22,6);ctx.shadowBlur=0;ctx.font='700 8px Arial';ctx.textAlign='center';ctx.fillText('CACHE',19,-7);ctx.restore();}
  function drawHUD(){ctx.fillStyle='rgba(7,11,8,.72)';ctx.fillRect(24,22,205,72);ctx.fillStyle='#7d8980';ctx.font='600 10px Arial';ctx.fillText('ZOMBIES ELIMINATED',42,46);ctx.fillStyle='#e9efe9';ctx.font='800 34px Arial Narrow';ctx.fillText(String(state.kills).padStart(3,'0'),42,80);ctx.fillStyle='#7d8980';ctx.font='600 10px Arial';ctx.fillText('NEXT CACHE',135,65);ctx.fillStyle='#d8ff3e';ctx.fillText(`${Math.max(0,state.nextDrop-state.kills)} KILLS`,135,81);
    ctx.textAlign='center';ctx.fillStyle='#d9e0da';ctx.font='700 18px Arial Narrow';ctx.fillText(formatTime(state.time),W/2,45);ctx.fillStyle='#768078';ctx.font='600 8px Arial';ctx.fillText('TIME SURVIVED',W/2,59);ctx.textAlign='left';
    ctx.fillStyle='rgba(7,11,8,.72)';ctx.fillRect(W-277,22,253,72);ctx.fillStyle='#7d8980';ctx.font='600 10px Arial';ctx.fillText('INFECTION / ATTACKS',W-258,45);for(let i=0;i<10;i++){ctx.fillStyle=i<state.hits?'#ff5148':'#29322c';ctx.fillRect(W-258+i*21,57,15,13);}ctx.fillStyle=WEAPONS[player.weapon].color;ctx.fillText(WEAPONS[player.weapon].name,W-258,87);if(player.weapon!=='pistol'){ctx.textAlign='right';ctx.fillText(`${Math.ceil(player.weaponTime)}s`,W-43,87);ctx.textAlign='left';}
    if(state.bannerTime>0){ctx.textAlign='center';ctx.fillStyle='rgba(7,10,8,.86)';ctx.fillRect(W/2-210,108,420,42);ctx.fillStyle='#d8ff3e';ctx.font='700 13px Arial';ctx.fillText(state.banner,W/2,134);ctx.textAlign='left';}
  }
  function render(){ctx.save();if(state.shake)ctx.translate((Math.random()-.5)*state.shake,(Math.random()-.5)*state.shake);drawBackground();for(const p of pickups)drawPickup(p);for(const b of bullets){ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}for(const z of zombies)drawZombie(z);drawPlayer();for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.r,p.r);}ctx.globalAlpha=1;drawHUD();ctx.restore();}
  function loop(now){if(!state.running)return;const dt=Math.min(.033,(now-lastTime)/1000);lastTime=now;update(dt,now);render();if(state.running)raf=requestAnimationFrame(loop);}

  addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','KeyA','KeyD','KeyE'].includes(e.code))e.preventDefault();if(e.code==='Space'&&state?.running&&player.grounded){player.vy=-570;player.grounded=false;}if(!state?.running&&(e.code==='KeyR'||e.code==='Enter'))reset();});
  addEventListener('keyup',e=>keys[e.code]=false);
  document.getElementById('startButton').addEventListener('click',reset);
  document.getElementById('restartButton').addEventListener('click',reset);
  drawBackground();
})();
