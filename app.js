/* Grandad's Play & Learn — v5
   Same games and data as v4.2, rebuilt so it feels smooth:
   - taps update the DOM in place instead of rebuilding the whole screen
   - audio is unlocked on first touch (iPad) and can never deadlock
   - sound effects + correct/wrong animations on every answer
   - rounds end in a "well done" screen instead of going on forever
*/
const app = document.getElementById('app');

const DB_KEY     = 'gpl-data-v2';     // unchanged — v4.2 profiles/progress carry over
const AUDIO_KEY  = 'gpl-audio-v1';
const FAMILY_KEY = 'gpl-family-v1';
const PREFS_KEY  = 'gpl-prefs-v1';
const DEFAULT_DATA  = { grandName:'Boepa', grandPhoto:'', profiles:[], activeProfileId:null, progress:{} };
const DEFAULT_PREFS = { soundOn:true, voiceURI:'', roundTarget:5 };

let data        = loadJSON(DB_KEY, DEFAULT_DATA);
let prefs       = loadJSON(PREFS_KEY, DEFAULT_PREFS);
let audioClips  = loadJSON(AUDIO_KEY, {});
let familyPeople= loadJSON(FAMILY_KEY, []);
let state = { screen: data.profiles.length ? 'home' : 'setup', score:0, round:0, wrong:0, locked:false, challenge:null, feedback:'', game:{} };

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
const COUNT_WORDS = ['','one','two','three','four','five','six','seven','eight','nine','ten'];
const GAME_LABELS = {boepa:'Says', animals:'Animal Sounds', monster:'Feed the Monster', memory:'Match & Remember', family:'Our Family', phonics:'Letters & Phonics', tracing:'Tracing'};

