(() => {
  'use strict';
  const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = { health:$('health'),score:$('score'),stage:$('stageLabel'),shield:$('shield'),start:$('startScreen'),upgrade:$('upgradeScreen'),end:$('endScreen'),choices:$('upgradeChoices') };
  const W=canvas.width,H=canvas.height, keys={}, stars=[];
  for(let i=0;i<110;i++) stars.push({x:Math.random()*W,y:Math.random()*H,s:Math.random()*2+1,v:15+Math.random()*35});
  let state='menu', last=0, wave=1, waveClock=0, spawnClock=0, score=0, screenShake=0, muted=false, audio;
  let player, bullets, enemies, particles, pickups;
  const upgradePaths={
    cannons:{icon:'⇈',tiers:[
      {name:'TWIN CANNONS',desc:'Fire a second laser in parallel.',apply:p=>p.shots=2},
      {name:'TRIPLE CANNONS',desc:'Add a third laser to every volley.',apply:p=>p.shots=3},
      {name:'QUAD CANNONS',desc:'Fill the sky with four parallel lasers.',apply:p=>p.shots=4}
    ]},
    rapid:{icon:'⚡',tiers:[
      {name:'RAPID CORE',desc:'Increase your rate of fire by 25%.',apply:p=>p.fireRate*=.75},
      {name:'PULSE CORE',desc:'Increase your rate of fire by another 20%.',apply:p=>p.fireRate*=.8},
      {name:'NOVA CORE',desc:'Increase your rate of fire by another 15%.',apply:p=>p.fireRate*=.85}
    ]},
    shield:{icon:'◇',tiers:[
      {name:'PLASMA SHIELD',desc:'Block the next two hits.',apply:p=>p.shield+=2},
      {name:'HARDENED SHIELD',desc:'Block three additional hits.',apply:p=>p.shield+=3},
      {name:'AEGIS SHIELD',desc:'Block four additional hits.',apply:p=>p.shield+=4}
    ]},
    power:{icon:'✦',tiers:[
      {name:'OVERCHARGE',desc:'Lasers deal double damage.',apply:p=>p.damage=2},
      {name:'SUPERCHARGE',desc:'Lasers now deal triple damage.',apply:p=>p.damage=3},
      {name:'STAR CHARGE',desc:'Lasers now deal quadruple damage.',apply:p=>p.damage=4}
    ]},
    speed:{icon:'»',tiers:[
      {name:'THRUSTERS',desc:'Move 20% faster.',apply:p=>p.speed*=1.2},
      {name:'ION THRUSTERS',desc:'Gain another 15% movement speed.',apply:p=>p.speed*=1.15},
      {name:'WARP THRUSTERS',desc:'Gain another 10% movement speed.',apply:p=>p.speed*=1.1}
    ]}
  };
  let upgradeLevels, lastUpgradePath;
  function reset(){
    player={x:W/2,y:H-70,w:42,h:46,speed:260,health:3,shield:0,shots:1,damage:1,fireRate:.18,fireClock:0,inv:0};
    bullets=[];enemies=[];particles=[];pickups=[];wave=1;waveClock=0;spawnClock=.5;score=0;screenShake=0;
    upgradeLevels=Object.fromEntries(Object.keys(upgradePaths).map(key=>[key,0]));lastUpgradePath=null;updateHUD();
  }
  function start(){reset();state='playing';ui.start.classList.add('hidden');ui.end.classList.add('hidden');beep(440,.08,'square');}
  function updateHUD(){
    ui.health.textContent=Array(Math.max(0,player?.health||0)).fill('♥').join(' ')||'EMPTY';
    ui.score.textContent=String(score).padStart(6,'0'); ui.shield.textContent=player?.shield?`◆ x${player.shield}`:'—';
    ui.stage.textContent=wave<=3?`WAVE ${wave} / 3`:'COMMAND SHIP';
  }
  function beep(freq,d=.05,type='square',vol=.035){if(muted)return;try{audio ||= new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+d);}catch{}}
  function fire(){const gap=10;for(let i=0;i<player.shots;i++)bullets.push({x:player.x+(i-(player.shots-1)/2)*gap,y:player.y-18,vx:0,vy:-620,r:3,friendly:true,damage:player.damage});beep(760,.035);}
  function spawnEnemy(type){
    const x=70+Math.random()*(W-140), base={x,y:-35,w:42,h:32,hp:1,maxHp:1,vx:(Math.random()<.5?-1:1)*(34+wave*7),vy:18+wave*5,fire:2.8+Math.random()*1.5,type,age:0,phase:Math.random()*6};
    if(type==='shield'){base.hp=3;base.maxHp=3;base.w=52;base.h=39;}
    if(type==='diver'){base.hp=2;base.maxHp=2;base.w=46;base.h=35;base.vy=26;}
    enemies.push(base);
  }
  function spawnBoss(){enemies.push({x:W/2,y:85,w:150,h:70,hp:80,maxHp:80,vx:80,vy:0,fire:.7,type:'boss',age:0,phase:0,summon:5});}
  function enemyShot(e){
    if(e.type==='boss'){for(const vx of [-115,0,115])bullets.push({x:e.x,y:e.y+35,vx,vy:190,r:10,friendly:false});beep(100,.12,'sawtooth',.05);}
    else {const dx=player.x-e.x,dy=player.y-e.y,l=Math.hypot(dx,dy);bullets.push({x:e.x,y:e.y+12,vx:dx/l*75,vy:dy/l*180,r:5,friendly:false});}
  }
  const hit=(a,b)=>Math.abs(a.x-b.x)<(a.w/2+(b.r||b.w/2))&&Math.abs(a.y-b.y)<(a.h/2+(b.r||b.h/2));
  function burst(x,y,color,count=10){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,life:.35+Math.random()*.4,color});}
  function hurt(){if(player.inv>0)return;if(player.shield>0){player.shield--;burst(player.x,player.y,'#4dfcff',14);beep(250,.15);}
    else {player.health--;player.inv=1.4;screenShake=10;burst(player.x,player.y,'#ff4f9a',20);beep(70,.3,'sawtooth',.08);}updateHUD();if(player.health<=0)finish(false);}
  function finish(win){state='ended';$('endKicker').textContent=win?'MISSION COMPLETE':'SHIP DESTROYED';$('endTitle').textContent=win?'The galaxy is safe.':'The swarm broke through.';$('endText').textContent=`Final score: ${String(score).padStart(6,'0')}. ${win?'The command ship is space dust.':'Regroup, rearm, and try again.'}`;ui.end.classList.remove('hidden');beep(win?660:80,.6,win?'square':'sawtooth',.06);}
  function clearWave(){
    state='upgrade';bullets=[];enemies=[];ui.upgrade.classList.remove('hidden');
    const available=Object.keys(upgradePaths).filter(key=>upgradeLevels[key]<upgradePaths[key].tiers.length);
    const picks=[];
    if(lastUpgradePath&&available.includes(lastUpgradePath))picks.push(lastUpgradePath);
    for(const key of available.filter(key=>!picks.includes(key)).sort(()=>Math.random()-.5)){if(picks.length===3)break;picks.push(key);}
    ui.choices.innerHTML='';
    picks.forEach(key=>{const path=upgradePaths[key],u=path.tiers[upgradeLevels[key]],b=document.createElement('button');b.className='upgrade';b.innerHTML=`<span class="glyph">${path.icon}</span><b>${u.name}</b><small>${u.desc}</small>`;b.onclick=()=>{u.apply(player);upgradeLevels[key]++;lastUpgradePath=key;ui.upgrade.classList.add('hidden');wave++;waveClock=0;spawnClock=.8;state='playing';if(wave===4)spawnBoss();updateHUD();beep(520,.14);};ui.choices.appendChild(b);});
  }
  function update(dt){
    stars.forEach(s=>{s.y+=s.v*dt;if(s.y>H){s.y=0;s.x=Math.random()*W;}}); if(state!=='playing')return;
    waveClock+=dt;player.fireClock-=dt;player.inv=Math.max(0,player.inv-dt);let dx=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0),dy=(keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0),l=Math.hypot(dx,dy)||1;player.x=Math.max(20,Math.min(W-20,player.x+dx/l*player.speed*dt));player.y=Math.max(80,Math.min(H-25,player.y+dy/l*player.speed*dt));
    if(keys.Space&&player.fireClock<=0){fire();player.fireClock=player.fireRate;}
    if(wave<=3){spawnClock-=dt;if(spawnClock<=0){const r=Math.random();let type='basic';if(wave===2)type=r<.22?'shield':r<.35?'diver':'basic';if(wave===3)type=r<.28?'shield':r<.50?'diver':'basic';spawnEnemy(type);spawnClock=(wave===1?1.85:wave===2?1.55:1.2)+Math.random()*.5;}if(waveClock>30)clearWave();}
    for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;}
    for(const e of enemies){e.age+=dt;e.x+=e.vx*dt;e.y+=e.vy*dt;if(e.x<e.w/2||e.x>W-e.w/2)e.vx*=-1;if(e.type==='diver'&&e.age>2.6&&e.age<2.65){const dx=player.x-e.x,dy=player.y-e.y,l=Math.hypot(dx,dy);e.vx=dx/l*220;e.vy=dy/l*220;}e.fire-=dt;if(e.fire<=0){enemyShot(e);e.fire=e.type==='boss'?.9:(wave===1?3.2:wave===2?2.65:2.2)+Math.random()*1.4;}if(e.type==='boss'){e.summon-=dt;if(e.summon<=0){spawnEnemy('basic');spawnEnemy(Math.random()<.5?'shield':'diver');e.summon=5.5;}e.y=85+Math.sin(e.age)*15;}if(e.y>H+40||hit(player,e)){if(e.y<H+40)hurt();e.hp=0;}}
    for(const b of bullets){if(b.dead)continue;if(b.friendly){for(const e of enemies){if(e.hp>0&&hit(e,b)){e.hp-=b.damage;b.dead=true;burst(b.x,b.y,e.type==='shield'?'#4dfcff':'#ff4f9a',5);if(e.hp<=0){score+=e.type==='boss'?5000:e.type==='shield'?250:e.type==='diver'?200:100;burst(e.x,e.y,e.type==='boss'?'#ffe568':'#ff4f9a',e.type==='boss'?80:18);beep(e.type==='boss'?55:130,e.type==='boss'?.5:.08,'sawtooth');if(e.type==='boss')finish(true);updateHUD();}break;}}}else if(hit(player,b)){b.dead=true;hurt();}}
    bullets=bullets.filter(b=>!b.dead&&b.y>-30&&b.y<H+30&&b.x>-30&&b.x<W+30);enemies=enemies.filter(e=>e.hp>0);particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vx*=.97;p.vy*=.97;});particles=particles.filter(p=>p.life>0);screenShake*=.85;
  }
  function draw(){
    ctx.save();ctx.clearRect(0,0,W,H);if(screenShake)ctx.translate((Math.random()-.5)*screenShake,(Math.random()-.5)*screenShake);
    ctx.fillStyle='#040914';ctx.fillRect(0,0,W,H);for(const s of stars){ctx.fillStyle=s.s>2?'#8dc7df':'#344c68';ctx.fillRect(s.x,s.y,s.s,s.s);}ctx.strokeStyle='#101d31';ctx.globalAlpha=.7;for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.globalAlpha=1;
    if(player){ctx.save();ctx.translate(player.x,player.y);if(player.inv>0&&Math.floor(player.inv*12)%2)ctx.globalAlpha=.25;ctx.fillStyle='#4dfcff';ctx.beginPath();ctx.moveTo(0,-27);ctx.lineTo(24,22);ctx.lineTo(8,16);ctx.lineTo(0,26);ctx.lineTo(-8,16);ctx.lineTo(-24,22);ctx.closePath();ctx.fill();ctx.fillStyle='#ffe568';ctx.fillRect(-5,22,10,11);if(player.shield){ctx.strokeStyle='#4dfcff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,36,0,Math.PI*2);ctx.stroke();}ctx.restore();}
    for(const e of enemies){ctx.save();ctx.translate(e.x,e.y);if(e.type==='boss'){ctx.fillStyle='#ff4f9a';ctx.fillRect(-75,-25,150,50);ctx.fillStyle='#8e2a69';ctx.fillRect(-55,-35,110,15);ctx.fillStyle='#ffe568';for(let x=-50;x<=50;x+=25)ctx.fillRect(x,-9,10,12);ctx.fillStyle='#311029';ctx.fillRect(-65,10,130,9);}else{ctx.fillStyle=e.type==='diver'?'#ffe568':'#ff4f9a';ctx.fillRect(-e.w/2,-8,e.w,16);ctx.fillRect(-e.w/3,-e.h/2,e.w/1.5,e.h);ctx.fillStyle='#07101b';ctx.fillRect(-9,-3,5,5);ctx.fillRect(4,-3,5,5);if(e.type==='shield'&&e.hp>1){ctx.strokeStyle='#4dfcff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.stroke();}}ctx.restore();if(e.type==='boss'){ctx.fillStyle='#15253a';ctx.fillRect(e.x-80,e.y-55,160,7);ctx.fillStyle='#ff4f9a';ctx.fillRect(e.x-80,e.y-55,160*(e.hp/e.maxHp),7);}}
    for(const b of bullets){ctx.fillStyle=b.friendly?'#4dfcff':'#ff6a62';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;
    if(state==='paused'){ctx.fillStyle='#03060ccc';ctx.fillRect(0,0,W,H);ctx.fillStyle='#e9fbff';ctx.font='bold 36px Courier New';ctx.textAlign='center';ctx.fillText('PAUSED',W/2,H/2);ctx.font='16px Courier New';ctx.fillText('Press P to resume',W/2,H/2+34);}ctx.restore();
  }
  function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop);}requestAnimationFrame(loop);
  addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='KeyP'&&(state==='playing'||state==='paused'))state=state==='playing'?'paused':'playing';});addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{if(state==='playing')state='paused';});
  $('startBtn').onclick=start;$('restartBtn').onclick=start;$('muteBtn').onclick=()=>{muted=!muted;$('muteBtn').textContent=`SOUND: ${muted?'OFF':'ON'}`;};
  reset();draw();
})();
