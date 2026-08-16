const app = document.getElementById('app');

const DB_KEY = 'gpl-data-v2';
const AUDIO_KEY = 'gpl-audio-v1';
const FAMILY_KEY = 'gpl-family-v1';
const DEFAULT_DATA = { grandName: 'Boepa', profiles: [], activeProfileId: null, progress: {} };

let data = loadData();
let audioClips = JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}');
let familyPeople = JSON.parse(localStorage.getItem(FAMILY_KEY) || '[]');
let state = { screen: data.profiles.length ? 'home' : 'setup', score: 0, round: 0, challenge: null, feedback: '', game: {}, parentGate: null };

const COLORS = [
  {name:'red', emoji:'🔴'}, {name:'blue', emoji:'🔵'}, {name:'green', emoji:'🟢'}, {name:'yellow', emoji:'🟡'},
  {name:'purple', emoji:'🟣'}, {name:'orange', emoji:'🟠'}
];
const SHAPES = [
  {name:'star', emoji:'⭐'}, {name:'heart', emoji:'❤️'}, {name:'circle', emoji:'⚪'}, {name:'square', emoji:'⬜'}, {name:'diamond', emoji:'🔷'}
];
const ANIMALS = [
  {name:'dog', emoji:'🐶', sound:'woof woof'}, {name:'cat', emoji:'🐱', sound:'meow meow'}, {name:'cow', emoji:'🐮', sound:'moo moo'},
  {name:'duck', emoji:'🦆', sound:'quack quack'}, {name:'pig', emoji:'🐷', sound:'oink oink'}, {name:'sheep', emoji:'🐑', sound:'baa baa'}
];
const NUMBERS = [1,2,3,4,5,6,7,8,9,10].map(n=>({name:String(n), emoji:String(n)}));
const FOODS = [
  {name:'apple', emoji:'🍎'}, {name:'banana', emoji:'🍌'}, {name:'strawberry', emoji:'🍓'}, {name:'grape', emoji:'🍇'}, {name:'orange', emoji:'🍊'}
];
const MEMORY_CARDS = ['🐶','🐱','🐮','🦆','🍎','🍌','🚗','🚜','⭐','❤️','🦖','🚀'];

function loadData(){
  try { return { ...DEFAULT_DATA, ...JSON.parse(localStorage.getItem(DB_KEY) || '{}') }; }
  catch { return structuredClone(DEFAULT_DATA); }
}
function saveData(){ localStorage.setItem(DB_KEY, JSON.stringify(data)); }
function activeProfile(){ return data.profiles.find(p=>p.id===data.activeProfileId) || data.profiles[0] || null; }
function ageBand(){
  const a = Number(activeProfile()?.age || 3);
  if (a < 2.5) return 2;
  if (a < 4) return 3;
  return 4;
}
function pick(arr,n){ return [...arr].sort(()=>Math.random()-.5).slice(0,n); }
function shuffle(arr){ return [...arr].sort(()=>Math.random()-.5); }
function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function speak(text, rate=.84){
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.rate=rate; u.pitch=1.04; speechSynthesis.speak(u);
}
function playClip(name, fallback){
  const src = audioClips[name];
  if (src) { const a = new Audio(src); a.play().catch(()=>fallback && speak(fallback)); }
  else if (fallback) speak(fallback);
}
function progressKey(game){ const p=activeProfile(); return p ? `${p.id}:${game}` : ''; }
function addProgress(game, correct=1, attempts=1){
  const key=progressKey(game); if(!key) return;
  const old=data.progress[key]||{correct:0,attempts:0,plays:0};
  data.progress[key]={...old,correct:old.correct+correct,attempts:old.attempts+attempts,plays:old.plays+0}; saveData();
}
function startPlay(game){
  const key=progressKey(game); if(!key) return;
  const old=data.progress[key]||{correct:0,attempts:0,plays:0}; old.plays++; data.progress[key]=old; saveData();
}
function gameStats(game){ return data.progress[progressKey(game)]||{correct:0,attempts:0,plays:0}; }