/* ---------------------------------------------------------------- storage */
function loadJSON(key, fallback){
  try { const raw = JSON.parse(localStorage.getItem(key) || 'null'); if(raw===null) return structuredClone(fallback);
        return Array.isArray(fallback) ? raw : {...structuredClone(fallback), ...raw}; }
  catch { return structuredClone(fallback); }
}
function saveJSON(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
const saveData  = ()=>saveJSON(DB_KEY, data);
const savePrefs = ()=>saveJSON(PREFS_KEY, prefs);
const saveFamily= ()=>saveJSON(FAMILY_KEY, familyPeople);
const saveClips = ()=>saveJSON(AUDIO_KEY, audioClips);

function activeProfile(){ return data.profiles.find(p=>p.id===data.activeProfileId) || data.profiles[0] || null; }
function ageBand(){ const a = Number(activeProfile()?.age || 3); return a < 2.5 ? 2 : a < 4 ? 3 : 4; }
function optionCount(){ return ageBand()===2 ? 2 : ageBand()===3 ? 3 : 4; }
function progressKey(game){ const p=activeProfile(); return p ? `${p.id}:${game}` : ''; }
function gameStats(game){ return data.progress[progressKey(game)] || {correct:0, attempts:0, plays:0}; }
function addProgress(game, correct=1, attempts=1){
  const key=progressKey(game); if(!key) return;
  const old = data.progress[key] || {correct:0, attempts:0, plays:0};
  data.progress[key] = {...old, correct:old.correct+correct, attempts:old.attempts+attempts};
  saveData();
}
function startPlay(game){
  const key=progressKey(game); if(!key) return;
  const old = data.progress[key] || {correct:0, attempts:0, plays:0};
  old.plays++; data.progress[key]=old; saveData();
}
function totalStars(){
  const p=activeProfile(); if(!p) return 0;
  return Object.entries(data.progress)
    .filter(([k])=>k.startsWith(p.id+':'))
    .reduce((sum,[,v])=>sum+(v.correct||0), 0);
}

/* ------------------------------------------------------------- small utils */
function pick(arr,n){ return shuffle(arr).slice(0,n); }
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function randOf(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function esc(s=''){ return String(s).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
/** "1 strawberry" / "4 strawberries" — v4 said "4 strawberrys". */
function plural(word, n){
  if(n === 1) return word;
  if(/[^aeiou]y$/.test(word)) return word.slice(0,-1) + 'ies';
  if(/(?:s|x|z|ch|sh)$/.test(word)) return word + 'es';
  return word + 's';
}
const $  = (sel, root=document)=>root.querySelector(sel);
const $$ = (sel, root=document)=>[...root.querySelectorAll(sel)];

/* ------------------------------------------------------------------- audio
   Two independent paths so they never block each other:
   - sfx()   : instant Web Audio blips (tap / correct / wrong / fanfare)
   - speak() : queued speech, with a hard timeout so a stalled utterance
               can never freeze every later prompt (the v4 deadlock bug)  */
const Sound = { ctx:null, unlocked:false, queue:Promise.resolve(), voices:[] };

function unlockAudio(){
  if(Sound.unlocked) return;
  Sound.unlocked = true;
  try {
    Sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if(Sound.ctx.state === 'suspended') Sound.ctx.resume();
  } catch {}
  // iOS/iPadOS only allows speech after a real user gesture — prime it here.
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {}
}
document.addEventListener('pointerdown', unlockAudio, {capture:true});
document.addEventListener('touchstart',  unlockAudio, {capture:true});

function refreshVoices(){
  if(!('speechSynthesis' in window)) return;
  Sound.voices = window.speechSynthesis.getVoices() || [];
}
refreshVoices();
if('speechSynthesis' in window) window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);

// Warmest-sounding English voice we can find, unless a grown-up picked one.
const NICE_VOICES = /serena|kate|sonia|libby|hazel|fiona|martha|amelie|stephanie|google uk english female|female/i;
function chosenVoice(){
  const v = Sound.voices;
  if(!v.length) return null;
  if(prefs.voiceURI){ const saved = v.find(x=>x.voiceURI === prefs.voiceURI); if(saved) return saved; }
  const gb = v.filter(x=>/en[-_]GB/i.test(x.lang));
  return gb.find(x=>NICE_VOICES.test(x.name)) || gb[0]
      || v.filter(x=>/^en/i.test(x.lang)).find(x=>NICE_VOICES.test(x.name))
      || v.find(x=>/^en/i.test(x.lang)) || null;
}

function enqueue(makePromise, timeoutMs=12000){
  Sound.queue = Sound.queue
    .catch(()=>{})
    .then(()=>Promise.race([
      Promise.resolve().then(makePromise),
      new Promise(res=>setTimeout(res, timeoutMs))   // guard: never hang the queue
    ]))
    .catch(()=>{});
  return Sound.queue;
}

function utter(text, rate=0.9, pitch=1.05){
  return new Promise(resolve=>{
    if(!('speechSynthesis' in window) || !prefs.soundOn){ resolve(); return; }
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = rate; u.pitch = pitch; u.volume = 1;
    const v = chosenVoice(); if(v){ u.voice = v; u.lang = v.lang; }
    let done=false;
    const finish = ()=>{ if(done) return; done=true; setTimeout(resolve, 180); };
    u.onend = finish; u.onerror = finish;
    try { window.speechSynthesis.speak(u); } catch { finish(); }
  });
}

function speak(text, {rate=0.9, pitch=1.05}={}){
  if(!prefs.soundOn || !text) return Promise.resolve();
  return enqueue(()=>utter(text, rate, pitch));
}
/** Say something right now, cutting off anything in progress (counting aloud). */
function sayNow(text, rate=1){
  if(!prefs.soundOn || !('speechSynthesis' in window)) return;
  try { window.speechSynthesis.cancel(); } catch {}
  Sound.queue = Promise.resolve();
  utter(text, rate);
}
function stopSpeech(){
  try { window.speechSynthesis?.cancel?.(); } catch {}
  Sound.queue = Promise.resolve();
}
/** Run nextFn once everything queued has finished speaking. */
function afterSpeech(nextFn, delay=300){
  const q = Sound.queue;
  q.then(()=>{ if(Sound.queue === q) setTimeout(nextFn, delay); else afterSpeech(nextFn, delay); });
}

/* Recorded grown-up clips. `praise` also matches praise2/praise3 so the child
   hears a different "well done" each time instead of the same one 40 times. */
function clipVariants(base){
  return Object.keys(audioClips).filter(k => k===base || new RegExp(`^${base}[2-9]$`).test(k));
}
function playClip(base, fallbackText){
  if(!prefs.soundOn) return Promise.resolve();
  const keys = clipVariants(base);
  if(!keys.length) return speak(fallbackText);
  const src = audioClips[randOf(keys)];
  return enqueue(()=>new Promise(resolve=>{
    const a = new Audio(src);
    let done=false;
    const finish = ()=>{ if(done) return; done=true; setTimeout(resolve, 200); };
    a.onended = finish;
    a.onerror = ()=>{ done=true; utter(fallbackText).then(resolve); };
    a.play().catch(()=>{ done=true; utter(fallbackText).then(resolve); });
  }));
}

function sfx(kind){
  if(!prefs.soundOn || !Sound.ctx) return;
  const ctx = Sound.ctx;
  if(ctx.state === 'suspended') ctx.resume();
  const notes = {
    tap:     [[660, 0, .07, .06]],
    correct: [[523, 0, .12, .10],[659, .09, .12, .10],[784, .18, .22, .11]],
    wrong:   [[300, 0, .16, .07],[240, .12, .18, .07]],
    win:     [[523,0,.14,.10],[659,.12,.14,.10],[784,.24,.14,.10],[1046,.36,.34,.12]]
  }[kind] || [];
  notes.forEach(([freq, at, dur, gain])=>{
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = kind==='wrong' ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  });
}

/* -------------------------------------------------------------- visual fx */
function celebrateAt(el){
  if(!el) return;
  const r = el.getBoundingClientRect();
  const burst = document.createElement('div');
  burst.className = 'fx-burst';
  burst.style.left = (r.left + r.width/2) + 'px';
  burst.style.top  = (r.top  + r.height/2) + 'px';
  for(let i=0;i<14;i++){
    const bit = document.createElement('i');
    bit.textContent = randOf(['⭐','🎉','✨','💛','🌟']);
    bit.style.setProperty('--dx', (Math.random()*260-130).toFixed(0)+'px');
    bit.style.setProperty('--dy', (Math.random()*-220-40).toFixed(0)+'px');
    bit.style.setProperty('--r',  (Math.random()*540-270).toFixed(0)+'deg');
    bit.style.animationDelay = (Math.random()*.12).toFixed(2)+'s';
    burst.appendChild(bit);
  }
  document.body.appendChild(burst);
  setTimeout(()=>burst.remove(), 1200);
}
function setFeedback(msg, tone=''){
  const f = $('.feedback');
  if(f){ f.innerHTML = msg; f.className = 'feedback' + (tone ? ' '+tone : ''); }
  state.feedback = msg;
}

/* ------------------------------------------------------------ shared shell */
function scorePill(){
  const dots = prefs.roundTarget
    ? `<span class="round-dots">${Array.from({length:prefs.roundTarget},(_,i)=>`<i class="${i<state.score?'on':''}"></i>`).join('')}</span>`
    : '';
  return `⭐ ${state.score}${dots}`;
}
/** Repaint the star pill the moment a star is won, rather than on the next round. */
function refreshScore(){
  const pill = $('.topbar .pill');
  if(!pill) return;
  pill.innerHTML = scorePill();
  pill.classList.add('bump');
  setTimeout(()=>pill.classList.remove('bump'), 400);
}
function gameTop(title){
  return `<div class="topbar"><button class="secondary" id="home">← Home</button>
    <span class="game-title">${title}</span>
    <span class="pill">${scorePill()}</span></div>`;
}
function bindHome(){ const b=$('#home'); if(b) b.onclick = ()=>{ stopSpeech(); state.screen='home'; render(); }; }
function lockOptions(on=true){
  state.locked = on;
  $$('.options, .family-options, .memory-grid').forEach(el=>el.classList.toggle('locked', on));
}

/** One place that decides what happens on a right/wrong answer, so every
 *  game behaves the same way: instant sound, animation, then the next round. */
function answered({btn, correct, game, praiseText, praiseSpeech, retryText, retrySpeech, next, hintEl}){
  if(state.locked) return;
  if(correct){
    lockOptions(true);
    btn.classList.add('correct');
    sfx('correct'); celebrateAt(btn);
    state.score++; state.wrong = 0;
    addProgress(game, 1, 1);
    refreshScore();
    setFeedback(praiseText, 'good');
    playClip('praise', praiseSpeech);
    afterSpeech(()=>{
      state.locked = false;
      if(prefs.roundTarget && state.score >= prefs.roundTarget) return renderWellDone(game);
      next();
    }, 250);
  } else {
    btn.classList.add('wrong');
    setTimeout(()=>btn.classList.remove('wrong'), 600);
    sfx('wrong');
    state.wrong++;
    addProgress(game, 0, 1);
    setFeedback(retryText, 'soft');
    playClip('tryAgain', retrySpeech);
    if(state.wrong >= 2 && hintEl) hintEl.classList.add('hint');   // gently show the answer
  }
}

function renderWellDone(game){
  const p = activeProfile();
  stopSpeech();
  app.innerHTML = `<div class="shell narrow welldone">
    <section class="card celebrate-card">
      <div class="celebrate-emoji">🏆</div>
      <h1>You did it, ${esc(p.name)}!</h1>
      <p class="celebrate-stars">${'⭐'.repeat(Math.min(state.score,10))}</p>
      <p>You earned <b>${state.score}</b> star${state.score===1?'':'s'} playing <b>${esc(gameName(game))}</b>.</p>
      <button class="primary big" id="again">Play again ▶</button>
      <button class="secondary wide" id="home">Choose another game</button>
    </section>
  </div>`;
  sfx('win');
  playClip('wellDone', `You did it, ${p.name}! Well done.`);
  const box = $('.celebrate-card'); setTimeout(()=>celebrateAt(box), 200);
  $('#again').onclick = ()=>startGame(game);
  bindHome();
}
function gameName(g){ return g==='boepa' ? `${data.grandName} Says` : GAME_LABELS[g] || 'Play & Learn'; }

/* ------------------------------------------------------------------ router */
function render(){
  const screens = {setup:renderSetup, home:renderHome, boepa:renderBoepa, animals:renderAnimals,
    monster:renderMonster, memory:renderMemory, family:renderFamily, phonics:renderPhonics,
    tracing:renderTracing, familySetup:renderFamilySetup, profiles:renderProfiles,
    parent:renderParent, voice:renderVoiceStudio};
  if(!data.profiles.length) return renderSetup();
  (screens[state.screen] || renderHome)();
  window.scrollTo(0,0);
}

function renderSetup(){
  app.innerHTML = `<div class="shell narrow">
    <section class="brand"><div class="logo-bubble">🎈</div><h1>Grandad's Play &amp; Learn</h1><p>Learning games made personal for your family.</p></section>
    <section class="card setup-card">
      <h2>${data.profiles.length ? 'Add another child' : 'Let’s get ready to play'}</h2>
      <div class="setup-grid">
        <div><label for="grandName">What do the children call you?</label><input id="grandName" maxlength="30" autocomplete="off"
          ${data.profiles.length ? `value="${esc(data.grandName)}"` : 'placeholder="e.g. Grandad, Boepa, Grandpa"'} /></div>
        <div><label for="childName">Child's first name</label><input id="childName" maxlength="24" placeholder="e.g. Charlie" autocomplete="off" /></div>
        <div><label for="age">Child's age</label><select id="age">${['1.5','2','2.5','3','3.5','4','4.5','5'].map(a=>`<option value="${a}"${a==='3'?' selected':''}>${a==='1.5'?'1½':a==='2.5'?'2½':a==='3.5'?'3½':a==='4.5'?'4½':a}</option>`).join('')}</select></div>
        <button class="primary big" id="start">${data.profiles.length ? 'Add child' : 'Start playing'} ✨</button>
        ${data.profiles.length ? '<button class="secondary" id="cancel">Cancel</button>' : ''}
      </div>
    </section>
  </div>`;
  $('#start').onclick = ()=>{
    const grandName = $('#grandName').value.trim() || 'Grandad';
    const childName = $('#childName').value.trim() || 'Little one';
    const p = {id:`p-${Date.now()}`, name:childName, age:$('#age').value, avatar:['🦁','🐼','🦄','🦖','🐯','🐸'][data.profiles.length%6]};
    data.grandName = grandName; data.profiles.push(p); data.activeProfileId = p.id;
    saveData(); state.screen='home'; render();
  };
  if($('#cancel')) $('#cancel').onclick = ()=>{ state.screen='profiles'; render(); };
}

function renderHome(){
  const p = activeProfile(); if(!p){ state.screen='setup'; return render(); }
  const stars = totalStars();
  app.innerHTML = `<div class="shell home-shell">
    <div class="home-topbar">
      <button class="parent-btn grownup-pill" id="parent">⚙️ <span>Grown-ups</span></button>
      <button class="profile-pill profile-pill-large" id="profiles"><span>${p.avatar}</span><span><small>Playing as</small>${esc(p.name)}</span><b>⌄</b></button>
    </div>

    <section class="hero-v4">
      <div class="hero-copy">
        <div class="sunny">☀️</div>
        <h1><span>Brilliant,</span><strong>${esc(p.name)}!</strong></h1>
        <h2>Play &amp; Learn with <b>${esc(data.grandName)}</b></h2>
        <p>What shall we play today?</p>
      </div>
      <div class="boepa-area">
        <div class="speech-bubble">Hi ${esc(p.name)}!<br><b>I'm ${esc(data.grandName)}</b></div>
        <img src="${data.grandPhoto || 'boepa-mascot.png'}" alt="${esc(data.grandName)}" class="boepa-mascot${data.grandPhoto ? ' is-photo' : ''}">
      </div>
    </section>

    <section class="home-grid home-grid-v4">
      ${gameTile('boepa','🎯',`${esc(data.grandName)} Says`,'Colours, shapes, animals &amp; numbers','purple')}
      ${gameTile('animals','🐶','Animal Sounds','Listen and find the animal','blue')}
      ${gameTile('monster','👾','Feed the Monster','Count and feed your monster','green')}
      ${gameTile('memory','🧠','Match &amp; Remember','Find the matching pairs','orange')}
      ${gameTile('family','👨‍👩‍👧‍👦','Our Family','Learn about our family','pink')}
      ${gameTile('phonics','🔤','Letters &amp; Phonics','Learn letters, sounds &amp; first words','teal')}
      ${gameTile('tracing','✏️','Tracing','Trace letters with your finger','violet')}
      <button class="game-tile progress-tile yellow" id="progress-home">
        <span class="emoji">⭐</span>
        <span>My Progress</span>
        <small>Keep going — you're doing great!</small>
        <div class="mini-bars"><i></i><i></i><i></i><i></i><i></i></div>
        <em>${stars} star${stars===1?'':'s'} earned</em>
      </button>
    </section>

    <section class="home-controls">
      <button class="home-control ${prefs.soundOn?'':'is-off'}" id="sound-home">${prefs.soundOn?'🔊':'🔇'} <span>Sound is ${prefs.soundOn?'ON':'OFF'}</span></button>
      <button class="home-control" id="voice-home">🎤 <span>${esc(data.grandName)} Voice Studio</span></button>
      <button class="home-control" id="progress-bottom">🏆 <span>My Progress</span></button>
    </section>

    <footer class="tiny-footer">No adverts • No outside links • Progress stays on this device</footer>
  </div>`;
  $('#profiles').onclick = ()=>{ state.screen='profiles'; render(); };
  $('#parent').onclick   = openParentGate;
  Object.keys(GAME_LABELS).forEach(g=>{ const el=$(`#game-${g}`); if(el) el.onclick = ()=>startGame(g); });
  const openProgress = ()=>{ state.screen='parent'; render(); };
  $('#progress-home').onclick   = openProgress;
  $('#progress-bottom').onclick = openProgress;
  $('#voice-home').onclick = ()=>{ state.screen='voice'; render(); };
  $('#sound-home').onclick = ()=>{
    prefs.soundOn = !prefs.soundOn; savePrefs();
    if(!prefs.soundOn) stopSpeech();
    renderHome();
    if(prefs.soundOn){ sfx('tap'); speak(`Hello ${p.name}. Sound is on.`); }
  };
}
function gameTile(id, emoji, title, sub, cls){
  const st = gameStats(id);
  const level = Math.max(1, Math.min(9, Math.floor((st.correct||0)/10) + 1));
  return `<button class="game-tile ${cls}" id="game-${id}">
    <span class="emoji">${emoji}</span>
    <span>${title}</span>
    <small>${sub}</small>
    <em>★ Level ${level}${st.plays?` · played ${st.plays}×`:''}</em>
  </button>`;
}

function startGame(g){
  stopSpeech();
  state.score=0; state.round=0; state.wrong=0; state.locked=false; state.feedback=''; state.game={}; state.challenge=null;
  startPlay(g);
  state.screen = g;
  ({boepa:newBoepaChallenge, animals:newAnimalRound, monster:newMonsterRound, memory:newMemoryGame,
    family:newFamilyRound, phonics:newPhonicsRound, tracing:newTracingRound})[g]();
  window.scrollTo(0,0);
}

/* ------------------------------------------------------------- Boepa Says */
function newBoepaChallenge(){
  const band = ageBand();
  const banks = band===2 ? [COLORS,ANIMALS] : band===3 ? [COLORS,ANIMALS,SHAPES] : [COLORS,ANIMALS,SHAPES,NUMBERS];
  const options = pick(randOf(banks), optionCount());
  state.challenge = {options, target: randOf(options)};
  state.round++; state.wrong=0; state.feedback='';
  renderBoepa();
  speak(`${data.grandName} says, can you find the ${state.challenge.target.name}?`);
}
function renderBoepa(){
  const p = activeProfile(), c = state.challenge; if(!c) return newBoepaChallenge();
  app.innerHTML = `<div class="shell">${gameTop(`${esc(data.grandName)} Says`)}
    <section class="challenge"><div class="prompt-icon">🎤</div><h2>${esc(data.grandName)} says...</h2>
      <p>Can you find the <strong>${esc(c.target.name).toUpperCase()}</strong>?</p>
      <button class="secondary" id="hear">🔊 Say it again</button></section>
    <section class="options">${c.options.map((o,i)=>`<button class="option" data-i="${i}" aria-label="${esc(o.name)}">${o.emoji}</button>`).join('')}</section>
    <div class="feedback" aria-live="polite"></div><div class="round">Round ${state.round}</div>
  </div>`;
  bindHome();
  $('#hear').onclick = ()=>{ sfx('tap'); sayNow(`${data.grandName} says, can you find the ${c.target.name}?`, .9); };
  $$('.option').forEach(btn=>btn.onclick = ()=>{
    const chosen = c.options[Number(btn.dataset.i)];
    const correct = chosen.name === c.target.name;
    answered({
      btn, correct, game:'boepa',
      praiseText:`🎉 Brilliant, ${esc(p.name)}!`, praiseSpeech:`Brilliant, ${p.name}!`,
      retryText:'Nearly! Have another go 😊', retrySpeech:'Nearly. Have another go.',
      next:newBoepaChallenge,
      hintEl: $(`.option[data-i="${c.options.indexOf(c.target)}"]`)
    });
  });
}

/* ---------------------------------------------------------- Animal Sounds */
function newAnimalRound(){
  const options = pick(ANIMALS, optionCount());
  state.challenge = {options, target: randOf(options)};
  state.round++; state.wrong=0; state.feedback='';
  renderAnimals();
  speak(state.challenge.target.sound, {rate:.72, pitch:1.1});
}
function renderAnimals(){
  const p = activeProfile(), c = state.challenge; if(!c) return newAnimalRound();
  app.innerHTML = `<div class="shell">${gameTop('Animal Sounds')}
    <section class="challenge animal-challenge"><div class="prompt-icon">👂</div><h2>Who makes this sound?</h2>
      <button class="sound-button" id="hear">🔊 Hear the sound</button></section>
    <section class="options">${c.options.map((o,i)=>`<button class="option animal-option" data-i="${i}" aria-label="${esc(o.name)}"><span>${o.emoji}</span><small>${ageBand()>3?esc(o.name):''}</small></button>`).join('')}</section>
    <div class="feedback" aria-live="polite"></div><div class="round">Round ${state.round}</div>
  </div>`;
  bindHome();
  $('#hear').onclick = ()=>{ sfx('tap'); sayNow(c.target.sound, .72); };
  $$('.animal-option').forEach(btn=>btn.onclick = ()=>{
    const chosen = c.options[Number(btn.dataset.i)];
    const correct = chosen.name === c.target.name;
    answered({
      btn, correct, game:'animals',
      praiseText:`🎉 Yes! It's the ${esc(c.target.name)}!`, praiseSpeech:`Well done, ${p.name}!`,
      retryText:'Listen again 👂', retrySpeech:'Listen again.',
      next:newAnimalRound,
      hintEl: $(`.option[data-i="${c.options.indexOf(c.target)}"]`)
    });
    if(!correct) setTimeout(()=>speak(c.target.sound, {rate:.72, pitch:1.1}), 400);
  });
}

/* ------------------------------------------------------- Feed the Monster */
function newMonsterRound(){
  const max = ageBand()===2 ? 3 : ageBand()===3 ? 5 : 8;
  state.game = {targetCount: 1+Math.floor(Math.random()*max), food: randOf(FOODS), fed:0, done:false};
  state.round++; state.wrong=0; state.feedback='';
  renderMonster();
  const g = state.game;
  speak(`Feed the monster ${g.targetCount} ${plural(g.food.name, g.targetCount)}.`);
}
function renderMonster(){
  const p = activeProfile(), g = state.game; if(!g.targetCount) return newMonsterRound();
  const foods = plural(g.food.name, g.targetCount);
  const label = `Feed the monster ${g.targetCount} ${foods}.`;
  app.innerHTML = `<div class="shell">${gameTop('Feed the Monster')}
    <section class="challenge monster-prompt"><h2>Feed me ${g.targetCount} ${foods}!</h2><p>Tap the food to feed the monster.</p></section>
    <section class="monster-zone">
      <div class="monster">👾<div class="monster-mouth">0 / ${g.targetCount}</div></div>
      <button class="food-button" id="food" aria-label="Feed one ${esc(g.food.name)}">${g.food.emoji}</button>
    </section>
    <div class="count-dots">${Array.from({length:g.targetCount},()=>'<span>○</span>').join('')}</div>
    <div class="feedback" aria-live="polite">${g.targetCount} more to go!</div>
    <button class="secondary hear-inline" id="hear">🔊 Say it again</button>
  </div>`;
  bindHome();
  $('#hear').onclick = ()=>{ sfx('tap'); sayNow(label, .9); };
  const foodBtn = $('#food'), monster = $('.monster'), mouth = $('.monster-mouth');
  foodBtn.onclick = ()=>{
    if(g.done || state.locked) return;
    g.fed++;
    sfx('tap');
    flyFood(foodBtn, monster, g.food.emoji);
    monster.classList.add('chomp'); setTimeout(()=>monster.classList.remove('chomp'), 320);
    $$('.count-dots span').forEach((s,i)=>{ if(i<g.fed){ s.textContent='●'; s.classList.add('filled'); } });
    mouth.textContent = `${g.fed} / ${g.targetCount}`;
    if(g.fed < g.targetCount){
      sayNow(COUNT_WORDS[g.fed] || String(g.fed), 1);   // count along: "one, two, three"
      setFeedback(`${g.targetCount - g.fed} more to go!`);
    } else {
      g.done = true; state.locked = true;
      foodBtn.disabled = true;
      monster.classList.add('happy');
      monster.firstChild.textContent = '😋';
      mouth.textContent = 'YUM!';
      state.score++; addProgress('monster',1,1);
      refreshScore();
      sfx('correct'); celebrateAt(monster);
      setFeedback(`🎉 Perfect counting, ${esc(p.name)}!`, 'good');
      stopSpeech();
      speak(`${COUNT_WORDS[g.targetCount] || g.targetCount}!`);
      playClip('praise', `Perfect counting, ${p.name}!`);
      afterSpeech(()=>{
        state.locked = false;
        if(prefs.roundTarget && state.score >= prefs.roundTarget) return renderWellDone('monster');
        newMonsterRound();
      }, 250);
    }
  };
}
function flyFood(from, to, emoji){
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const bit = document.createElement('div');
  bit.className = 'fly-food';
  bit.textContent = emoji;
  bit.style.left = (a.left + a.width/2) + 'px';
  bit.style.top  = (a.top  + a.height/2) + 'px';
  bit.style.setProperty('--dx', ((b.left + b.width/2) - (a.left + a.width/2)) + 'px');
  bit.style.setProperty('--dy', ((b.top  + b.height/2) - (a.top  + a.height/2)) + 'px');
  document.body.appendChild(bit);
  setTimeout(()=>bit.remove(), 500);
}

/* ------------------------------------------------------ Match & Remember */
function newMemoryGame(){
  const pairs = ageBand()===2 ? 2 : ageBand()===3 ? 3 : 4;
  const selected = pick(MEMORY_CARDS, pairs);
  const deck = shuffle([...selected, ...selected]).map((emoji,i)=>({id:i, emoji, open:false, matched:false}));
  state.game = {deck, first:null, locked:false, matches:0, pairs};
  state.score = 0; state.feedback='';
  renderMemory();
  speak('Find the matching pairs.');
}
function renderMemory(){
  const g = state.game; if(!g.deck) return newMemoryGame();
  app.innerHTML = `<div class="shell">${gameTop('Match & Remember')}
    <section class="challenge compact"><h2>Find the matching pairs</h2><p>Remember what's hiding under the cards.</p></section>
    <section class="memory-grid pairs-${g.pairs}">${g.deck.map((c,i)=>`<button class="memory-card" data-i="${i}">❓</button>`).join('')}</section>
    <div class="feedback" aria-live="polite"></div>
    <div class="footer-actions"><button class="secondary" id="restart">↻ New cards</button></div>
  </div>`;
  bindHome();
  $('#restart').onclick = ()=>{ stopSpeech(); newMemoryGame(); };
  $$('.memory-card').forEach(btn=>btn.onclick = ()=>flipMemory(Number(btn.dataset.i)));
  g.deck.forEach((_,i)=>paintCard(i));
}
function paintCard(i){
  const g = state.game, c = g.deck[i], btn = $(`.memory-card[data-i="${i}"]`);
  if(!btn) return;
  const face = c.open || c.matched;
  btn.textContent = face ? c.emoji : '❓';
  btn.classList.toggle('open', face);
  btn.classList.toggle('matched', c.matched);
  btn.disabled = c.matched;
}
function flipMemory(i){
  const g = state.game, c = g.deck[i];
  if(g.locked || c.open || c.matched) return;
  c.open = true; paintCard(i); sfx('tap');

  if(g.first === null){ g.first = i; setFeedback(''); return; }

  const fi = g.first, first = g.deck[fi];
  g.first = null;

  if(first.emoji === c.emoji){
    first.matched = c.matched = true;
    paintCard(fi); paintCard(i);
    g.matches++; state.score++;
    addProgress('memory', 1, 1);
    refreshScore();
    sfx('correct'); celebrateAt($(`.memory-card[data-i="${i}"]`));
    if(g.matches === g.pairs){
      g.locked = true;
      setFeedback(`🏆 You found them all, ${esc(activeProfile().name)}!`, 'good');
      playClip('praise', `You found them all!`);
      afterSpeech(()=>renderWellDone('memory'), 400);
    } else {
      setFeedback('🎉 A match!', 'good');
      playClip('praise', 'A match!');
    }
  } else {
    g.locked = true;
    addProgress('memory', 0, 1);
    sfx('wrong');
    setFeedback('Remember where they are!', 'soft');
    setTimeout(()=>{
      first.open = c.open = false;
      paintCard(fi); paintCard(i);
      g.locked = false; setFeedback('');
    }, 1000);
  }
}

/* --------------------------------------------------------------- Phonics */
const PHONICS = [
 {letter:'A',word:'apple',emoji:'🍎'}, {letter:'B',word:'ball',emoji:'⚽'}, {letter:'C',word:'cat',emoji:'🐱'},
 {letter:'D',word:'dog',emoji:'🐶'}, {letter:'E',word:'egg',emoji:'🥚'}, {letter:'F',word:'fish',emoji:'🐟'},
 {letter:'G',word:'goat',emoji:'🐐'}, {letter:'H',word:'hat',emoji:'🎩'}, {letter:'I',word:'igloo',emoji:'🧊'},
 {letter:'J',word:'juice',emoji:'🧃'}, {letter:'K',word:'kite',emoji:'🪁'}, {letter:'L',word:'lion',emoji:'🦁'},
 {letter:'M',word:'moon',emoji:'🌙'}, {letter:'N',word:'nose',emoji:'👃'}, {letter:'O',word:'orange',emoji:'🍊'},
 {letter:'P',word:'pig',emoji:'🐷'}, {letter:'Q',word:'queen',emoji:'👑'}, {letter:'R',word:'rocket',emoji:'🚀'},
 {letter:'S',word:'sun',emoji:'☀️'}, {letter:'T',word:'tiger',emoji:'🐯'}, {letter:'U',word:'umbrella',emoji:'☂️'},
 {letter:'V',word:'van',emoji:'🚐'}, {letter:'W',word:'whale',emoji:'🐋'}, {letter:'X',word:'xylophone',emoji:'🎼'},
 {letter:'Y',word:'yarn',emoji:'🧶'}, {letter:'Z',word:'zebra',emoji:'🦓'}
];
function newPhonicsRound(){
  const options = pick(PHONICS, optionCount());
  state.game = {options, target: randOf(options)};
  state.round++; state.wrong=0; state.feedback='';
  renderPhonics();
  const t = state.game.target;
  speak(`Can you find the letter ${t.letter}? ${t.letter} is for ${t.word}.`);
}
function renderPhonics(){
  const g = state.game, p = activeProfile(); if(!g.target) return newPhonicsRound();
  app.innerHTML = `<div class="shell">${gameTop('Letters & Phonics')}
    <section class="challenge"><div class="prompt-icon">🔤</div><h2>Find the letter <strong>${g.target.letter}</strong></h2>
      <p>${g.target.letter} is for ${g.target.emoji} ${g.target.word}</p>
      <button class="secondary" id="hear">🔊 Hear it</button></section>
    <section class="options">${g.options.map((o,i)=>`<button class="option letter-option" data-i="${i}" aria-label="letter ${o.letter}">${o.letter}</button>`).join('')}</section>
    <div class="feedback" aria-live="polite"></div><div class="round">Round ${state.round}</div>
  </div>`;
  bindHome();
  $('#hear').onclick = ()=>{ sfx('tap'); sayNow(`${g.target.letter}. ${g.target.letter} is for ${g.target.word}.`, .85); };
  $$('.letter-option').forEach(btn=>btn.onclick = ()=>{
    const o = g.options[Number(btn.dataset.i)];
    answered({
      btn, correct:o.letter===g.target.letter, game:'phonics',
      praiseText:`🎉 ${g.target.letter} is for ${g.target.word}!`, praiseSpeech:`Brilliant, ${p.name}!`,
      retryText:'Good try — have another go 😊', retrySpeech:'Good try. Have another go.',
      next:newPhonicsRound,
      hintEl: $(`.option[data-i="${g.options.indexOf(g.target)}"]`)
    });
  });
}

/* --------------------------------------------------------------- Tracing */
function newTracingRound(){
  state.game = {item: randOf(PHONICS), drawn:0};
  state.round++; state.feedback='';
  renderTracing();
  speak(`Trace the letter ${state.game.item.letter} with your finger.`);
}
function renderTracing(){
  const g = state.game; if(!g.item) return newTracingRound();
  app.innerHTML = `<div class="shell">${gameTop('Tracing')}
    <section class="challenge compact"><h2>Trace the letter ${g.item.letter}</h2><p>${g.item.emoji} ${g.item.letter} is for ${g.item.word}</p></section>
    <div class="trace-wrap"><canvas id="traceCanvas" width="700" height="520"></canvas><div class="trace-guide">${g.item.letter}</div></div>
    <div class="feedback" aria-live="polite"></div>
    <div class="footer-actions"><button class="secondary" id="clearTrace">↻ Clear</button><button class="primary" id="traceDone">✓ I did it!</button></div>
  </div>`;
  bindHome();

  const canvas = $('#traceCanvas'), ctx = canvas.getContext('2d');
  ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#7031a8';
  let drawing = false, last = null;

  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return {x:(e.clientX - r.left) * canvas.width / r.width, y:(e.clientY - r.top) * canvas.height / r.height};
  };
  const start = e => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);      // keeps drawing if the finger strays off the canvas
    drawing = true; last = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y);
  };
  const move = e => {
    if(!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    g.drawn += Math.hypot(p.x - last.x, p.y - last.y);   // measure distance, not event count
    last = p;
  };
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);

  $('#clearTrace').onclick = ()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); g.drawn=0; setFeedback(''); sfx('tap'); };
  $('#traceDone').onclick = ()=>{
    // Feedback is updated in place so a "not yet" message never erases the drawing.
    if(g.drawn < 500){ sfx('wrong'); setFeedback('Draw over the big letter first 😊','soft'); return; }
    state.score++; addProgress('tracing',1,1);
    refreshScore();
    sfx('correct'); celebrateAt($('.trace-wrap'));
    setFeedback('🌟 Lovely tracing!','good');
    playClip('praise', `Lovely tracing, ${activeProfile().name}!`);
    afterSpeech(()=>{
      if(prefs.roundTarget && state.score >= prefs.roundTarget) return renderWellDone('tracing');
      newTracingRound();
    }, 250);
  };
}

