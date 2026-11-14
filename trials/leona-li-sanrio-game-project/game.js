const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('startOverlay');
const keys = {};
const world = { w: 2400, h: 1500 };
let scale = 1, dpr = 1, last = 0, toastTimer, bannerTimer;
let state;

const places = [
  { name:'Hello Kitty Plaza', x:820, y:650, color:'#ff91ad', unlocked:0 },
  { name:'Cinnamoroll Boardwalk', x:1600, y:420, color:'#75d9eb', unlocked:1 },
  { name:'My Melody Garden', x:1810, y:1080, color:'#ffb4cb', unlocked:2 },
  { name:'Kuromi Night Market', x:500, y:1090, color:'#9b83da', unlocked:3 }
];
const villagers = [
  { x:620,y:510, name:'Pompompurin', kind:'pompom', task:'lost their picnic basket', done:false, active:true },
  { x:1030,y:820, name:'My Melody', kind:'melody', task:'needs help planting flowers', done:false, active:true },
  { x:1510,y:650, name:'Hello Kitty', kind:'kitty', task:'dropped their star shells', done:false, active:true, unlock:1 },
  { x:1880,y:960, name:'Keroppi', kind:'keroppi', task:'needs a bridge repaired', done:false, active:true, unlock:2 },
  { x:480,y:1190, name:'Kuromi', kind:'kuromi', task:'needs a lantern delivered', done:false, active:true, unlock:3 }
];
const builds = [
  { x:760,y:850, name:'Kitty Cottage', done:false, unlock:0 },
  { x:1390,y:360, name:'Cinna Hut', done:false, unlock:1 },
  { x:1900,y:1180, name:'Melody Cafe', done:false, unlock:2 },
  { x:360,y:1030, name:'Kuromi Stall', done:false, unlock:3 }
];