function render(){
  if (!data.profiles.length || state.screen==='setup') return renderSetup();
  if (state.screen==='home') return renderHome();
  if (state.screen==='boepa') return renderBoepa();
  if (state.screen==='animals') return renderAnimals();
  if (state.screen==='monster') return renderMonster();
  if (state.screen==='memory') return renderMemory();
  if (state.screen==='family') return renderFamily();
  if (state.screen==='phonics') return renderPhonics();
  if (state.screen==='tracing') return renderTracing();
  if (state.screen==='familySetup') return renderFamilySetup();
  if (state.screen==='profiles') return renderProfiles();
  if (state.screen==='parent') return renderParent();
  if (state.screen==='voice') return renderVoiceStudio();
  state.screen='home'; renderHome();
}

function renderSetup(){
  const existingGrand = data.grandName || 'Boepa';
  app.innerHTML = `<div class="shell narrow">
    <section class="brand"><div class="logo-bubble">🎈</div><h1>Grandad's Play & Learn</h1><p>Learning games made personal for your family.</p></section>
    <section class="card setup-card">
      <h2>${data.profiles.length ? 'Add another child' : 'Let’s get ready to play'}</h2>
      <div class="setup-grid">
        <div><label>What do the children call you?</label><input id="grandName" maxlength="30" value="${esc(existingGrand)}" /></div>
        <div><label>Child's first name</label><input id="childName" maxlength="24" placeholder="e.g. Charlie" autocomplete="off" /></div>
        <div><label>Child's age</label><select id="age"><option value="1.5">1½</option><option value="2">2</option><option value="2.5">2½</option><option value="3" selected>3</option><option value="3.5">3½</option><option value="4">4</option><option value="4.5">4½</option><option value="5">5</option></select></div>
        <button class="primary big" id="start">${data.profiles.length ? 'Add child' : 'Start playing'} ✨</button>
        ${data.profiles.length ? '<button class="secondary" id="cancel">Cancel</button>' : ''}
      </div>
    </section>
  </div>`;
  document.getElementById('start').onclick=()=>{
    const grandName=document.getElementById('grandName').value.trim()||'Grandad';
    const childName=document.getElementById('childName').value.trim()||'Little one';
    const age=document.getElementById('age').value;
    const p={id:`p-${Date.now()}`,name:childName,age,avatar:['🦁','🐼','🦄','🦖','🐯','🐸'][data.profiles.length%6]};
    data.grandName=grandName; data.profiles.push(p); data.activeProfileId=p.id; saveData(); state.screen='home'; render();
  };
  if(document.getElementById('cancel')) document.getElementById('cancel').onclick=()=>{state.screen='profiles';render();};
}

function renderHome(){
  const p=activeProfile(); if(!p){state.screen='setup';return render();}
  app.innerHTML=`<div class="shell">
    <div class="topbar">
      <button class="profile-pill" id="profiles"><span>${p.avatar}</span><span><small>Playing as</small>${esc(p.name)}</span><b>⌄</b></button>
      <button class="parent-btn" id="parent">⚙️ Grown-ups</button>
    </div>
    <section class="hero"><div class="sun">☀️</div><h2>Play & Learn with ${esc(data.grandName)}</h2><p>What shall we play, ${esc(p.name)}?</p></section>
    <section class="home-grid">
      ${gameTile('boepa','🎯',`${esc(data.grandName)} Says`,'Colours, shapes, animals & numbers','peach')}
      ${gameTile('animals','🐮','Animal Sounds','Listen carefully and find the animal','mint')}
      ${gameTile('monster','👾','Feed the Monster','Counting with a very hungry friend','lilac')}
      ${gameTile('memory','🧠','Match & Remember','Turn the cards and find the pairs','sky')}
      ${gameTile('family','👨‍👩‍👧‍👦','Our Family','Learn familiar faces and names','mint')}
      ${gameTile('phonics','🔤','Letters & Phonics','Letters, sounds and first words','peach')}
      ${gameTile('tracing','✏️','Tracing','Trace letters with your finger','lilac')}
    </section>
    <footer class="tiny-footer">No adverts • No outside links • Progress stays on this device</footer>
  </div>`;
  document.getElementById('profiles').onclick=()=>{state.screen='profiles';render();};
  document.getElementById('parent').onclick=()=>openParentGate();
  ['boepa','animals','monster','memory','family','phonics','tracing'].forEach(g=>document.getElementById(`game-${g}`).onclick=()=>startGame(g));
}
function gameTile(id,emoji,title,sub,cls){ const st=gameStats(id); return `<button class="game-tile ${cls}" id="game-${id}"><span class="emoji">${emoji}</span><span>${title}</span><small>${sub}</small>${st.plays?`<em>Played ${st.plays}×</em>`:''}</button>`; }
function startGame(g){ speechSynthesis?.cancel?.(); state.score=0; state.round=0; state.feedback=''; state.game={}; startPlay(g); state.screen=g; if(g==='boepa') newBoepaChallenge(); else if(g==='animals') newAnimalRound(); else if(g==='monster') newMonsterRound(); else if(g==='memory') newMemoryGame(); else if(g==='family') newFamilyRound(); else if(g==='phonics') newPhonicsRound(); else if(g==='tracing') newTracingRound(); }
function gameTop(title){ return `<div class="topbar"><button class="secondary" id="home">← Home</button><span class="game-title">${title}</span><span class="pill">⭐ ${state.score}</span></div>`; }
function bindHome(){ document.getElementById('home').onclick=()=>{speechSynthesis?.cancel?.();state.screen='home';render();}; }