/* ----------------------------------------------------------- Our Family */
function newFamilyRound(){
  if(familyPeople.length < 2){ state.game = {needsSetup:true}; return renderFamily(); }
  const options = pick(familyPeople, Math.min(familyPeople.length, optionCount()));
  state.game = {options, target: randOf(options)};
  state.round++; state.wrong=0; state.feedback='';
  renderFamily();
  const t = state.game.target;
  speak(`Can you find ${t.role || t.name}?`);
}
function renderFamily(){
  const g = state.game;
  if(g.needsSetup || familyPeople.length < 2){
    app.innerHTML = `<div class="shell narrow">${gameTop('Our Family')}
      <section class="card gate"><div class="prompt-icon">👨‍👩‍👧‍👦</div><h2>Our Family needs two photos</h2>
      <p>Ask a grown-up to add family members in the Grown-ups area first.</p></section></div>`;
    bindHome(); return;
  }
  if(!g.target) return newFamilyRound();
  app.innerHTML = `<div class="shell">${gameTop('Our Family')}
    <section class="challenge"><h2>Can you find ${esc(g.target.role || g.target.name)}?</h2>
      <button class="secondary" id="hear">🔊 Say it again</button></section>
    <section class="family-options">${g.options.map((x,i)=>`<button class="family-choice" data-i="${i}">${x.photo?`<img src="${x.photo}" alt="${esc(x.name)}">`:'<span class="big-person">👤</span>'}<b>${esc(x.name)}</b></button>`).join('')}</section>
    <div class="feedback" aria-live="polite"></div>
  </div>`;
  bindHome();
  $('#hear').onclick = ()=>{ sfx('tap'); sayNow(`Can you find ${g.target.role || g.target.name}?`, .9); };
  $$('.family-choice').forEach(btn=>btn.onclick = ()=>{
    const x = g.options[Number(btn.dataset.i)];
    answered({
      btn, correct:x.name===g.target.name, game:'family',
      praiseText:`💛 That's ${esc(g.target.name)}!`, praiseSpeech:`That's right, ${activeProfile().name}!`,
      retryText:'Nearly — try another face 😊', retrySpeech:'Nearly. Try another face.',
      next:newFamilyRound,
      hintEl: $(`.family-choice[data-i="${g.options.indexOf(g.target)}"]`)
    });
  });
}

