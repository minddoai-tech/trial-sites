(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const TILE=40, COLS=48, ROWS=14, GRAVITY=0.55;
  const keys={}, colors={ grass:'#5e9e3e', dirt:'#815735', stone:'#66706d', crystal:'#41ccea', bedrock:'#28302f' };
  let world=[], player, zombies=[], particles=[], cameraX=0, running=false, last=0, elapsed=0, mineCooldown=0, shake=0, portal;

  const startScreen=document.querySelector('#start-screen');
  const endScreen=document.querySelector('#end-screen');
  const endTitle=document.querySelector('#end-title');
  const endCopy=document.querySelector('#end-copy');
  const endIcon=document.querySelector('#end-icon');

  function reset(){
    Object.keys(keys).forEach(key=>{ keys[key]=false; });
    world=Array.from({length:ROWS},()=>Array(COLS).fill(null));
    const surface=[];
    for(let x=0;x<COLS;x++){
      const h=9 + (x>8&&x<15?Math.round(Math.sin(x)*.8):0) + (x>26&&x<34?1:0);
      surface[x]=h;
      for(let y=h;y<ROWS;y++) world[y][x]=y===ROWS-1?'bedrock':y===h?'grass':y<h+3?'dirt':'stone';
    }
    // Small caves and exposed resource pockets, all reachable by mining forward.
    [[8,9],[9,9],[15,10],[16,10],[23,10],[24,10],[32,11],[33,11],[39,10]].forEach(([x,y])=>world[y][x]=null);
    [[7,9],[14,10],[22,10],[31,11],[38,9],[42,10]].forEach(([x,y])=>world[y][x]='crystal');
    player={x:2*TILE,y:(surface[2]-2)*TILE,w:26,h:64,vx:0,vy:0,grounded:false,crouch:false,facing:1,health:3,gems:0,score:0,invuln:0,mineAnim:0};
    zombies=[6,13,20,29,37,43].map((x,i)=>({x:x*TILE,y:(surface[x]-1.45)*TILE,w:29,h:56,vx:i%2?-1.05:1.05,dir:i%2?-1:1,home:x*TILE,health:2,hit:0,step:i*11}));
    portal={x:46*TILE,y:(surface[46]-2)*TILE,w:34,h:80};
    particles=[]; cameraX=0; elapsed=0; mineCooldown=0; shake=0; running=true; endScreen.classList.add('hidden');
  }

  const solid=(tx,ty)=> tx<0||tx>=COLS||ty>=ROWS || (ty>=0 && world[ty][tx]!=null);
  function collides(e,x=e.x,y=e.y){
    const l=Math.floor(x/TILE), r=Math.floor((x+e.w-1)/TILE), t=Math.floor(y/TILE), b=Math.floor((y+e.h-1)/TILE);
    for(let yy=t;yy<=b;yy++) for(let xx=l;xx<=r;xx++) if(solid(xx,yy)) return true;
    return false;
  }
  function moveEntity(e){
    e.x+=e.vx;
    if(collides(e)){ const d=Math.sign(e.vx); while(collides(e)) e.x-=d; e.vx=0; }
    e.vy=Math.min(e.vy+GRAVITY,12); e.y+=e.vy; e.grounded=false;
    if(collides(e)){ const d=Math.sign(e.vy); while(collides(e)) e.y-=d; if(e.vy>0)e.grounded=true; e.vy=0; }
  }
  function burst(x,y,color,count=8){ for(let i=0;i<count;i++) particles.push({x,y,vx:(Math.random()-.5)*5,vy:-Math.random()*4,life:25+Math.random()*20,color}); }
  function mine(down=false){
    if(mineCooldown>0)return; mineCooldown=16; player.mineAnim=9;
    const reachX=player.x+player.w/2+player.facing*34;
    const targets=down
      ? [[Math.floor((player.x+player.w/2)/TILE),Math.floor((player.y+player.h+12)/TILE)]]
      : [[Math.floor(reachX/TILE),Math.floor((player.y+player.h*.55)/TILE)],[Math.floor(reachX/TILE),Math.floor((player.y+player.h*.15)/TILE)]];
    for(const [tx,ty] of targets){
      const block=world[ty]?.[tx];
      if(block&&block!=='bedrock'){
        if(block==='crystal' && world[ty][tx]!=='crystal-hit'){ world[ty][tx]='crystal-hit'; burst((tx+.5)*TILE,(ty+.5)*TILE,'#8cecff',5); return; }
        world[ty][tx]=null; player.score+=block==='crystal-hit'?250:20;
        if(block==='crystal-hit') player.gems++;
        burst((tx+.5)*TILE,(ty+.5)*TILE,block==='crystal-hit'?'#57ddff':colors[block]||'#888',10); return;
      }
    }
    const target=!down&&zombies.find(z=>Math.abs((z.x+z.w/2)-reachX)<35&&Math.abs(z.y-player.y)<55);
    if(target){ target.health--; target.hit=8; target.vx=player.facing*3; burst(target.x+15,target.y+20,'#9ad14b'); if(target.health<=0){player.score+=150; zombies.splice(zombies.indexOf(target),1);} }
  }
  function hurt(){
    if(player.invuln>0)return; player.health--; player.invuln=90; player.vy=-6; player.vx=-player.facing*4; shake=10;
    burst(player.x+13,player.y+25,'#ff5f62',12);
    if(player.health<=0) finish(false);
  }
  function finish(win){
    running=false; endIcon.textContent=win?'◆':'☠'; endIcon.style.color=win?'#57d7ff':'#ff6268';
    endTitle.textContent=win?'Portal powered!':'You were overrun';
    endCopy.textContent=win?`You escaped with ${player.score} points in ${Math.floor(elapsed/60)} seconds.`:`The zombies got you. You mined ${player.gems} of 5 crystals.`;
    endScreen.classList.remove('hidden');
  }
  function update(){
    if(!running)return; elapsed++; mineCooldown=Math.max(0,mineCooldown-1); player.invuln=Math.max(0,player.invuln-1); player.mineAnim=Math.max(0,player.mineAnim-1);
    const crouch=!!keys.s; player.crouch=crouch;
    const speed=crouch?1.3:3.2; player.vx=(keys.a?-speed:0)+(keys.d?speed:0); if(player.vx)player.facing=Math.sign(player.vx);
    if(keys.w&&player.grounded){player.vy=-10.5;player.grounded=false;}
    if(keys.u)mine(false); else if(keys.i)mine(true); moveEntity(player);
    zombies.forEach(z=>{
      z.hit=Math.max(0,z.hit-1); z.step++; const dx=player.x-z.x;
      if(Math.abs(dx)<310) z.dir=Math.sign(dx)||z.dir;
      else if(z.x>z.home+105) z.dir=-1;
      else if(z.x<z.home-105) z.dir=1;
      const pace=Math.abs(dx)<310?1.35:1.05;
      z.vx+=(z.dir*pace-z.vx)*.13;
      const wallAhead=collides(z,z.x+z.dir*5,z.y);
      const groundAhead=solid(Math.floor((z.x+z.w/2+z.dir*22)/TILE),Math.floor((z.y+z.h+5)/TILE));
      if(wallAhead && z.grounded) z.vy=-8;
      if(!groundAhead && z.grounded){z.dir*=-1;z.vx=z.dir*pace;}
      moveEntity(z);
      if(z.x<0||z.x>COLS*TILE) z.vx*=-1;
      if(player.x<z.x+z.w&&player.x+player.w>z.x&&player.y<z.y+z.h&&player.y+player.h>z.y) hurt();
    });
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.18;p.life--;}); particles=particles.filter(p=>p.life>0);
    if(player.gems>=5 && player.x+player.w>portal.x && player.x<portal.x+portal.w) finish(true);
    cameraX+=(Math.max(0,Math.min(COLS*TILE-canvas.width,player.x-canvas.width*.4))-cameraX)*.09;
  }

  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x-cameraX),Math.round(y),w,h);}
  function drawBlock(type,x,y){
    const sx=x*TILE-cameraX, sy=y*TILE, base=type==='crystal-hit'?'#339db5':colors[type]; ctx.fillStyle=base;ctx.fillRect(sx,sy,TILE,TILE);
    ctx.fillStyle='#ffffff14';ctx.fillRect(sx+3,sy+3,TILE-6,5);ctx.fillStyle='#00000018';ctx.fillRect(sx+4,sy+TILE-7,TILE-8,4);
    if(type==='grass'){ctx.fillStyle='#8ac94d';ctx.fillRect(sx,sy,TILE,9);ctx.fillStyle='#9f7047';ctx.fillRect(sx+7,sy+16,5,4);ctx.fillRect(sx+26,sy+28,6,4);}
    if(type==='stone'){ctx.fillStyle='#89928f';ctx.fillRect(sx+7,sy+9,9,5);ctx.fillRect(sx+24,sy+24,8,6);}
    if(type.startsWith('crystal')){ctx.fillStyle='#b9f5ff';ctx.fillRect(sx+17,sy+6,7,25);ctx.fillRect(sx+9,sy+14,23,8);ctx.fillStyle='#1594bd';ctx.fillRect(sx+18,sy+22,6,10);}
  }
  function drawPlayer(){
    const blink=player.invuln&&Math.floor(player.invuln/5)%2;if(blink)return;
    const x=player.x-cameraX,y=player.y+(player.crouch?17:0),h=player.h-(player.crouch?17:0);
    ctx.fillStyle='#f2b36f';ctx.fillRect(x+4,y,18,19);ctx.fillStyle='#6d402a';ctx.fillRect(x+3,y,20,6);ctx.fillStyle='#21304b';ctx.fillRect(x,y+19,26,h-35);ctx.fillStyle='#5b7bb2';ctx.fillRect(x+3,y+h-16,8,16);ctx.fillRect(x+16,y+h-16,8,16);
    ctx.fillStyle='#162018';ctx.fillRect(x+(player.facing>0?17:7),y+8,3,4);
    if(player.mineAnim){ctx.strokeStyle='#d5dde0';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+13,y+27);ctx.lineTo(keys.i?x+13:x+13+player.facing*30,keys.i?y+h+12:y+8);ctx.stroke();}
  }
  function drawZombie(z){
    const x=z.x-cameraX,y=z.y,bob=Math.sin(z.step*.22)*1.5,swing=Math.sin(z.step*.3)*4;
    ctx.fillStyle='#112016cc';ctx.fillRect(x-9,y-20,47,14);ctx.fillStyle='#b8f06b';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('ZOMBIE',x+14,y-10);ctx.textAlign='left';
    ctx.fillStyle=z.hit?'#d7ff87':'#80b846';ctx.fillRect(x+3,y+bob,24,23);
    ctx.fillStyle='#573568';ctx.fillRect(x,y+22+bob,29,23);
    ctx.fillStyle='#527b38';ctx.fillRect(x+2+swing/3,y+44,9,12);ctx.fillRect(x+18-swing/3,y+44,9,12);
    ctx.fillStyle='#ff4e4e';ctx.fillRect(x+7,y+7+bob,5,4);ctx.fillRect(x+19,y+7+bob,5,4);
    ctx.fillStyle='#172116';ctx.fillRect(x+11,y+16+bob,10,3);
    ctx.fillStyle='#80b846';ctx.fillRect(x-7,y+24+bob+swing/3,8,7);ctx.fillRect(x+28,y+24+bob-swing/3,8,7);
  }
  function draw(){
    ctx.save(); if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.8;}
    const sky=ctx.createLinearGradient(0,0,0,380);sky.addColorStop(0,'#72cce2');sky.addColorStop(1,'#d5e6b1');ctx.fillStyle=sky;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fff8';for(let i=0;i<7;i++){let x=((i*211-cameraX*.15)%1200+1200)%1200-100;ctx.fillRect(x,70+(i%3)*45,90,16);ctx.fillRect(x+25,58+(i%3)*45,45,14);}
    ctx.fillStyle='#4f826b';ctx.beginPath();ctx.moveTo(0,420);for(let x=0;x<=canvas.width;x+=100)ctx.lineTo(x,280+Math.sin((x+cameraX*.25)/120)*50);ctx.lineTo(canvas.width,540);ctx.closePath();ctx.fill();
    const from=Math.max(0,Math.floor(cameraX/TILE)-1),to=Math.min(COLS,from+Math.ceil(canvas.width/TILE)+2);
    for(let y=0;y<ROWS;y++)for(let x=from;x<to;x++)if(world[y][x])drawBlock(world[y][x],x,y);
    const pulse=.65+Math.sin(elapsed*.08)*.2;ctx.globalAlpha=pulse;rect(portal.x-5,portal.y-5,portal.w+10,portal.h+10,'#76efff');ctx.globalAlpha=1;rect(portal.x,portal.y,portal.w,portal.h,'#193c48');rect(portal.x+7,portal.y+8,portal.w-14,portal.h-16,player.gems>=5?'#55dff4':'#315b62');
    zombies.forEach(z=>{ctx.strokeStyle='#b8f06b88';ctx.lineWidth=3;ctx.strokeRect(z.x-cameraX-11,z.y-22,51,80);drawZombie(z);});drawPlayer();particles.forEach(p=>{ctx.globalAlpha=Math.min(1,p.life/15);rect(p.x,p.y,5,5,p.color);});ctx.globalAlpha=1;
    // HUD
    ctx.fillStyle='#101912d9';ctx.fillRect(16,16,365,66);ctx.fillStyle='#eaf5e3';ctx.font='bold 18px monospace';ctx.fillText('HEALTH',30,43);for(let i=0;i<3;i++){ctx.fillStyle=i<player.health?'#ff5364':'#57353b';ctx.font='25px serif';ctx.fillText('♥',112+i*28,45);}ctx.fillStyle='#57d7ff';ctx.font='bold 20px monospace';ctx.fillText(`◆ ${player.gems} / 5`,30,70);ctx.fillStyle='#d2ddcd';ctx.font='14px monospace';ctx.fillText(`SCORE ${player.score}`,166,69);ctx.fillStyle='#b8f06b';ctx.fillText(`☠ ${zombies.length} ZOMBIES`,260,69);
    if(player.gems>=5){ctx.fillStyle='#10241de8';ctx.fillRect(canvas.width/2-175,20,350,38);ctx.fillStyle='#9ff4ff';ctx.font='bold 16px monospace';ctx.textAlign='center';ctx.fillText('PORTAL READY — GO RIGHT!',canvas.width/2,45);ctx.textAlign='left';}
    ctx.restore();
  }
  function loop(t){const steps=Math.min(3,Math.max(1,Math.round((t-last)/16.67)||1));last=t;for(let i=0;i<steps;i++)update();draw();requestAnimationFrame(loop);}
  function key(e,down){const k=e.key.toLowerCase();if(['w','a','s','d','u','i'].includes(k)){keys[k]=down;e.preventDefault();}}
  addEventListener('keydown',e=>key(e,true));addEventListener('keyup',e=>key(e,false));
  document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key;['pointerdown','pointerenter'].forEach(ev=>b.addEventListener(ev,e=>{if(ev==='pointerdown')b.setPointerCapture(e.pointerId);keys[k]=true;e.preventDefault();}));['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,e=>{keys[k]=false;e.preventDefault();}));});
  document.querySelector('#start').addEventListener('click',()=>{startScreen.classList.add('hidden');reset();});
  document.querySelector('#restart').addEventListener('click',()=>{startScreen.classList.add('hidden');reset();});
  document.querySelector('#play-again').addEventListener('click',reset);
  reset();running=false;requestAnimationFrame(loop);
})();