function newBoepaChallenge(){
  const band=ageBand(); const banks=band===2?[COLORS,ANIMALS]:band===3?[COLORS,ANIMALS,SHAPES]:[COLORS,ANIMALS,SHAPES,NUMBERS];
  const category=banks[Math.floor(Math.random()*banks.length)]; const count=band===2?2:band===3?3:4;
  const options=pick(category,count); const target=options[Math.floor(Math.random()*options.length)];
  state.challenge={options,target}; state.round++; state.feedback=''; renderBoepa(); setTimeout(()=>speak(`${data.grandName} says, can you find the ${target.name}?`),200);
}
function renderBoepa(){
  const p=activeProfile(), c=state.challenge; if(!c) return newBoepaChallenge();
  app.innerHTML=`<div class="shell">${gameTop(`${esc(data.grandName)} Says`)}
    <section class="challenge"><div class="prompt-icon">🎤</div><h2>${esc(data.grandName)} says...</h2><p>Can you find the <strong>${esc(c.target.name).toUpperCase()}</strong>?</p><button class="secondary" id="hear">🔊 Say it again</button></section>
    <section class="options">${c.options.map((o,i)=>`<button class="option" data-i="${i}" aria-label="${esc(o.name)}">${o.emoji}</button>`).join('')}</section>
    <div class="feedback">${state.feedback}</div><div class="round">Round ${state.round}</div>
  </div>`;
  bindHome(); document.getElementById('hear').onclick=()=>speak(`${data.grandName} says, can you find the ${c.target.name}?`);
  document.querySelectorAll('.option').forEach(btn=>btn.onclick=()=>{
    const chosen=c.options[Number(btn.dataset.i)];
    if(chosen.name===c.target.name){ state.score++; addProgress('boepa',1,1); state.feedback=`🎉 Brilliant, ${esc(p.name)}!`; playClip('praise',`Brilliant, ${p.name}!`); renderBoepa(); setTimeout(newBoepaChallenge,850); }
    else { addProgress('boepa',0,1); state.feedback='Nearly! Have another go 😊'; playClip('tryAgain','Nearly. Have another go.'); renderBoepa(); }
  });
}

function newAnimalRound(){
  const count=ageBand()===2?2:ageBand()===3?3:4; const options=pick(ANIMALS,count); const target=options[Math.floor(Math.random()*options.length)];
  state.challenge={options,target}; state.round++; state.feedback=''; renderAnimals(); setTimeout(()=>speak(target.sound,.72),250);
}
function renderAnimals(){
  const p=activeProfile(), c=state.challenge; if(!c) return newAnimalRound();
  app.innerHTML=`<div class="shell">${gameTop('Animal Sounds')}
    <section class="challenge animal-challenge"><div class="prompt-icon">👂</div><h2>Who makes this sound?</h2><button class="sound-button" id="hear">🔊 Hear the sound</button></section>
    <section class="options">${c.options.map((o,i)=>`<button class="option animal-option" data-i="${i}" aria-label="${o.name}"><span>${o.emoji}</span><small>${ageBand()>3?esc(o.name):''}</small></button>`).join('')}</section>
    <div class="feedback">${state.feedback}</div><div class="round">Round ${state.round}</div>
  </div>`;
  bindHome(); document.getElementById('hear').onclick=()=>speak(c.target.sound,.72);
  document.querySelectorAll('.animal-option').forEach(btn=>btn.onclick=()=>{
    const chosen=c.options[Number(btn.dataset.i)];
    if(chosen.name===c.target.name){ state.score++; addProgress('animals',1,1); state.feedback=`🎉 Yes! It's the ${c.target.name}!`; playClip('praise',`Well done, ${p.name}!`); renderAnimals(); setTimeout(newAnimalRound,900); }
    else { addProgress('animals',0,1); state.feedback='Listen again 👂'; playClip('tryAgain','Listen again.'); renderAnimals(); setTimeout(()=>speak(c.target.sound,.72),300); }
  });
}