/* ------------------------------------------------------------- profiles */
function renderProfiles(){
  app.innerHTML = `<div class="shell narrow"><div class="topbar"><button class="secondary" id="back">← Back</button><span class="game-title">Who's playing?</span><span></span></div>
    <section class="profile-grid">${data.profiles.map(p=>`<button class="child-card ${p.id===data.activeProfileId?'active':''}" data-id="${p.id}"><span>${p.avatar}</span><b>${esc(p.name)}</b><small>Age ${esc(p.age)}</small></button>`).join('')}
    <button class="child-card add" id="add"><span>➕</span><b>Add child</b></button></section>
  </div>`;
  $('#back').onclick = ()=>{ state.screen='home'; render(); };
  $('#add').onclick  = ()=>{ state.screen='setup'; render(); };
  $$('.child-card[data-id]').forEach(b=>b.onclick = ()=>{ data.activeProfileId = b.dataset.id; saveData(); state.screen='home'; render(); });
}

/* ------------------------------------------------------------ grown-ups */
function openParentGate(){
  const a = 4+Math.floor(Math.random()*6), b = 3+Math.floor(Math.random()*7);
  app.innerHTML = `<div class="shell narrow"><section class="card gate"><div class="prompt-icon">🔒</div><h2>Grown-ups only</h2>
    <p>What is <strong>${a} + ${b}</strong>?</p>
    <input id="gateAnswer" inputmode="numeric" pattern="[0-9]*" placeholder="Answer" />
    <button class="primary" id="unlock">Unlock</button><button class="secondary" id="cancel">Cancel</button>
    <div id="gateMsg"></div></section></div>`;
  const tryUnlock = ()=>{
    if(Number($('#gateAnswer').value) === a+b){ state.screen='parent'; render(); }
    else $('#gateMsg').textContent = 'Not quite — try again.';
  };
  $('#cancel').onclick = ()=>{ state.screen='home'; render(); };
  $('#unlock').onclick = tryUnlock;
  $('#gateAnswer').onkeydown = e => { if(e.key === 'Enter') tryUnlock(); };
  $('#gateAnswer').focus();
}

