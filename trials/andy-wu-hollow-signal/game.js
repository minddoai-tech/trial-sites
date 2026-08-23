(() => {
  'use strict';
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const mapCanvas = document.getElementById('map'), mctx = mapCanvas.getContext('2d');
  const ui = { start:document.getElementById('startPanel'), map:document.getElementById('mapPanel'), end:document.getElementById('endPanel'), lives:document.getElementById('lives'), explored:document.getElementById('explored') };
  const WORLD = {w:4200,h:1800}, GRAVITY=1800;
  const platforms = [
    [0,1580,780,220],
    // Beyond the opening gap, the lower route is suspended over open space.
    [900,1510,190,30],[1170,1450,140,26],[1390,1515,210,30],[1690,1430,120,26],
    [1900,1500,180,30],[2180,1420,130,26],[2400,1510,170,30],[2700,1450,110,26],
    [2910,1510,190,30],[3200,1435,130,26],[3430,1510,160,30],[3710,1460,120,26],[3930,1530,210,30],
    [180,1370,350,32],[650,1200,310,32],[1040,1400,320,32],[1430,1220,390,32],[1940,1320,260,32],[2280,1130,390,32],
    [2780,1370,260,32],[3120,1200,430,32],[3650,1390,300,32],[3850,1050,350,32],
    [80,930,440,32],[620,780,380,32],[1120,980,300,32],[1530,810,470,32],[2110,920,310,32],[2530,740,360,32],
    [3010,900,390,32],[3520,720,300,32],[3800,540,400,32],[160,510,370,32],[650,360,420,32],[1210,580,350,32],
    [1700,410,380,32],[2200,530,430,32],[2770,370,420,32],[3330,490,350,32],
    // Shorter stepping stones make every upward route readable and reachable.
    [520,1420,150,24],[790,1320,120,24],[960,1110,170,24],[710,1010,130,24],[430,860,140,24],[260,690,180,24],
    [1280,1300,120,24],[1370,1080,160,24],[1700,1010,130,24],[1880,900,120,24],[2020,760,170,24],[2290,650,130,24],
    [2470,990,130,24],[2700,880,110,24],[2890,780,150,24],[3220,790,120,24],[3380,610,150,24],
    [3700,1220,130,24],[3710,900,160,24],[3970,820,120,24],[3630,610,120,24],
    [520,600,110,24],[1050,480,140,24],[1450,480,120,24],[1580,610,110,24],[2060,610,120,24],
    [2620,580,130,24],[2680,460,100,24],[3200,570,120,24]
  ].map(a=>({x:a[0],y:a[1],w:a[2],h:a[3]}));
  const turretsBase = [
    [470,1312,'normal'],[1150,1362,'normal'],[1680,1172,'fast'],[2050,1282,'normal'],[2400,1082,'normal'],[2930,1332,'fast'],[3260,1152,'normal'],[3720,1352,'normal'],
    [760,722,'normal'],[1260,922,'fast'],[1870,752,'normal'],[2710,682,'normal'],[3280,852,'fast'],[3960,482,'normal'],[800,302,'normal'],[1830,352,'fast'],[2890,312,'normal']
  ];
  const portal={x:3430,y:390,w:52,h:80};
  const rooms = [];
  for(let y=0;y<WORLD.h;y+=300) for(let x=0;x<WORLD.w;x+=350) rooms.push({x,y,seen:false});
  const keys={}, camera={x:0,y:0}; let player, bullets, turrets, running=false, paused=false, last=0, invuln=0, exploredCount=0;

  function reset(){
    player={x:90,y:1500,w:30,h:46,vx:0,vy:0,lives:3,onGround:false,face:1,safeX:90,safeY:1500}; bullets=[];
    turrets=turretsBase.map((t,i)=>({x:t[0],y:t[1],type:t[2],cool:(i%3)*.45}));
    rooms.forEach(r=>r.seen=false); exploredCount=0; invuln=0; camera.x=0;camera.y=1050;updateHud();
  }
  function begin(){reset();running=true;paused=false;ui.start.classList.add('hidden');ui.end.classList.add('hidden');ui.map.classList.add('hidden');last=performance.now();}
  function updateHud(){ui.lives.innerHTML='';for(let i=0;i<3;i++){const h=document.createElement('i');h.className='heart'+(i>=player.lives?' lost':'');ui.lives.appendChild(h)}ui.lives.setAttribute('aria-label',player.lives+' lives');ui.explored.textContent=Math.round(exploredCount/rooms.length*100)+'%'}
  function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function update(dt){
    if(!running||paused)return; const dir=(keys.ArrowLeft||keys.KeyA?-1:0)+(keys.ArrowRight||keys.KeyD?1:0);
    player.vx += (dir*620-player.vx)*Math.min(1,dt*10); if(dir)player.face=dir;
    player.vy+=GRAVITY*dt; let ox=player.x,oy=player.y; player.x+=player.vx*dt; player.x=Math.max(0,Math.min(WORLD.w-player.w,player.x));
    for(const p of platforms)if(overlaps(player,p)){if(ox+player.w<=p.x+5)player.x=p.x-player.w;else if(ox>=p.x+p.w-5)player.x=p.x+p.w;player.vx=0}
    player.y+=player.vy*dt;player.onGround=false;
    for(const p of platforms)if(overlaps(player,p)){if(oy+player.h<=p.y+8&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.onGround=true}else if(oy>=p.y+p.h-8&&player.vy<0){player.y=p.y+p.h;player.vy=0}}
    if(player.onGround){player.safeX=player.x;player.safeY=player.y}
    if(player.y>WORLD.h+100) hit(true);
    invuln=Math.max(0,invuln-dt);
    for(const t of turrets){t.cool-=dt;if(t.cool<=0){const dx=player.x-t.x,dy=player.y-t.y,d=Math.hypot(dx,dy);if(d<950){const speed=t.type==='fast'?460:390;bullets.push({x:t.x,y:t.y,w:9,h:9,vx:dx/d*speed,vy:dy/d*speed,life:4,type:t.type});t.cool=t.type==='fast'?1:3}else t.cool=.25}}
    for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(invuln<=0&&overlaps(player,b)){b.life=0;hit(false)}if(platforms.some(p=>overlaps(b,p)))b.life=0}bullets=bullets.filter(b=>b.life>0);
    if(overlaps(player,portal))finish(true);
    for(const r of rooms)if(!r.seen&&Math.hypot(player.x-r.x-175,player.y-r.y-150)<480){r.seen=true;exploredCount++;updateHud()}
    const vw=canvas.width,vh=canvas.height;camera.x+=(Math.max(0,Math.min(WORLD.w-vw,player.x-vw*.45))-camera.x)*Math.min(1,dt*4);camera.y+=(Math.max(0,Math.min(WORLD.h-vh,player.y-vh*.55))-camera.y)*Math.min(1,dt*4);
  }
  function jump(){if(player.onGround&&running&&!paused){player.vy=-970;player.onGround=false}}
  function hit(fell=false){if(invuln>0)return;player.lives--;updateHud();if(player.lives<=0){finish(false);return}invuln=2;if(fell){player.x=player.safeX;player.y=player.safeY;player.vx=0;player.vy=0}}
  function finish(win){running=false;paused=true;ui.end.classList.remove('hidden');document.getElementById('resultSymbol').textContent=win?'◇':'×';document.getElementById('resultEyebrow').textContent=win?'SIGNAL ACQUIRED':'INTEGRITY LOST';document.getElementById('resultTitle').textContent=win?'Portal found.':'Relay rejected.';document.getElementById('resultText').textContent=win?'The hidden route is open. The relay hums back to life.':'All three lives are gone. Re-enter the sector and try a new route.';document.getElementById('restartButton').textContent=win?'PLAY AGAIN  ↻':'RESTART LEVEL  ↻'}
  function toggleMap(force){if(!running)return;paused=force!==undefined?force:!paused;ui.map.classList.toggle('hidden',!paused);if(paused)drawMap()}
  function drawMap(){const sx=mapCanvas.width/WORLD.w,sy=mapCanvas.height/WORLD.h;mctx.fillStyle='#070d10';mctx.fillRect(0,0,mapCanvas.width,mapCanvas.height);mctx.save();mctx.scale(sx,sy);for(const r of rooms)if(r.seen){mctx.fillStyle='#0f2025';mctx.fillRect(r.x,r.y,350,300)}mctx.fillStyle='#4e626a';for(const p of platforms){const near=rooms.some(r=>r.seen&&p.x<r.x+350&&p.x+p.w>r.x&&p.y<r.y+300&&p.y+p.h>r.y);if(near)mctx.fillRect(p.x,p.y,p.w,Math.max(14,p.h))}const portalSeen=rooms.some(r=>r.seen&&portal.x>r.x&&portal.x<r.x+350&&portal.y>r.y&&portal.y<r.y+300);if(portalSeen){mctx.strokeStyle='#ffcd66';mctx.lineWidth=15;mctx.strokeRect(portal.x-12,portal.y-12,portal.w+24,portal.h+24)}mctx.fillStyle='#6ee7dc';mctx.beginPath();mctx.arc(player.x,player.y,28,0,Math.PI*2);mctx.fill();mctx.restore()}
  function draw(){
    const g=ctx.createLinearGradient(0,0,0,canvas.height);g.addColorStop(0,'#101a1f');g.addColorStop(1,'#071014');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(-camera.x,-camera.y);
    ctx.strokeStyle='#152329';ctx.lineWidth=1;for(let x=0;x<WORLD.w;x+=120){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD.h);ctx.stroke()}for(let y=0;y<WORLD.h;y+=120){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD.w,y);ctx.stroke()}
    for(const p of platforms){ctx.fillStyle=p.h>100?'#182329':'#29373d';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#526268';ctx.fillRect(p.x,p.y,p.w,3);for(let x=p.x+20;x<p.x+p.w;x+=70){ctx.fillStyle='#1b292f';ctx.fillRect(x,p.y+12,32,4)}}
    const pulse=.65+.35*Math.sin(performance.now()/300);ctx.save();ctx.shadowColor='#ffce68';ctx.shadowBlur=30*pulse;ctx.strokeStyle='#ffce68';ctx.lineWidth=5;ctx.strokeRect(portal.x,portal.y,portal.w,portal.h);ctx.fillStyle=`rgba(255,206,104,${.12*pulse})`;ctx.fillRect(portal.x,portal.y,portal.w,portal.h);ctx.restore();
    for(const t of turrets){const a=Math.atan2(player.y-t.y,player.x-t.x);ctx.save();ctx.translate(t.x,t.y);ctx.fillStyle=t.type==='fast'?'#d55a58':'#78868c';ctx.fillRect(-18,-16,36,32);ctx.rotate(a);ctx.fillStyle=t.type==='fast'?'#ff7770':'#a7b2b6';ctx.fillRect(0,-5,30,10);ctx.restore()}
    for(const b of bullets){ctx.fillStyle=b.type==='fast'?'#ff6b66':'#ffbc66';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
    if(!(invuln>0&&Math.floor(invuln*12)%2)){ctx.save();ctx.translate(player.x+player.w/2,player.y+player.h/2);ctx.fillStyle='#6ee7dc';ctx.shadowColor='#6ee7dc';ctx.shadowBlur=12;ctx.fillRect(-12,-18,24,36);ctx.fillStyle='#d8ffff';ctx.fillRect(player.face>0?8:-12,-11,5,8);ctx.fillStyle='#25383d';ctx.fillRect(-10,18,7,8);ctx.fillRect(3,18,7,8);ctx.restore()}
    ctx.restore();
    const vignette=ctx.createRadialGradient(canvas.width/2,canvas.height/2,200,canvas.width/2,canvas.height/2,750);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#0009');ctx.fillStyle=vignette;ctx.fillRect(0,0,canvas.width,canvas.height)
  }
  function loop(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;update(dt);draw();requestAnimationFrame(loop)}
  addEventListener('keydown',e=>{keys[e.code]=true;if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code))e.preventDefault();if((e.code==='ArrowUp'||e.code==='KeyW')&&!e.repeat)jump();if(e.code==='KeyM'&&!e.repeat)toggleMap();if(e.code==='KeyR'&&!e.repeat)begin()});addEventListener('keyup',e=>keys[e.code]=false);
  document.getElementById('startButton').onclick=begin;document.getElementById('restartButton').onclick=begin;document.getElementById('mapButton').onclick=()=>toggleMap();document.getElementById('closeMap').onclick=()=>toggleMap(false);
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(1,0,0,1,0,0)}addEventListener('resize',resize);resize();reset();requestAnimationFrame(loop);
})();