function newMonsterRound(){
  const max=ageBand()===2?3:ageBand()===3?5:8; const targetCount=1+Math.floor(Math.random()*max); const food=FOODS[Math.floor(Math.random()*FOODS.length)];
  state.game={targetCount,food,fed:0,done:false}; state.round++; state.feedback=''; renderMonster(); setTimeout(()=>speak(`Feed the monster ${targetCount} ${food.name}${targetCount>1?'s':''}.`),250);
}
function renderMonster(){
  const p=activeProfile(), g=state.game; if(!g.targetCount) return newMonsterRound();
  const remaining=Math.max(0,g.targetCount-g.fed);
  app.innerHTML=`<div class="shell">${gameTop('Feed the Monster')}
    <section class="challenge monster-prompt"><h2>Feed me ${g.targetCount} ${g.food.name}${g.targetCount>1?'s':''}!</h2><p>Tap the food to feed the monster.</p></section>
    <section class="monster-zone"><div class="monster ${g.done?'happy':''}">${g.done?'😋':'👾'}<div class="monster-mouth">${g.done?'YUM!':`${g.fed} / ${g.targetCount}`}</div></div>
      <button class="food-button" id="food" ${g.done?'disabled':''}>${g.food.emoji}</button></section>
    <div class="count-dots">${Array.from({length:g.targetCount},(_,i)=>`<span class="${i<g.fed?'filled':''}">${i<g.fed?'●':'○'}</span>`).join('')}</div>
    <div class="feedback">${state.feedback || (remaining ? `${remaining} more to go!` : '')}</div>
    <button class="secondary hear-inline" id="hear">🔊 Say it again</button>
  </div>`;
  bindHome(); document.getElementById('hear').onclick=()=>speak(`Feed the monster ${g.targetCount} ${g.food.name}${g.targetCount>1?'s':''}.`);
  const foodBtn=document.getElementById('food'); if(foodBtn) foodBtn.onclick=()=>{
    if(g.done) return; g.fed++; if(g.fed===g.targetCount){g.done=true;state.score++;addProgress('monster',1,1);state.feedback=`🎉 Perfect counting, ${esc(p.name)}!`;playClip('praise',`Perfect counting, ${p.name}!`);renderMonster();setTimeout(newMonsterRound,1100);} else {renderMonster();}
  };
}

function newMemoryGame(){
  const pairs=ageBand()===2?2:ageBand()===3?3:4; const selected=pick(MEMORY_CARDS,pairs); const deck=shuffle([...selected,...selected]).map((emoji,i)=>({id:i,emoji,open:false,matched:false}));
  state.game={deck,first:null,locked:false,matches:0,pairs}; state.score=0; renderMemory();
}
function renderMemory(){
  const g=state.game; if(!g.deck) return newMemoryGame();
  app.innerHTML=`<div class="shell">${gameTop('Match & Remember')}
    <section class="challenge compact"><h2>Find the matching pairs</h2><p>Remember what's hiding under the cards.</p></section>
    <section class="memory-grid pairs-${g.pairs}">${g.deck.map((c,i)=>`<button class="memory-card ${c.open||c.matched?'open':''} ${c.matched?'matched':''}" data-i="${i}" ${c.matched?'disabled':''}>${c.open||c.matched?c.emoji:'❓'}</button>`).join('')}</section>
    <div class="feedback">${state.feedback}</div>
    <div class="footer-actions"><button class="secondary" id="restart">↻ New cards</button></div>
  </div>`;
  bindHome(); document.getElementById('restart').onclick=newMemoryGame;
  document.querySelectorAll('.memory-card').forEach(btn=>btn.onclick=()=>flipMemory(Number(btn.dataset.i)));
}
function flipMemory(i){
  const g=state.game,c=g.deck[i]; if(g.locked||c.open||c.matched) return; c.open=true;
  if(g.first===null){ g.first=i; state.feedback=''; renderMemory(); return; }
  const first=g.deck[g.first]; renderMemory();
  if(first.emoji===c.emoji){ first.matched=c.matched=true; g.matches++; g.first=null; state.score++; addProgress('memory',1,1); state.feedback='🎉 A match!'; playClip('praise','A match!'); if(g.matches===g.pairs){state.feedback=`🏆 You found them all, ${esc(activeProfile().name)}!`;setTimeout(()=>playClip('praise',`You found them all!`),150);} renderMemory(); }
  else { addProgress('memory',0,1); g.locked=true; state.feedback='Remember where they are!'; setTimeout(()=>{first.open=false;c.open=false;g.first=null;g.locked=false;state.feedback='';renderMemory();},900); }
}

