(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.querySelector('#score');
  const intro = document.querySelector('#intro');
  const result = document.querySelector('#result');
  const finalScore = document.querySelector('#finalScore');
  const resultTitle = document.querySelector('#resultTitle');
  const resultEyebrow = document.querySelector('#resultEyebrow');
  const resultMessage = document.querySelector('#resultMessage');

  const W = 960, H = 600, keys = {}, stars = [];
  let player, platforms, meteors, particles, cameraY, highestY, score, state = 'intro', last = 0, meteorClock = 0, platformTop;
  const rand = (a,b) => a + Math.random() * (b-a);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

  for(let i=0;i<100;i++) stars.push({x:rand(0,W),y:rand(0,H),r:rand(.4,1.6),a:rand(.15,.65)});

  function addPlatform(x,y,w=rand(105,175)){ platforms.push({x,y,w,h:14}); }
  function init(){
    player={x:W/2-16,y:H-150,w:32,h:42,vx:0,vy:0,onGround:false,facing:1,drop:0,jumpHold:0};
    platforms=[]; meteors=[]; particles=[]; cameraY=0; highestY=player.y; score=0; meteorClock=1.3;
    addPlatform(W/2-85,H-95,170);
    let y=H-185, x=W/2-80;
    while(y>-200){ x=clamp(x+rand(-210,210),35,W-200); addPlatform(x,y); y-=rand(72,105); }
    platformTop=y; updateScore();
  }
  function start(){ init(); state='playing'; intro.classList.add('hidden'); result.classList.add('hidden'); canvas.focus(); }
  function updateScore(){ score=Math.min(1000,Math.floor(Math.max(0,(H-150-highestY)*1.08))); scoreEl.textContent=String(score).padStart(4,'0'); }
  function end(won){
    state=won?'won':'lost'; finalScore.textContent=String(score).padStart(4,'0');
    resultEyebrow.textContent=won?'SUMMIT REACHED':'RUN OVER'; resultTitle.textContent=won?'YOU ESCAPED!':'INCINERATED.';
    resultTitle.style.color=won?'#dcff38':'#f4f1e8';
    resultMessage.textContent=won?'1000 altitude. The volcano never stood a chance.':'The volcano claimed another climber. Get higher, faster.';
    result.classList.remove('hidden');
  }
  function burst(x,y,color,count=12){ for(let i=0;i<count;i++) particles.push({x,y,vx:rand(-130,130),vy:rand(-170,30),life:rand(.3,.8),color,r:rand(2,5)}); }
  function spawnMeteor(){
    const x=rand(30,W-30), targetX=player.x+rand(-100,100), speed=rand(210,300)+score*.05;
    meteors.push({x,y:cameraY-60,r:rand(14,24),vx:(targetX-x)*.13,vy:speed,rot:0});
  }
  function overlap(a,b){ return a.x<b.x+(b.w||b.r*2)&&a.x+a.w>b.x-(b.r||0)&&a.y<b.y+(b.h||b.r*2)&&a.y+a.h>b.y-(b.r||0); }

  function update(dt){
    if(state!=='playing') return;
    const accel=1700, maxSpeed=270;
    if(keys.ArrowLeft||keys.KeyA){player.vx-=accel*dt;player.facing=-1;}
    if(keys.ArrowRight||keys.KeyD){player.vx+=accel*dt;player.facing=1;}
    if(!(keys.ArrowLeft||keys.KeyA||keys.ArrowRight||keys.KeyD)) player.vx*=Math.pow(.0005,dt);
    player.vx=clamp(player.vx,-maxSpeed,maxSpeed); player.vy+=1050*dt;
    const holdingJump=keys.ArrowUp||keys.KeyW||keys.Space;
    if(holdingJump&&player.jumpHold>0&&player.vy<0){player.vy-=1700*dt;player.jumpHold-=dt;}
    else if(!holdingJump||player.vy>=0) player.jumpHold=0;
    if((keys.ArrowDown||keys.KeyS)&&player.onGround){player.drop=.18;player.y+=4;player.onGround=false;}
    player.drop=Math.max(0,player.drop-dt);
    const oldBottom=player.y+player.h;
    player.x+=player.vx*dt; player.y+=player.vy*dt;
    if(player.x+player.w<0) player.x=W; if(player.x>W) player.x=-player.w;
    player.onGround=false;
    if(player.vy>=0&&player.drop<=0){
      for(const p of platforms){ if(player.x+player.w>p.x+5&&player.x<p.x+p.w-5&&oldBottom<=p.y&&player.y+player.h>=p.y){ player.y=p.y-player.h;player.vy=0;player.onGround=true;break; } }
    }
    highestY=Math.min(highestY,player.y); updateScore();
    const desired=player.y-H*.38; if(desired<cameraY) cameraY+=(desired-cameraY)*Math.min(1,5*dt);
    while(platformTop>cameraY-300){
      const prev=platforms[platforms.length-1], y=platformTop-rand(72,105);
      const x=clamp(prev.x+rand(-230,230),30,W-205); addPlatform(x,y); platformTop=y;
    }
    platforms=platforms.filter(p=>p.y<cameraY+H+100);
    meteorClock-=dt; if(meteorClock<=0){spawnMeteor();meteorClock=rand(.8,1.55)*Math.max(.55,1-score/1800);}
    for(const m of meteors){m.x+=m.vx*dt;m.y+=m.vy*dt;m.rot+=dt*5;if(overlap(player,{x:m.x-m.r,y:m.y-m.r,w:m.r*2,h:m.r*2})){burst(player.x+16,player.y+20,'#ff4b1f',24);end(false);}}
    meteors=meteors.filter(m=>m.y<cameraY+H+80);
    for(const q of particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=400*dt;q.life-=dt;}
    particles=particles.filter(q=>q.life>0);
    const lavaY=cameraY+H-28;
    if(player.y+player.h>lavaY) end(false);
    if(score>=1000) end(true);
  }

  function drawMountain(offset,base,color,peak){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,base);for(let x=0;x<=W;x+=80)ctx.lineTo(x,base-rand(0,peak));ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();}
  function draw(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#181b1c');g.addColorStop(1,'#29201a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(const s of stars){ctx.globalAlpha=s.a;ctx.fillStyle='#f4f1e8';ctx.fillRect(s.x,(s.y-cameraY*.07+H*3)%H,s.r,s.r);}ctx.globalAlpha=1;
    ctx.fillStyle='#252622';ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,360);ctx.lineTo(120,300);ctx.lineTo(220,420);ctx.lineTo(370,270);ctx.lineTo(510,390);ctx.lineTo(720,245);ctx.lineTo(960,380);ctx.lineTo(960,H);ctx.fill();
    ctx.save();ctx.translate(0,-cameraY);
    for(const p of platforms){
      ctx.fillStyle='#080907';ctx.fillRect(p.x+7,p.y+7,p.w,p.h+9);ctx.fillStyle='#d9d8c9';ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#77786d';for(let x=p.x+8;x<p.x+p.w-5;x+=22)ctx.fillRect(x,p.y+5,12,3);
      ctx.fillStyle='#dcff38';ctx.fillRect(p.x,p.y,p.w,3);
    }
    for(const m of meteors){
      ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.rot);ctx.fillStyle='#ff4b1f';ctx.beginPath();ctx.moveTo(0,-m.r*3);ctx.lineTo(m.r*.7,-m.r);ctx.lineTo(-m.r*.7,-m.r);ctx.fill();ctx.fillStyle='#ee6b35';ctx.beginPath();ctx.arc(0,0,m.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3b2920';ctx.beginPath();ctx.arc(-5,-3,m.r*.35,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(player){
      const x=player.x,y=player.y,bob=player.onGround?Math.sin(performance.now()/90)*1.5:0;ctx.save();ctx.translate(x+player.w/2,y+player.h/2+bob);ctx.scale(player.facing,1);
      ctx.fillStyle='#000';ctx.fillRect(-13,-17,30,38);ctx.fillStyle='#dcff38';ctx.fillRect(-16,-20,29,35);ctx.fillStyle='#10120f';ctx.fillRect(1,-13,9,5);ctx.fillRect(5,-15,5,5);ctx.fillStyle='#f4f1e8';ctx.fillRect(8,-14,2,2);ctx.fillStyle='#dcff38';ctx.fillRect(-12,14,8,10);ctx.fillRect(5,14,8,10);ctx.fillStyle='#ff4b1f';ctx.fillRect(-18,-13,4,17);ctx.restore();
    }
    for(const q of particles){ctx.globalAlpha=Math.max(0,q.life*2);ctx.fillStyle=q.color;ctx.fillRect(q.x,q.y,q.r,q.r);}ctx.globalAlpha=1;ctx.restore();
    const lava=ctx.createLinearGradient(0,H-70,0,H);lava.addColorStop(0,'#ff4b1f00');lava.addColorStop(.55,'#ff4b1f');lava.addColorStop(1,'#ffb11b');ctx.fillStyle=lava;ctx.fillRect(0,H-75,W,75);
    ctx.fillStyle='#ffe25a';for(let x=0;x<W;x+=28){const h=8+Math.sin(performance.now()/180+x)*7;ctx.fillRect(x,H-31-h,20,h);}
    if(state==='intro'){ctx.fillStyle='#dcff38';ctx.font='700 12px Space Mono';ctx.fillText('1000',W-90,75);ctx.strokeStyle='#dcff38';ctx.beginPath();ctx.moveTo(W-130,81);ctx.lineTo(W-30,81);ctx.stroke();}
  }
  function frame(t){const dt=Math.min(.025,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(frame);}
  function jump(){if(state==='playing'&&player.onGround){player.vy=-500;player.jumpHold=.22;player.onGround=false;burst(player.x+16,player.y+42,'#dcff38',7);}}
  addEventListener('keydown',e=>{keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='ArrowUp'||e.code==='KeyW')jump();if(e.code==='Space'){if(state==='intro'||state==='lost'||state==='won')start();else jump();}if(e.code==='KeyR'&&state!=='playing')start();});
  addEventListener('keyup',e=>{keys[e.code]=false;if(player&&!(keys.ArrowUp||keys.KeyW||keys.Space))player.jumpHold=0;});
  document.querySelector('#startBtn').addEventListener('click',start);document.querySelector('#restartBtn').addEventListener('click',start);
  init();requestAnimationFrame(frame);
})();