function renderParent(){
  const p = activeProfile();
  const voiceOptions = Sound.voices.filter(v=>/^en/i.test(v.lang));
  app.innerHTML = `<div class="shell"><div class="topbar"><button class="secondary" id="home">← Home</button><span class="game-title">Grown-ups</span><span></span></div>
    <section class="parent-grid">
      <div class="card"><h2>Family setup</h2>
        <label for="grandNameEdit">Grandparent name</label>
        <input id="grandNameEdit" value="${esc(data.grandName)}" />
        <button class="primary small" id="saveGrand">Save name</button>

        <label class="spaced">Your picture</label>
        <div class="mascot-row">
          <span class="mascot-preview"><img src="${data.grandPhoto || 'boepa-mascot.png'}" alt=""></span>
          <div class="mascot-controls">
            <input id="grandPhoto" type="file" accept="image/*">
            ${data.grandPhoto ? '<button class="secondary" id="removeGrandPhoto">Use the cartoon instead</button>' : ''}
          </div>
        </div>
        <p class="muted">This is the face on the home screen. Use a photo of yourself — head and shoulders works best. It stays on this device.</p>

        <button class="secondary wide" id="profiles">Manage children</button></div>

      <div class="card"><h2>${esc(p.name)}'s progress</h2>
        <p class="muted">${totalStars()} stars earned in total.</p>
        ${Object.keys(GAME_LABELS).map(statsRow).join('')}</div>

      <div class="card"><h2>Game length</h2>
        <p>How many stars before the “well done” screen?</p>
        <div class="chip-row">
          ${[5,10,0].map(n=>`<button class="chip ${prefs.roundTarget===n?'on':''}" data-rounds="${n}">${n===0?'Keep going':n+' stars'}</button>`).join('')}
        </div></div>

      <div class="card"><h2>Question voice</h2>
        <p>The voice that asks the questions when no recording is available.</p>
        <div class="voice-choice-row">
          <select id="voicePick">
            <option value="">Best available (recommended)</option>
            ${voiceOptions.map(v=>`<option value="${esc(v.voiceURI)}"${prefs.voiceURI===v.voiceURI?' selected':''}>${esc(v.name)} — ${esc(v.lang)}</option>`).join('')}
          </select>
          <button class="secondary" id="testVoice">▶️ Test voice</button>
        </div>
        ${voiceOptions.length ? '' : '<p class="muted">No voices listed yet — reopen this page once and they should appear.</p>'}</div>

      <div class="card"><h2>Our Family</h2><p>Add familiar people using a name, relationship and photo. Photos stay on this device and are shrunk automatically.</p>
        <button class="primary small" id="familySetup">👨‍👩‍👧‍👦 Manage family photos</button></div>

      <div class="card"><h2>${esc(data.grandName)}'s voice</h2><p>Record your own praise and “try again” messages. These replace the computer voice when available.</p>
        <button class="primary small" id="voice">🎙️ Voice studio</button></div>

      <div class="card"><h2>Backup</h2>
        <p>Everything lives only in this browser, so it can be lost if the device is wiped — or if Safari
        clears the site after a long gap. Save a copy of the profiles, progress, family photos and voice
        recordings, and put it somewhere safe.</p>
        <div class="chip-row">
          <button class="primary small" id="exportBackup">💾 Save a backup</button>
          <button class="secondary" id="importBtn">📂 Restore a backup</button>
        </div>
        <input id="importFile" type="file" accept="application/json,.json" hidden>
        <p class="muted">Restoring replaces everything currently on this device.</p></div>

      <div class="card"><h2>Reset</h2><p>Progress and recordings stay only on this device.</p>
        <button class="danger" id="resetProgress">Reset ${esc(p.name)}'s progress</button></div>
    </section>
  </div>`;
  bindHome();
  $('#profiles').onclick    = ()=>{ state.screen='profiles'; render(); };
  $('#voice').onclick       = ()=>{ state.screen='voice'; render(); };
  $('#familySetup').onclick = ()=>{ state.screen='familySetup'; render(); };
  $('#saveGrand').onclick   = ()=>{ data.grandName = $('#grandNameEdit').value.trim() || 'Grandad'; saveData(); renderParent(); };
  $$('.chip[data-rounds]').forEach(b=>b.onclick = ()=>{ prefs.roundTarget = Number(b.dataset.rounds); savePrefs(); renderParent(); });
  $('#voicePick').onchange  = e => { prefs.voiceURI = e.target.value; savePrefs(); };
  $('#testVoice').onclick   = ()=>{ stopSpeech(); speak(`Hello ${p.name}. Can you find the red circle?`); };
  $('#grandPhoto').onchange = async e => {
    const file = e.target.files[0]; if(!file) return;
    const prev = data.grandPhoto;
    try { data.grandPhoto = await downscaleImage(file, 520); }
    catch { return alert('That picture could not be read. Try a different one.'); }
    if(!saveData()){
      data.grandPhoto = prev; saveData();
      return alert('There is not enough space left on this device for that picture.');
    }
    renderParent();
  };
  if($('#removeGrandPhoto')) $('#removeGrandPhoto').onclick = ()=>{ data.grandPhoto = ''; saveData(); renderParent(); };
  $('#exportBackup').onclick = exportBackup;
  $('#importBtn').onclick    = ()=>$('#importFile').click();
  $('#importFile').onchange  = e => { if(e.target.files[0]) importBackup(e.target.files[0]); };
  $('#resetProgress').onclick = ()=>{
    if(!confirm(`Reset all of ${p.name}'s progress? This cannot be undone.`)) return;
    Object.keys(data.progress).filter(k=>k.startsWith(`${p.id}:`)).forEach(k=>delete data.progress[k]);
    saveData(); renderParent();
  };
}
function statsRow(g){
  const s = gameStats(g);
  const pct = s.attempts ? Math.round(s.correct / s.attempts * 100) : 0;
  return `<div class="stat-row"><span><b>${esc(gameName(g))}</b><small>${s.plays} play${s.plays===1?'':'s'} · ${s.correct} star${s.correct===1?'':'s'}</small></span><strong>${s.attempts ? pct+'%' : '—'}</strong></div>`;
}