function renderProfiles(){
  app.innerHTML=`<div class="shell narrow"><div class="topbar"><button class="secondary" id="back">← Back</button><span class="game-title">Who's playing?</span><span></span></div>
    <section class="profile-grid">${data.profiles.map(p=>`<button class="child-card ${p.id===data.activeProfileId?'active':''}" data-id="${p.id}"><span>${p.avatar}</span><b>${esc(p.name)}</b><small>Age ${p.age}</small></button>`).join('')}<button class="child-card add" id="add"><span>➕</span><b>Add child</b></button></section>
  </div>`;
  document.getElementById('back').onclick=()=>{state.screen='home';render();}; document.getElementById('add').onclick=()=>{state.screen='setup';render();};
  document.querySelectorAll('.child-card[data-id]').forEach(b=>b.onclick=()=>{data.activeProfileId=b.dataset.id;saveData();state.screen='home';render();});
}
function openParentGate(){
  const a=4+Math.floor(Math.random()*6), b=3+Math.floor(Math.random()*7); state.parentGate={a,b,answer:a+b};
  app.innerHTML=`<div class="shell narrow"><section class="card gate"><div class="prompt-icon">🔒</div><h2>Grown-ups only</h2><p>What is <strong>${a} + ${b}</strong>?</p><input id="gateAnswer" inputmode="numeric" pattern="[0-9]*" placeholder="Answer" /><button class="primary" id="unlock">Unlock</button><button class="secondary" id="cancel">Cancel</button><div id="gateMsg"></div></section></div>`;
  document.getElementById('cancel').onclick=()=>{state.screen='home';render();}; document.getElementById('unlock').onclick=()=>{if(Number(document.getElementById('gateAnswer').value)===state.parentGate.answer){state.screen='parent';render();}else document.getElementById('gateMsg').textContent='Not quite — try again.';};
}
function renderParent(){
  const p=activeProfile();
  app.innerHTML=`<div class="shell"><div class="topbar"><button class="secondary" id="home">← Home</button><span class="game-title">Grown-ups</span><span></span></div>
    <section class="parent-grid">
      <div class="card"><h2>Family setup</h2><label>Grandparent name</label><input id="grandNameEdit" value="${esc(data.grandName)}" /><button class="primary small" id="saveGrand">Save name</button><button class="secondary wide" id="profiles">Manage children</button></div>
      <div class="card"><h2>${esc(p.name)}'s progress</h2>${['boepa','animals','monster','memory','family','phonics','tracing'].map(g=>statsRow(g)).join('')}</div>
      <div class="card"><h2>Our Family</h2><p>Add familiar people using a name, relationship and photo. Photos stay on this device.</p><button class="primary small" id="familySetup">👨‍👩‍👧‍👦 Manage family photos</button></div>
      <div class="card"><h2>${esc(data.grandName)}'s voice</h2><p>Record your own praise and “try again” messages. These replace the computer voice when available.</p><button class="primary small" id="voice">🎙️ Voice studio</button></div>
      <div class="card"><h2>Reset</h2><p>Progress and recordings stay only on this device.</p><button class="danger" id="resetProgress">Reset ${esc(p.name)}'s progress</button></div>
    </section>
  </div>`;
  bindHome(); document.getElementById('profiles').onclick=()=>{state.screen='profiles';render();}; document.getElementById('voice').onclick=()=>{state.screen='voice';render();}; document.getElementById('familySetup').onclick=()=>{state.screen='familySetup';render();};
  document.getElementById('saveGrand').onclick=()=>{data.grandName=document.getElementById('grandNameEdit').value.trim()||'Grandad';saveData();renderParent();};
  document.getElementById('resetProgress').onclick=()=>{Object.keys(data.progress).filter(k=>k.startsWith(`${p.id}:`)).forEach(k=>delete data.progress[k]);saveData();renderParent();};
}
function statsRow(g){ const labels={boepa:`${data.grandName} Says`,animals:'Animal Sounds',monster:'Feed the Monster',memory:'Match & Remember',family:'Our Family',phonics:'Letters & Phonics',tracing:'Tracing'}; const s=gameStats(g); const pct=s.attempts?Math.round(s.correct/s.attempts*100):0; return `<div class="stat-row"><span><b>${labels[g]}</b><small>${s.plays} play${s.plays===1?'':'s'}</small></span><strong>${s.attempts?pct+'%':'—'}</strong></div>`; }

