const SONGS = {
  classical: [
    { title: 'Für Elise', artist: 'Beethoven', bpm: 90, difficulty: 'Easy', seed: 1, measures: 12, scale: [261.63,329.63,392,523.25] },
    { title: 'Canon in D', artist: 'Pachelbel', bpm: 108, difficulty: 'Medium', seed: 3, measures: 14, scale: [311.13,392,466.16,622.25] },
    { title: 'Turkish March', artist: 'Mozart', bpm: 132, difficulty: 'Hard', seed: 8, measures: 16, scale: [293.66,369.99,440,587.33] }
  ],
  kpop: [
    { title: 'Dynamite', artist: 'BTS · piano challenge', bpm: 112, difficulty: 'Easy', seed: 12, measures: 12, scale: [261.63,329.63,392,493.88] },
    { title: 'Gangnam Style', artist: 'PSY · piano challenge', bpm: 124, difficulty: 'Medium', seed: 19, measures: 14, scale: [277.18,349.23,415.3,554.37] },
    { title: 'APT.', artist: 'ROSÉ & Bruno Mars · piano challenge', bpm: 138, difficulty: 'Hard', seed: 27, measures: 16, scale: [293.66,369.99,440,554.37] }
  ]
};

const $ = s => document.querySelector(s);
const screens = [...document.querySelectorAll('.screen')];
const canvas = $('#gameCanvas'), ctx = canvas.getContext('2d');
const keys = ['a','s','k','l'];
let genre = 'classical', selected = SONGS.classical[0], notes = [], raf = 0;
let game = null, audio = null, master = null, scheduled = [];

function showScreen(id){ screens.forEach(s => s.classList.toggle('active', s.id === id)); }
function renderSongs(){
  $('#songList').innerHTML = SONGS[genre].map((s,i) => `<button class="song ${s===selected?'selected':''}" data-i="${i}"><span class="num">0${i+1}</span><span><strong>${s.title}</strong><small>${s.artist} · ${s.bpm} BPM</small></span><span class="diff">${s.difficulty}</span></button>`).join('');
  document.querySelectorAll('.song').forEach(b => b.onclick = () => { selected = SONGS[genre][+b.dataset.i]; renderSongs(); });
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  genre=t.dataset.genre; selected=SONGS[genre][0]; document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t)); renderSongs();
});

function mulberry32(a){ return () => { a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296; }; }
function makeChart(song){
  const rand=mulberry32(song.seed), beat=60/song.bpm, out=[];
  let last=0, idx=0;
  for(let b=0;b<song.measures*4;b++){
    const hard=song.difficulty==='Hard', medium=song.difficulty==='Medium';
    let count=(hard&&rand()>.42)||(medium&&rand()>.7)?2:1;
    if(b<4) count=1;
    for(let sub=0;sub<count;sub++){
      let lane=Math.floor(rand()*4); if(lane===last) lane=(lane+1+Math.floor(rand()*3))%4; last=lane;
      const time=2.2+b*beat+sub*beat/count;
      const note={time,lane,hit:false,miss:false,chord:false,id:idx++};
      out.push(note);
      const chordChance=hard ? .24 : medium ? .12 : 0;
      if(b>=4&&sub===0&&rand()<chordChance){
        let chordLane=(lane+1+Math.floor(rand()*3))%4;
        note.chord=true;
        out.push({time,lane:chordLane,hit:false,miss:false,chord:true,id:idx++});
      }
    }
  }
  return out;
}

function setupAudio(){
  if(!audio) audio=new (window.AudioContext||window.webkitAudioContext)();
  master=audio.createGain(); master.gain.value=.2; master.connect(audio.destination);
}
function tone(freq, when, duration=.22, volume=.24){
  const o=audio.createOscillator(), g=audio.createGain(); o.type='triangle'; o.frequency.value=freq;
  g.gain.setValueAtTime(0.0001,when);g.gain.exponentialRampToValueAtTime(volume,when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+duration);
  o.connect(g);g.connect(master);o.start(when);o.stop(when+duration+.02);scheduled.push(o);
}
function scheduleMusic(){
  const base=audio.currentTime+.08; game.audioBase=base;
  notes.forEach(n=>tone(selected.scale[n.lane],base+n.time,.24,n.id%4===0 ? .34 : .22));
}
function stopAudio(){ scheduled.forEach(o=>{try{o.stop()}catch{}}); scheduled=[]; }