function resetGame(){
  state={ player:{x:1200,y:760,dir:1,jump:0}, points:0, level:1, shells:12, unlocked:0, started:false, completed:false };
  villagers.forEach(v=>{v.done=false;v.active=true}); builds.forEach(b=>b.done=false);
  overlay.style.display='grid'; updateHud(); updateQuest();
}
function resize(){ dpr=window.devicePixelRatio||1; const r=canvas.getBoundingClientRect(); canvas.width=r.width*dpr;canvas.height=r.height*dpr;scale=Math.min(r.width/world.w,r.height/world.h); }
function addPoints(n, message){ state.points += n; state.shells += n; while(state.points>=20){state.points-=20;state.level++;state.unlocked=Math.min(3,state.level-1); showBanner(places[state.unlocked]?.name||'A new place');} updateHud(); toast(message); updateQuest(); }
function updateHud(){ document.getElementById('levelValue').textContent=state.level; document.getElementById('pointsValue').textContent=state.points; document.getElementById('shellValue').textContent=state.shells; document.getElementById('progressBar').style.width=(state.points/20*100)+'%'; }
function toast(t){ const el=document.getElementById('toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200); }
function showBanner(name){ const el=document.getElementById('levelBanner'); document.getElementById('bannerPlace').textContent=name;el.classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>el.classList.remove('show'),2800); }
function updateQuest(){ const q=document.getElementById('questText'); const open=villagers.find(v=>!v.done&&v.unlock<=state.unlocked); const site=builds.find(b=>!b.done&&b.unlock<=state.unlocked); if(open) {q.textContent=`${open.name} ${open.task}. Find them and press E.`;document.getElementById('questReward').textContent='+1 point';} else if(site){q.textContent=`A new home site is ready: ${site.name}. Press E nearby.`;document.getElementById('questReward').textContent='+5 points';} else {q.textContent='You helped everyone here! Keep exploring for the next place.';document.getElementById('questReward').textContent='town hero';} }
function start(){ state.started=true;overlay.style.display='none';toast('Follow the sparkles to your first neighbor!'); }
function near(a,b,d=72){return Math.hypot(a.x-b.x,a.y-b.y)<d;}
function interact(){ const p=state.player; const v=villagers.find(v=>!v.done&&v.unlock<=state.unlocked&&near(p,v,76)); if(v){v.done=true;v.active=false;addPoints(1,`You helped ${v.name}! +1 point`);return;} const b=builds.find(b=>!b.done&&b.unlock<=state.unlocked&&near(p,b,90));if(b){b.done=true;addPoints(5,`${b.name} is ready! +5 points`);return;} toast('Move closer to a neighbor or building spot.'); }
function update(dt){ const p=state.player; let dx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0),dy=(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0); if(dx||dy){const l=Math.hypot(dx,dy);p.x+=dx/l*230*dt;p.y+=dy/l*230*dt;p.dir=dx||p.dir;} p.x=Math.max(42,Math.min(world.w-42,p.x));p.y=Math.max(42,Math.min(world.h-42,p.y));p.jump=Math.max(0,p.jump-dt*2.7); }
function draw(){ const cw=canvas.width/dpr,ch=canvas.height/dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch); const camX=Math.max(0,Math.min(world.w-cw/scale,state.player.x-cw/scale/2)),camY=Math.max(0,Math.min(world.h-ch/scale,state.player.y-ch/scale/2));ctx.save();ctx.scale(scale,scale);ctx.translate(-camX,-camY); drawWorld();ctx.restore(); }
function drawWorld(){
  ctx.fillStyle='#25b9d2';ctx.fillRect(0,0,world.w,world.h);
  ctx.globalAlpha=.35;ctx.strokeStyle='#d6ffff';ctx.lineWidth=8;for(let y=55;y<world.h;y+=78){for(let x=20+(y%110);x<world.w;x+=180){ctx.beginPath();ctx.arc(x,y,25,Math.PI,Math.PI*2);ctx.stroke();}}ctx.globalAlpha=1;
  ctx.fillStyle='#b16a46';ctx.beginPath();ctx.roundRect(52,58,2296,1385,112);ctx.fill();
  ctx.fillStyle='#ffe083';ctx.strokeStyle='#4a7377';ctx.lineWidth=9;ctx.beginPath();ctx.roundRect(73,78,2254,1345,98);ctx.fill();ctx.stroke();
  for(let x=170;x<2250;x+=210){for(let y=180;y<1360;y+=215){drawFlowerPatch(x+(y%75),y);drawShell(x+55,y+34);}}
  ctx.fillStyle='#f6b75c';ctx.strokeStyle='#d87963';ctx.lineWidth=7;ctx.beginPath();ctx.roundRect(95,680,2210,170,58);ctx.fill();ctx.stroke();ctx.beginPath();ctx.roundRect(1115,95,170,1310,58);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#fff4c6';ctx.lineWidth=8;ctx.setLineDash([30,24]);ctx.beginPath();ctx.moveTo(120,765);ctx.lineTo(2280,765);ctx.stroke();ctx.beginPath();ctx.moveTo(1200,115);ctx.lineTo(1200,1390);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#ffcc3e';ctx.strokeStyle='#3d6870';ctx.lineWidth=8;ctx.beginPath();ctx.arc(1200,765,230,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff5c8';ctx.beginPath();ctx.arc(1200,765,190,0,Math.PI*2);ctx.fill();
  drawSign(1200,560,'SANRIO ISLAND');drawFountain(1200,765);drawPalm(190,220);drawPalm(2180,260);drawPalm(2180,1230);drawPalm(205,1270);drawCloud(420,275);drawCloud(1810,210);drawCloud(1000,1290);drawBoardwalk(1650,245);
  places.forEach((pl,i)=>{if(i<=state.unlocked){ctx.fillStyle=pl.color;ctx.beginPath();ctx.roundRect(pl.x-135,pl.y-100,270,200,24);ctx.fill(); drawBuilding(pl.x,pl.y,pl.name,pl.color);}});
  builds.forEach(b=>{if(b.unlock<=state.unlocked&&!b.done)drawBuild(b);else if(b.done)drawHome(b);}); villagers.forEach(v=>{if(v.unlock<=state.unlocked&&!v.done)drawVillager(v);}); drawPlayer(state.player);
}
function drawFlowerPatch(x,y){ctx.fillStyle='#4eaf66';ctx.beginPath();ctx.ellipse(x,y+8,25,12,0,0,Math.PI*2);ctx.fill();['#ff3f78','#ffcc3e','#7659c9'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x-10+i*10,y-9+(i%2)*18,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();});}
function drawShell(x,y){ctx.fillStyle='#fff2c7';ctx.strokeStyle='#d79e70';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,9,Math.PI,0);ctx.lineTo(x+9,y+8);ctx.lineTo(x-9,y+8);ctx.closePath();ctx.fill();ctx.stroke();}
function drawFountain(x,y){ctx.fillStyle='#55cfe0';ctx.strokeStyle='#3d6870';ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(x,y+45,75,24,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x-40,y+30);ctx.lineTo(x-25,y-25);ctx.lineTo(x+25,y-25);ctx.lineTo(x+40,y+30);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y-43,9,0,Math.PI*2);ctx.fill();ctx.stroke();}
function drawBoardwalk(x,y){ctx.save();ctx.translate(x,y);ctx.fillStyle='#be744e';ctx.strokeStyle='#704b4d';ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(-180,-30,360,80,18);ctx.fill();ctx.stroke();for(let i=-150;i<180;i+=38){ctx.strokeStyle='#f6c46c';ctx.beginPath();ctx.moveTo(i,-26);ctx.lineTo(i,44);ctx.stroke();}ctx.fillStyle='#ff3f78';ctx.beginPath();ctx.roundRect(-95,-82,190,48,14);ctx.fill();ctx.fillStyle='#fff';ctx.font='800 16px DM Sans';ctx.textAlign='center';ctx.fillText('CINNAMOROLL PIER',0,-51);ctx.restore();}
function drawPalm(x,y){ctx.save();ctx.translate(x,y);ctx.strokeStyle='#9a693b';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(0,70);ctx.quadraticCurveTo(-12,15,4,-36);ctx.stroke();ctx.fillStyle='#25a85c';for(let a=0;a<6;a++){ctx.save();ctx.rotate(a*Math.PI/3);ctx.beginPath();ctx.ellipse(0,-54,12,48,0,0,Math.PI*2);ctx.fill();ctx.restore();}ctx.restore();}
function drawCloud(x,y){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,28,0,Math.PI*2);ctx.arc(x+35,y-8,37,0,Math.PI*2);ctx.arc(x+75,y,25,0,Math.PI*2);ctx.fill();}
function drawSign(x,y,text){ctx.fillStyle='#8b5a41';ctx.fillRect(x-5,y,10,90);ctx.fillStyle='#ff3f78';ctx.beginPath();ctx.roundRect(x-125,y-45,250,58,14);ctx.fill();ctx.fillStyle='#fff';ctx.font='800 14px DM Sans';ctx.textAlign='center';ctx.fillText(text,x,y-10);}
function drawBuilding(x,y,name,color){ctx.fillStyle='#fff8df';ctx.beginPath();ctx.roundRect(x-80,y-45,160,105,16);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-94,y-43);ctx.lineTo(x,y-102);ctx.lineTo(x+94,y-43);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y-63,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff3f78';ctx.font='800 20px DM Sans';ctx.textAlign='center';ctx.fillText('♡',x,y-56);ctx.fillStyle='#5ab8c7';ctx.fillRect(x-22,y+4,44,56);ctx.fillStyle='#fff';ctx.font='700 13px DM Sans';ctx.fillText(name,x,y+82);}
function drawBuild(b){ctx.save();ctx.translate(b.x,b.y);ctx.strokeStyle='#fff';ctx.lineWidth=6;ctx.setLineDash([9,7]);ctx.strokeRect(-58,-44,116,88);ctx.setLineDash([]);ctx.fillStyle='#ffcc3e';ctx.beginPath();ctx.arc(0,-62,22,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='800 20px DM Sans';ctx.textAlign='center';ctx.fillText('♡',0,-55);ctx.fillStyle='#e64977';ctx.font='800 12px DM Sans';ctx.fillText('BUILD +5',0,67);ctx.restore();}
function drawHome(b){ctx.save();ctx.translate(b.x,b.y);ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(-56,-42,112,78,14);ctx.fill();ctx.fillStyle='#ff3f78';ctx.beginPath();ctx.moveTo(-65,-38);ctx.lineTo(0,-85);ctx.lineTo(65,-38);ctx.closePath();ctx.fill();ctx.fillStyle='#ffcc3e';ctx.fillRect(-12,-2,24,38);ctx.fillStyle='#fff';ctx.font='800 17px DM Sans';ctx.textAlign='center';ctx.fillText('♡',0,18);ctx.restore();}
function drawVillager(v){ctx.save();ctx.translate(v.x,v.y);const bob=Math.sin(performance.now()/250+v.x)*2;ctx.translate(0,bob);ctx.lineWidth=5;ctx.strokeStyle='#503c55';let face='#fff',accent='#ff3f78';if(v.kind==='kitty'){face='#fff';accent='#ffcf3d';}if(v.kind==='melody'){face='#fff';accent='#ff91ad';}if(v.kind==='pompom'){face='#f5c84b';accent='#854b2f';}if(v.kind==='keroppi'){face='#83d95d';accent='#eaf8bd';}if(v.kind==='kuromi'){face='#fff';accent='#583d86';}
  // Each face has a bold ink outline and its signature Sanrio silhouette.
  ctx.fillStyle=face;ctx.beginPath();ctx.arc(0,0,31,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=accent;
  if(v.kind==='kitty'){ctx.beginPath();ctx.moveTo(-25,-20);ctx.lineTo(-31,-55);ctx.lineTo(-4,-39);ctx.lineTo(4,-25);ctx.moveTo(25,-20);ctx.lineTo(31,-55);ctx.lineTo(4,-39);ctx.lineTo(-4,-25);ctx.fill();ctx.stroke();ctx.fillStyle='#ffcf3d';ctx.beginPath();ctx.arc(-13,-42,8,0,Math.PI*2);ctx.arc(13,-42,8,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#ff3f78';ctx.beginPath();ctx.ellipse(17,-49,11,6,-.3,0,Math.PI*2);ctx.ellipse(7,-49,11,6,.3,0,Math.PI*2);ctx.fill();ctx.stroke();}
  if(v.kind==='melody'){ctx.beginPath();ctx.moveTo(-20,-20);ctx.lineTo(-28,-67);ctx.lineTo(-4,-54);ctx.lineTo(4,-26);ctx.moveTo(20,-20);ctx.lineTo(28,-67);ctx.lineTo(4,-54);ctx.lineTo(-4,-26);ctx.fill();ctx.stroke();ctx.fillStyle='#ff3f78';ctx.beginPath();ctx.arc(-19,-48,5,0,Math.PI*2);ctx.arc(19,-48,5,0,Math.PI*2);ctx.fill();}
  if(v.kind==='pompom'){ctx.beginPath();ctx.arc(0,-27,29,Math.PI,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff4b5';ctx.beginPath();ctx.arc(0,-53,11,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#854b2f';ctx.fillRect(-22,-31,44,8);}
  if(v.kind==='keroppi'){ctx.fillStyle=accent;ctx.beginPath();ctx.arc(-16,-29,17,0,Math.PI*2);ctx.arc(16,-29,17,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-16,-31,8,0,Math.PI*2);ctx.arc(16,-31,8,0,Math.PI*2);ctx.fill();ctx.stroke();}
  if(v.kind==='kuromi'){ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(-22,-21);ctx.lineTo(-24,-68);ctx.lineTo(-2,-51);ctx.moveTo(22,-21);ctx.lineTo(24,-68);ctx.lineTo(2,-51);ctx.fill();ctx.stroke();ctx.fillStyle='#ffcf3d';ctx.font='800 20px DM Sans';ctx.textAlign='center';ctx.fillText('♣',0,-48);}
  // simple expressive eyes, nose, and whiskers
  ctx.fillStyle='#3b354b';ctx.beginPath();ctx.ellipse(-10,-1,3,6,0,0,Math.PI*2);ctx.ellipse(10,-1,3,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff7c92';ctx.beginPath();ctx.arc(0,8,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#503c55';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-20,8);ctx.lineTo(-34,5);ctx.moveTo(-20,13);ctx.lineTo(-34,16);ctx.moveTo(20,8);ctx.lineTo(34,5);ctx.moveTo(20,13);ctx.lineTo(34,16);ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(43,-53,16,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#ff3f78';ctx.font='800 15px DM Sans';ctx.textAlign='center';ctx.fillText('✦',43,-48);ctx.fillStyle='#503c55';ctx.font='800 12px DM Sans';ctx.fillText(v.name,0,58);ctx.restore();}
function drawPlayer(p){ctx.save();ctx.translate(p.x,p.y);const lift=p.jump?Math.sin((1-p.jump)*Math.PI)*22:0;ctx.fillStyle='#ff5b87';ctx.beginPath();ctx.ellipse(0,29,25,9,0,0,Math.PI*2);ctx.fill();ctx.translate(0,-lift);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,27,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff3f78';ctx.beginPath();ctx.arc(-16,-17,13,0,Math.PI*2);ctx.arc(16,-17,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffcf3d';ctx.beginPath();ctx.arc(0,-1,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#314f5c';ctx.beginPath();ctx.arc(-9,1,3,0,Math.PI*2);ctx.arc(9,1,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='800 11px DM Sans';ctx.textAlign='center';ctx.fillText('YOU',0,49);ctx.restore();}
function loop(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;if(state.started)update(dt);draw();requestAnimationFrame(loop);}
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[e.key]=true;if(!state.started)return;if(e.key===' ')state.player.jump=1;if(e.key.toLowerCase()==='e')interact();});window.addEventListener('keyup',e=>keys[e.key]=false);window.addEventListener('resize',resize);document.getElementById('startButton').onclick=start;document.getElementById('restartButton').onclick=resetGame;resetGame();resize();requestAnimationFrame(loop);