function renderVoiceStudio(){
  app.innerHTML=`<div class="shell narrow"><div class="topbar"><button class="secondary" id="back">← Grown-ups</button><span class="game-title">Voice studio</span><span></span></div>
    <section class="card voice-card"><div class="prompt-icon">🎙️</div><h2>Make it sound like ${esc(data.grandName)}</h2><p>Record two short messages. Safari will ask for microphone permission.</p>
      ${voiceRow('praise','Praise message',`Try: “Brilliant! Well done!”`)}
      ${voiceRow('tryAgain','Try-again message',`Try: “Nearly! Have another go.”`)}
      <p class="privacy-note">Recordings are stored in this browser on this device and are not uploaded anywhere.</p>
    </section></div>`;
  document.getElementById('back').onclick=()=>{state.screen='parent';render();};
  document.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>recordClip(b.dataset.record,b));
  document.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>playClip(b.dataset.play,''));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{delete audioClips[b.dataset.delete];localStorage.setItem(AUDIO_KEY,JSON.stringify(audioClips));renderVoiceStudio();});
}
function voiceRow(key,title,hint){ const has=!!audioClips[key]; return `<div class="voice-row"><div><b>${title}</b><small>${hint}</small></div><div class="voice-actions"><button class="primary small" data-record="${key}">${has?'🎙️ Re-record':'🎙️ Record'}</button>${has?`<button class="secondary" data-play="${key}">▶️ Play</button><button class="secondary" data-delete="${key}">🗑️</button>`:''}</div></div>`; }
async function recordClip(key,button){
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){ alert('Voice recording is not supported in this browser.'); return; }
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const chunks=[]; const rec=new MediaRecorder(stream); rec.ondataavailable=e=>chunks.push(e.data);
    rec.onstop=()=>{ const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'}); const reader=new FileReader(); reader.onload=()=>{audioClips[key]=reader.result; try{localStorage.setItem(AUDIO_KEY,JSON.stringify(audioClips));}catch{alert('The recording was too large to save. Try a shorter message.');} stream.getTracks().forEach(t=>t.stop());renderVoiceStudio();}; reader.readAsDataURL(blob); };
    rec.start(); button.textContent='⏹️ Stop recording'; button.onclick=()=>rec.stop();
  }catch(err){ alert('Microphone permission is needed to record your voice.'); }
}


const PHONICS = [
 {letter:'A',sound:'a',word:'apple',emoji:'🍎'}, {letter:'B',sound:'b',word:'ball',emoji:'⚽'}, {letter:'C',sound:'c',word:'cat',emoji:'🐱'},
 {letter:'D',sound:'d',word:'dog',emoji:'🐶'}, {letter:'E',sound:'e',word:'egg',emoji:'🥚'}, {letter:'F',sound:'f',word:'fish',emoji:'🐟'},
 {letter:'G',sound:'g',word:'goat',emoji:'🐐'}, {letter:'H',sound:'h',word:'hat',emoji:'🎩'}, {letter:'I',sound:'i',word:'igloo',emoji:'🧊'},
 {letter:'J',sound:'j',word:'juice',emoji:'🧃'}, {letter:'K',sound:'k',word:'kite',emoji:'🪁'}, {letter:'L',sound:'l',word:'lion',emoji:'🦁'},
 {letter:'M',sound:'m',word:'moon',emoji:'🌙'}, {letter:'N',sound:'n',word:'nose',emoji:'👃'}, {letter:'O',sound:'o',word:'orange',emoji:'🍊'},
 {letter:'P',sound:'p',word:'pig',emoji:'🐷'}, {letter:'Q',sound:'qu',word:'queen',emoji:'👑'}, {letter:'R',sound:'r',word:'rocket',emoji:'🚀'},
 {letter:'S',sound:'s',word:'sun',emoji:'☀️'}, {letter:'T',sound:'t',word:'tiger',emoji:'🐯'}, {letter:'U',sound:'u',word:'umbrella',emoji:'☂️'},
 {letter:'V',sound:'v',word:'van',emoji:'🚐'}, {letter:'W',sound:'w',word:'whale',emoji:'🐋'}, {letter:'X',sound:'x',word:'xylophone',emoji:'🎼'},
 {letter:'Y',sound:'y',word:'yarn',emoji:'🧶'}, {letter:'Z',sound:'z',word:'zebra',emoji:'🦓'}
];