function startGame(){
  cancelAnimationFrame(raf); stopAudio(); setupAudio(); audio.resume(); notes=makeChart(selected);
  game={start:performance.now()+80,pauseAt:0,paused:false,score:0,combo:0,maxCombo:0,perfect:0,good:0,miss:0,end:notes[notes.length-1].time+1.5};
  $('#gameTitle').textContent=`${selected.title} — ${selected.artist}`; updateHUD(); showScreen('game'); resize(); scheduleMusic(); raf=requestAnimationFrame(loop);
}
function currentTime(){return (performance.now()-game.start)/1000}
function resize(){const d=devicePixelRatio||1,r=canvas.getBoundingClientRect();canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0)}
function updateHUD(){ $('#score').textContent=String(game.score).padStart(6,'0');$('#combo').textContent=game.combo; }
function judge(text){const el=$('#judgement');el.className='judgement '+text.toLowerCase();void el.offsetWidth;el.textContent=text.toUpperCase();el.classList.add('show')}
function markMiss(n){n.miss=true;game.miss++;game.combo=0;judge('miss');updateHUD()}
function hit(lane){
  if(!game||game.paused||!$('#game').classList.contains('active'))return;
  const t=currentTime(), candidates=notes.filter(n=>!n.hit&&!n.miss&&n.lane===lane&&Math.abs(n.time-t)<=.22);
  if(!candidates.length){judge('miss');game.combo=0;updateHUD();return}
  const n=candidates.sort((a,b)=>Math.abs(a.time-t)-Math.abs(b.time-t))[0], delta=Math.abs(n.time-t); n.hit=true;
  if(delta<=.08){game.perfect++;game.score+=1000+game.combo*10;judge('perfect')}else{game.good++;game.score+=500+game.combo*5;judge('good')}
  game.combo++;game.maxCombo=Math.max(game.maxCombo,game.combo);updateHUD();
}
function draw(t){
  const w=canvas.clientWidth,h=canvas.clientHeight,laneW=w/4,hitY=h-72,travel=2.15;
  ctx.clearRect(0,0,w,h); const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'rgba(17,17,36,.4)');grad.addColorStop(1,'rgba(29,29,53,.95)');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  for(let i=1;i<4;i++){ctx.strokeStyle='rgba(255,255,255,.07)';ctx.beginPath();ctx.moveTo(i*laneW,0);ctx.lineTo(i*laneW,h);ctx.stroke()}
  ctx.fillStyle='rgba(85,230,220,.12)';ctx.fillRect(0,hitY-5,w,10);ctx.fillStyle='#55e6dc';ctx.fillRect(0,hitY,w,2);
  notes.forEach(n=>{if(n.hit||n.miss)return;const y=hitY-(n.time-t)/travel*(hitY+40);if(y<-40||y>h+30)return;const x=n.lane*laneW+12;ctx.shadowBlur=n.chord?24:18;ctx.shadowColor=n.chord?'#55e6dc':n.lane%2?'#8d78ff':'#ff5fa2';ctx.fillStyle=n.lane%2?'#8d78ff':'#ff5fa2';roundRect(x,y-12,laneW-24,24,7);if(n.chord){ctx.strokeStyle='#bafffa';ctx.lineWidth=2;ctx.stroke()}ctx.shadowBlur=0;});
}
function roundRect(x,y,w,h,r){
  const radius=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.lineTo(x+w-radius,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+radius);
  ctx.lineTo(x+w,y+h-radius);
  ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
  ctx.lineTo(x+radius,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-radius);
  ctx.lineTo(x,y+radius);
  ctx.quadraticCurveTo(x,y,x+radius,y);
  ctx.closePath();
  ctx.fill();
}
function loop(){
  if(!game||game.paused)return;const t=currentTime();notes.forEach(n=>{if(!n.hit&&!n.miss&&t-n.time>.2)markMiss(n)});draw(t);$('#progressFill').style.width=`${Math.min(100,t/game.end*100)}%`;
  if(t>=game.end)finish();else raf=requestAnimationFrame(loop);
}
function finish(){cancelAnimationFrame(raf);stopAudio();const total=notes.length,acc=(game.perfect+game.good*.55)/total;$('#rank').textContent=acc>=.92?'S':acc>=.78?'A':acc>=.62?'B':acc>=.45?'C':'D';$('#resultTitle').textContent=selected.title;$('#resultScore').textContent=String(game.score).padStart(6,'0');$('#perfectCount').textContent=game.perfect;$('#goodCount').textContent=game.good;$('#missCount').textContent=game.miss;$('#maxCombo').textContent=game.maxCombo;showScreen('results')}
function pause(){if(!game||game.paused)return;game.paused=true;game.pauseAt=performance.now();audio.suspend();$('#pauseModal').classList.add('open');$('#pauseModal').setAttribute('aria-hidden','false')}
function resume(){if(!game||!game.paused)return;game.start+=performance.now()-game.pauseAt;game.paused=false;audio.resume();$('#pauseModal').classList.remove('open');$('#pauseModal').setAttribute('aria-hidden','true');raf=requestAnimationFrame(loop)}
function quit(){cancelAnimationFrame(raf);stopAudio();if(audio)audio.resume();game=null;$('#pauseModal').classList.remove('open');showScreen('menu')}

document.addEventListener('keydown',e=>{if(e.repeat)return;const lane=keys.indexOf(e.key.toLowerCase());if(lane>=0){e.preventDefault();const keyEl=document.querySelector(`.key-row [data-lane="${lane}"]`);if(keyEl)keyEl.classList.add('active');hit(lane)}if(e.key==='Escape'){game&&game.paused?resume():pause()}});
document.addEventListener('keyup',e=>{const lane=keys.indexOf(e.key.toLowerCase());if(lane>=0){const keyEl=document.querySelector(`.key-row [data-lane="${lane}"]`);if(keyEl)keyEl.classList.remove('active')}});
document.querySelectorAll('.key-row>div').forEach(el=>{const lane=+el.dataset.lane;el.addEventListener('pointerdown',()=>{el.classList.add('active');hit(lane)});el.addEventListener('pointerup',()=>el.classList.remove('active'))});
$('#playBtn').onclick=startGame;$('#replayBtn').onclick=startGame;$('#songsBtn').onclick=()=>showScreen('menu');$('#pauseBtn').onclick=pause;$('#resumeBtn').onclick=resume;$('#restartBtn').onclick=()=>{$('#pauseModal').classList.remove('open');startGame()};$('#quitBtn').onclick=quit;addEventListener('resize',()=>{if($('#game').classList.contains('active'))resize()});
renderSongs();