/* ------------------------------------------------------- backup / restore
   One file holding everything: profiles, progress, family photos and voice
   recordings. Nothing leaves the device unless the grown-up saves it. */
const BACKUP_TAG = 'grandads-play-learn';
function exportBackup(){
  const payload = {app:BACKUP_TAG, version:1, savedAt:new Date().toISOString(), data, prefs, audioClips, familyPeople};
  let url;
  try { url = URL.createObjectURL(new Blob([JSON.stringify(payload)], {type:'application/json'})); }
  catch { return alert('The backup could not be prepared on this device.'); }
  const a = document.createElement('a');
  a.href = url;
  a.download = `play-and-learn-backup-${payload.savedAt.slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 10000);
}
function importBackup(file){
  const reader = new FileReader();
  reader.onerror = ()=>alert('That file could not be opened.');
  reader.onload = ()=>{
    let p;
    try { p = JSON.parse(reader.result); } catch { return alert('That file could not be read. It should be a .json backup saved by this app.'); }
    if(!p || p.app !== BACKUP_TAG || !p.data || !Array.isArray(p.data.profiles))
      return alert('That does not look like a Play & Learn backup.');

    const names = p.data.profiles.map(x=>x.name).join(', ') || 'no children';
    const when  = (p.savedAt || '').slice(0,10) || 'an unknown date';
    const clips = Object.keys(p.audioClips || {}).length;
    if(!confirm(`Restore this backup?\n\nSaved: ${when}\nChildren: ${names}\nVoice recordings: ${clips}\n\nEverything currently on this device will be replaced.`)) return;

    data         = {...structuredClone(DEFAULT_DATA),  ...p.data};
    prefs        = {...structuredClone(DEFAULT_PREFS), ...(p.prefs || {})};
    audioClips   = p.audioClips || {};
    familyPeople = Array.isArray(p.familyPeople) ? p.familyPeople : [];

    const ok = [saveData(), savePrefs(), saveClips(), saveFamily()].every(Boolean);
    if(!ok) alert('The backup was restored, but there was not enough space to save all of it on this device. Some photos or recordings may be missing.');
    state.screen = 'home';
    render();
  };
  reader.readAsText(file);
}

/* ---------------------------------------------------------- voice studio */
const VOICE_LINES = [
  {key:'praise',    title:'Well done (1)',   hint:'“Brilliant! Well done!”'},
  {key:'praise2',   title:'Well done (2)',   hint:'“Ooh, clever girl/boy!”'},
  {key:'praise3',   title:'Well done (3)',   hint:'“That’s the one! Fantastic.”'},
  {key:'tryAgain',  title:'Try again (1)',   hint:'“Nearly! Have another go.”'},
  {key:'tryAgain2', title:'Try again (2)',   hint:'“Ooh, not that one. Try again.”'},
  {key:'wellDone',  title:'End of game',     hint:'“You did it! I’m so proud of you.”'}
];
function renderVoiceStudio(){
  const recorded = VOICE_LINES.filter(l=>audioClips[l.key]).length;
  app.innerHTML = `<div class="shell narrow"><div class="topbar"><button class="secondary" id="back">← Back</button><span class="game-title">Voice studio</span><span class="pill">${recorded}/${VOICE_LINES.length}</span></div>
    <section class="card voice-card"><div class="prompt-icon">🎙️</div>
      <h2>Make it sound like ${esc(data.grandName)}</h2>
      <p>Record short messages in your own voice. Where you record more than one “well done”, the app picks a different one each time so it never gets repetitive.</p>
      <p class="voice-note">Tap <b>Record</b>, speak, then tap <b>Stop</b>. Recording stops on its own after 8 seconds.</p>
      ${VOICE_LINES.map(l=>voiceRow(l.key, l.title, l.hint)).join('')}
      <p class="privacy-note">Recordings are stored in this browser on this device and are not uploaded anywhere.</p>
    </section></div>`;
  $('#back').onclick = ()=>{ state.screen = data.profiles.length ? 'parent' : 'home'; render(); };
  $$('[data-record]').forEach(b=>b.onclick = ()=>recordClip(b.dataset.record, b));
  $$('[data-play]').forEach(b=>b.onclick = ()=>{
    stopSpeech();
    const a = new Audio(audioClips[b.dataset.play]); a.play().catch(()=>{});
  });
  $$('[data-delete]').forEach(b=>b.onclick = ()=>{ delete audioClips[b.dataset.delete]; saveClips(); renderVoiceStudio(); });
}
function voiceRow(key, title, hint){
  const has = !!audioClips[key];
  return `<div class="voice-row"><div><b>${title}</b><small>${hint}</small></div>
    <div class="voice-actions">
      <button class="primary small adult-record" data-record="${key}">${has ? '🎙️ Re-record' : '🎙️ Record'}</button>
      ${has ? `<button class="secondary" data-play="${key}">▶️ Play</button><button class="secondary" data-delete="${key}">🗑️</button>` : ''}
    </div></div>`;
}
async function recordClip(key, button){
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
    alert('Voice recording is not supported in this browser. On iPad, use Safari and open the site over https.');
    return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch { alert('Microphone permission is needed to record your voice.'); return; }

  const chunks = [];
  const rec = new MediaRecorder(stream);
  let autoStop;
  rec.ondataavailable = e => chunks.push(e.data);
  rec.onstop = () => {
    clearTimeout(autoStop);
    stream.getTracks().forEach(t=>t.stop());
    const blob = new Blob(chunks, {type: rec.mimeType || 'audio/webm'});
    const reader = new FileReader();
    reader.onload = () => {
      const prev = audioClips[key];
      audioClips[key] = reader.result;
      if(!saveClips()){
        if(prev) audioClips[key] = prev; else delete audioClips[key];
        saveClips();
        alert('There was not enough space to save that recording. Try a shorter message, or delete one you no longer need.');
      }
      renderVoiceStudio();
    };
    reader.readAsDataURL(blob);
  };
  rec.start();
  button.textContent = '⏹️ Stop recording';
  button.classList.add('recording');
  button.onclick = () => { if(rec.state === 'recording') rec.stop(); };
  autoStop = setTimeout(()=>{ if(rec.state === 'recording') rec.stop(); }, 8000);
}

/* ---------------------------------------------------------- family setup */
function renderFamilySetup(){
  app.innerHTML = `<div class="shell"><div class="topbar"><button class="secondary" id="back">← Grown-ups</button><span class="game-title">Our Family setup</span><span></span></div>
    <section class="card"><h2>Add familiar faces</h2>
      <div class="setup-grid">
        <div><label for="famName">Name</label><input id="famName" placeholder="e.g. Boepa"></div>
        <div><label for="famRole">Who are they?</label><input id="famRole" placeholder="e.g. Boepa, Mummy, Auntie"></div>
        <div><label for="famPhoto">Photo</label><input id="famPhoto" type="file" accept="image/*"></div>
        <button class="primary" id="addFamily">Add person</button>
      </div>
      <p class="muted">Photos are shrunk to a small square before saving, so you can add plenty without running out of space.</p>
    </section>
    <section class="profile-grid family-list">${familyPeople.map((x,i)=>`<div class="child-card"><span class="family-thumb">${x.photo?`<img src="${x.photo}" alt="">`:'👤'}</span><b>${esc(x.name)}</b><small>${esc(x.role)}</small><button class="secondary fam-delete" data-i="${i}">Remove</button></div>`).join('')}</section>
  </div>`;
  $('#back').onclick = ()=>{ state.screen='parent'; render(); };
  $$('.fam-delete').forEach(b=>b.onclick = ()=>{ familyPeople.splice(Number(b.dataset.i),1); saveFamily(); renderFamilySetup(); });
  $('#addFamily').onclick = async ()=>{
    const name = $('#famName').value.trim();
    const role = $('#famRole').value.trim();
    const file = $('#famPhoto').files[0];
    if(!name) return alert('Please add a name.');
    const btn = $('#addFamily'); btn.disabled = true; btn.textContent = 'Adding…';
    let photo = '';
    if(file){
      try { photo = await downscaleImage(file, 480); }
      catch { alert('That photo could not be read. Try a different one.'); btn.disabled=false; btn.textContent='Add person'; return; }
    }
    familyPeople.push({name, role: role || name, photo});
    if(!saveFamily()){
      familyPeople.pop(); saveFamily();
      alert('There is not enough space left on this device. Remove a family photo and try again.');
    }
    renderFamilySetup();
  };
}
/** Shrink to a square JPEG (~40KB) so localStorage never fills up. */
function downscaleImage(file, size){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ boot */
render();