function newPhonicsRound(){
 const count=ageBand()===2?2:ageBand()===3?3:4, options=pick(PHONICS,count), target=options[Math.floor(Math.random()*options.length)];
 state.game={options,target}; state.round++; state.feedback=''; renderPhonics(); setTimeout(()=>speak(`Can you find the letter ${target.letter}? ${target.letter} is for ${target.word}.`),200);
}
function renderPhonics(){
 const g=state.game,p=activeProfile(); if(!g.target) return newPhonicsRound();
 app.innerHTML=`<div class="shell">${gameTop('Letters & Phonics')}<section class="challenge"><div class="prompt-icon">🔤</div><h2>Find the letter <strong>${g.target.letter}</strong></h2><p>${g.target.letter} is for ${g.target.emoji} ${g.target.word}</p><button class="secondary" id="hear">🔊 Hear it</button></section><section class="options">${g.options.map((o,i)=>`<button class="option letter-option" data-i="${i}">${o.letter}</button>`).join('')}</section><div class="feedback">${state.feedback}</div></div>`;
 bindHome(); document.getElementById('hear').onclick=()=>speak(`${g.target.letter}. ${g.target.letter} is for ${g.target.word}.`);
 document.querySelectorAll('.letter-option').forEach(b=>b.onclick=()=>{let o=g.options[+b.dataset.i]; if(o.letter===g.target.letter){state.score++;addProgress('phonics',1,1);state.feedback=`🎉 ${g.target.letter} is for ${g.target.word}!`;playClip('praise',`Brilliant, ${p.name}!`);renderPhonics();setTimeout(newPhonicsRound,1000)}else{addProgress('phonics',0,1);state.feedback='Good try — have another go 😊';renderPhonics();}})
}

function newTracingRound(){ state.game={item:PHONICS[Math.floor(Math.random()*PHONICS.length)],strokes:0}; state.round++; state.feedback=''; renderTracing(); setTimeout(()=>speak(`Trace the letter ${state.game.item.letter} with your finger.`),200); }
function renderTracing(){
 const g=state.game; if(!g.item)return newTracingRound();
 app.innerHTML=`<div class="shell">${gameTop('Tracing')}<section class="challenge compact"><h2>Trace the letter ${g.item.letter}</h2><p>${g.item.emoji} ${g.item.letter} is for ${g.item.word}</p></section><div class="trace-wrap"><canvas id="traceCanvas" width="700" height="520"></canvas><div class="trace-guide">${g.item.letter}</div></div><div class="feedback">${state.feedback}</div><div class="footer-actions"><button class="secondary" id="clearTrace">↻ Clear</button><button class="primary" id="traceDone">✓ I did it!</button></div></div>`;
 bindHome(); const canvas=document.getElementById('traceCanvas'),ctx=canvas.getContext('2d'); ctx.lineWidth=22;ctx.lineCap='round';ctx.lineJoin='round';let drawing=false;
 function pos(e){const r=canvas.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)*canvas.width/r.width,y:(t.clientY-r.top)*canvas.height/r.height}}
 function start(e){e.preventDefault();drawing=true;let p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)} function move(e){if(!drawing)return;e.preventDefault();let p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();g.strokes++} function end(){drawing=false}
 canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointerleave',end);
 document.getElementById('clearTrace').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);g.strokes=0;state.feedback=''};
 document.getElementById('traceDone').onclick=()=>{if(g.strokes<4){state.feedback='Draw over the big letter first 😊';renderTracing();return}state.score++;addProgress('tracing',1,1);playClip('praise',`Lovely tracing, ${activeProfile().name}!`);state.feedback='🌟 Lovely tracing!';renderTracing();setTimeout(newTracingRound,1100)};
}

function saveFamily(){ localStorage.setItem(FAMILY_KEY,JSON.stringify(familyPeople)); }
function renderFamilySetup(){
 app.innerHTML=`<div class="shell"><div class="topbar"><button class="secondary" id="back">← Grown-ups</button><span class="game-title">Our Family setup</span><span></span></div><section class="card"><h2>Add familiar faces</h2><div class="setup-grid"><div><label>Name</label><input id="famName" placeholder="e.g. Boepa"></div><div><label>Who are they?</label><input id="famRole" placeholder="e.g. Boepa, Mummy, Auntie"></div><div><label>Photo</label><input id="famPhoto" type="file" accept="image/*"></div><button class="primary" id="addFamily">Add person</button></div></section><section class="profile-grid family-list">${familyPeople.map((x,i)=>`<div class="child-card"><span class="family-thumb">${x.photo?`<img src="${x.photo}" alt="">`:'👤'}</span><b>${esc(x.name)}</b><small>${esc(x.role)}</small><button class="secondary fam-delete" data-i="${i}">Remove</button></div>`).join('')}</section></div>`;
 document.getElementById('back').onclick=()=>{state.screen='parent';render()}; document.querySelectorAll('.fam-delete').forEach(b=>b.onclick=()=>{familyPeople.splice(+b.dataset.i,1);saveFamily();renderFamilySetup()});
 document.getElementById('addFamily').onclick=()=>{let name=document.getElementById('famName').value.trim(),role=document.getElementById('famRole').value.trim(),file=document.getElementById('famPhoto').files[0];if(!name)return alert('Please add a name.');let finish=photo=>{familyPeople.push({name,role:role||name,photo});try{saveFamily()}catch(e){alert('That photo is too large. Try a smaller photo.');familyPeople.pop();return}renderFamilySetup()};if(file){let rd=new FileReader();rd.onload=()=>finish(rd.result);rd.readAsDataURL(file)}else finish('')};
}
function newFamilyRound(){
 if(familyPeople.length<2){state.game={needsSetup:true};return renderFamily()};let count=Math.min(familyPeople.length,ageBand()===2?2:ageBand()===3?3:4),options=pick(familyPeople,count),target=options[Math.floor(Math.random()*options.length)];state.game={options,target};state.round++;state.feedback='';renderFamily();setTimeout(()=>speak(`Can you find ${target.role||target.name}?`),200)
}
function renderFamily(){
 const g=state.game;if(g.needsSetup||familyPeople.length<2){app.innerHTML=`<div class="shell narrow">${gameTop('Our Family')}<section class="card gate"><div class="prompt-icon">👨‍👩‍👧‍👦</div><h2>Our Family needs two photos</h2><p>Ask a grown-up to add family members in the Grown-ups area first.</p></section></div>`;bindHome();return}
 if(!g.target)return newFamilyRound();app.innerHTML=`<div class="shell">${gameTop('Our Family')}<section class="challenge"><h2>Can you find ${esc(g.target.role||g.target.name)}?</h2><button class="secondary" id="hear">🔊 Say it again</button></section><section class="family-options">${g.options.map((x,i)=>`<button class="family-choice" data-i="${i}">${x.photo?`<img src="${x.photo}" alt="${esc(x.name)}">`:'<span class="big-person">👤</span>'}<b>${esc(x.name)}</b></button>`).join('')}</section><div class="feedback">${state.feedback}</div></div>`;bindHome();document.getElementById('hear').onclick=()=>speak(`Can you find ${g.target.role||g.target.name}?`);document.querySelectorAll('.family-choice').forEach(b=>b.onclick=()=>{let x=g.options[+b.dataset.i];if(x.name===g.target.name){state.score++;addProgress('family',1,1);state.feedback=`💛 That's ${esc(x.name)}!`;playClip('praise',`That's right, ${activeProfile().name}!`);renderFamily();setTimeout(newFamilyRound,1000)}else{addProgress('family',0,1);state.feedback='Nearly — try another face 😊';renderFamily()}})
}

render();
