// ZENMIX v2 — App 100% cliente | CEO: Nothing Noty
(() => {
const $$ = (s, el = document) => el.querySelector(s);
const $$$ = (s, el = document) => [...el.querySelectorAll(s)];

// === STATE ===
let curTab = 'home', dark = true, curSes = null, playing = false, timer = null, secs = 0;
let selVoice = 'es-MX-JorgeNeural', selRate = '-40%';
let bCtx = null, bGain = null, bOsc = null, activeBin = null;
let ambCtx = null, ambGain = null, ambNodes = {}, activeAmb = null;
let favs = JSON.parse(localStorage.zmx_fav || '[]');
let stats = JSON.parse(localStorage.zmx_stats || '{"sessions":0,"minutes":0,"streak":0,"last":null}');
let synth = window.speechSynthesis;

// === DATA ===
const sessions = {
  insomnio: {t:'Insomnio 🌙',s:'Hipnosis profunda para dormir',c:'#4a6cf7',d:30},
  ansiedad: {t:'Ansiedad 😌',s:'Calma tu mente y cuerpo',c:'#10b981',d:20},
  migrania: {t:'Migraña 🤕',s:'Alivio con binaurales',c:'#8b5cf6',d:25},
  autoestima: {t:'Autoestima 💪',s:'Confianza interior',c:'#f59e0b',d:20},
  'dejar-fumar': {t:'Dejar de Fumar 🚭',s:'Libérate del tabaco',c:'#ef4444',d:25},
  peso: {t:'Control de Peso ⚖️',s:'Hábitos saludables',c:'#06b6d4',d:20},
  focus: {t:'Concentración 🎯',s:'Enfoque mental',c:'#a855f7',d:15}
};

const voices = [
  {id:'es-MX-JorgeNeural',n:'Jorge',f:'🇲🇽',g:'M'},
  {id:'es-MX-DaliaNeural',n:'Dalia',f:'🇲🇽',g:'F'},
  {id:'es-ES-AlvaroNeural',n:'Álvaro',f:'🇪🇸',g:'M'},
  {id:'es-AR-TomasNeural',n:'Tomás',f:'🇦🇷',g:'M'},
  {id:'es-CO-GonzaloNeural',n:'Gonzalo',f:'🇨🇴',g:'M'},
  {id:'es-VE-SebastianNeural',n:'Sebastián',f:'🇻🇪',g:'M'},
  {id:'es-CL-LorenzoNeural',n:'Lorenzo',f:'🇨🇱',g:'M'},
  {id:'es-PE-AlexNeural',n:'Alex',f:'🇵🇪',g:'M'},
  {id:'es-US-AlonsoNeural',n:'Alonso',f:'🇺🇸',g:'M'},
  {id:'es-ES-ElviraNeural',n:'Elvira',f:'🇪🇸',g:'F'},
  {id:'es-ES-XimenaNeural',n:'Ximena',f:'🇪🇸',g:'F'},
  {id:'es-AR-ElenaNeural',n:'Elena',f:'🇦🇷',g:'F'},
  {id:'es-CO-SalomeNeural',n:'Salomé',f:'🇨🇴',g:'F'},
  {id:'es-PE-CamilaNeural',n:'Camila',f:'🇵🇪',g:'F'},
  {id:'es-US-PalomaNeural',n:'Paloma',f:'🇺🇸',g:'F'}
];

const binaurals = [
  {id:'delta',hz:2,n:'Delta',e:'😴',d:'Sueño profundo'},
  {id:'theta',hz:6,n:'Theta',e:'🧠',d:'Meditación'},
  {id:'alpha',hz:10,n:'Alfa',e:'✨',d:'Relajación'},
  {id:'sigma',hz:14,n:'Sigma',e:'💡',d:'Enfoque'},
  {id:'gamma',hz:40,n:'Gamma',e:'⚡',d:'Concentración'},
  {id:'beta',hz:20,n:'Beta',e:'🔥',d:'Activación'}
];

// === SCRIPTS ===
const scripts = {
  insomnio: `Respira profundamente... Siente cómo el aire entra... lentamente... y luego... suéltalo suavemente... Con cada respiración tu cuerpo se vuelve más pesado... más relajado... Siente cómo tus pies se hunden en la cama... La relajación sube por tus tobillos... tus piernas... como una ola cálida... Todo tu cuerpo descansa... Tu mente desciende... como una pluma... suavemente... en paz profunda... Estás bajando... más profundo... más relajado... Aquí solo existe la paz... el silencio... la calma... Eres sueño... eres descanso... Deja que las imágenes del día se desvanezcan... como niebla... Mañana despertarás renovado... lleno de energía... en paz...`,
  ansiedad: `Cierra los ojos... respira profundamente... Siente cómo el aire fresco entra... y el aire caliente sale... llevando consigo toda la tensión... todo el estrés... como hojas que el viento se lleva... Tu corazón se calma... su ritmo se vuelve suave... como las olas del mar... La ansiedad es como una nube que pasa... Tú eres el cielo... inmenso... sereno... eterno... Una luz azul envuelve tu cuerpo... es protección... es seguridad... es calma... Eres fuerte... eres capaz... eres suficiente... Todo está bien en este momento... Estoy en calma... estoy seguro... estoy en paz...`,
  migrania: `Respira suavemente... con cada exhalación el dolor se hace más pequeño... como un globo que se desinfla... Tus hombros se sueltan... tu mandíbula se relaja... tu frente se alisa... Una luz azul brillante entra por tu cabeza... es fresca... como agua de manantial... Fluye por tu frente y la presión se alivia... por tus sienes y la pulsación se suaviza... El dolor se reduce... hasta que es solo un recuerdo lejano... Tu cabeza está libre... ligera... fresca...`,
  autoestima: `Respira profundamente... y siéntete más seguro... más fuerte... Suelta las dudas... como hojas secas que caen de un árbol... Una luz dorada emana de tu corazón... es tu poder interior... tu confianza... tu valor... Tú vales... tú importas... tú eres suficiente tal como eres... Eres digno de amor... digno de respeto... digno de éxito... No necesitas la aprobación de otros... tú te apruebas... tú te aceptas... tú te amas... profundamente...`,
  'dejar-fumar': `Respira profundo... muy profundo... Siente cómo tus pulmones se llenan de aire puro... aire que te da vida... Este aire es libertad... Con cada exhalación sueltas el deseo... la necesidad... el hábito... Ya no necesitas el cigarro... tu cuerpo está libre... tu mente está libre... Cada vez que piensas en fumar sientes rechazo... Eres libre del tabaco... más fuerte que cualquier hábito... Tus pulmones se limpian... tu energía vuelve...`,
  peso: `Respira suavemente... siéntete en control... Totalmente en control... Tu cuerpo es sabio... siempre lo ha sido... Suelta la culpa... suelta la presión... como cadenas que se rompen... Tú decides qué comes... cuánto comes... cuándo comes... Escucha a tu cuerpo... respétalo... ámalo... Comes para vivir... no vives para comer... Eres dueño de tus decisiones... de tu cuerpo... de tu salud...`,
  focus: `Respira profundo... muy profundo... Siente cómo llega la claridad... la concentración... Tu cuerpo se relaja pero tu mente se afila... como un cuchillo que se pule... Una luz blanca brillante enciende tu cerebro... Tu mente es como un rayo láser... enfocada... precisa... poderosa... Cuando te concentras nada te distrae... nada te detiene... Estás en flujo... en la zona... en tu mejor estado...`
};

// === RENDER HOME ===
function renderHome() {
  const c = $$('#page-home'); if (!c) return;
  c.innerHTML = '';
  let fav = Object.entries(sessions).filter(([id]) => favs.includes(id));
  let rest = Object.entries(sessions).filter(([id]) => !favs.includes(id));
  if (fav.length) { let t = el('div','section-title'); t.textContent = '⭐ Favoritos'; c.appendChild(t); }
  [...fav, ...rest].forEach(([id,s]) => {
    let d = el('div','card'); d.style.borderLeft = `3px solid ${s.c}`;
    let star = favs.includes(id) ? '⭐' : '☆';
    d.innerHTML = `<h3>${s.t}</h3><p>${s.s} · ${s.d} min</p><div style="position:absolute;top:8px;right:10px;cursor:pointer;z-index:2;font-size:.9em" onclick="event.stopPropagation();window._zmxToggleFav('${id}')">${star}</div>`;
    d.onclick = () => startSession(id);
    c.appendChild(d);
  });
}
window._zmxToggleFav = id => {
  let i = favs.indexOf(id);
  i >= 0 ? favs.splice(i,1) : favs.push(id);
  localStorage.zmx_fav = JSON.stringify(favs);
  renderHome();
};

// === RENDER VOICE GRID ===
function renderVoices(containerId) {
  let c = $$(`#${containerId}`);
  if (!c) return;
  c.innerHTML = '';
  voices.forEach(v => {
    let d = el('div','vcard');
    if (v.id === selVoice) d.classList.add('sel');
    d.innerHTML = `<div class="nm">${v.n}</div><div class="inf">${v.f} ${v.g}</div>`;
    d.onclick = () => { selVoice = v.id; ['vg-custom','vg-session'].forEach(renderVoices); };
    c.appendChild(d);
  });
}

// === RENDER SPEED ===
function renderSpeed(containerId) {
  let c = $$(`#${containerId}`);
  if (!c) return;
  c.innerHTML = '';
  ['-50%','-40%','-25%','-10%','+0%'].forEach(r => {
    let b = el('button','sopt');
    b.textContent = r; b.dataset.rate = r;
    if (r === selRate) b.classList.add('sel');
    b.onclick = () => {
      c.querySelectorAll('.sopt').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel'); selRate = r;
    };
    c.appendChild(b);
  });
}

// === RENDER BINAURAL GRID ===
function renderBinaurals() {
  let c = $$('#page-brain');
  if (!c) return;
  c.innerHTML = '<div class="section-title">🧠 Frecuencias Binaurales</div><div class="bgrid" id="binGrid"></div>';
  let g = $$('#binGrid');
  binaurals.forEach(b => {
    let d = el('div','bcard');
    if (activeBin === b.id) d.classList.add('active');
    d.innerHTML = `<div class="ic">${b.e}</div><div class="nm">${b.n}</div><div class="fr">${b.d}</div>`;
    d.onclick = () => toggleBin(b.id, d);
    g.appendChild(d);
  });
  // Volume
  let row = el('div','slider-row');
  row.style.margin = '8px 0';
  row.innerHTML = '<label>Volumen</label><input type="range" min="0" max="100" value="30" id="binVol"><span id="binVolV">30%</span>';
  c.appendChild(row);
  $$('#binVol', c).oninput = e => {
    if (bGain) bGain.gain.value = e.target.value / 100 * 0.3;
    $$('#binVolV').textContent = e.target.value + '%';
  };
  // Stop btn
  let sb = el('button','btn-outline'); sb.textContent = '🛑 Detener Binaural'; sb.onclick = stopBin;
  c.appendChild(sb);
}

// === RENDER CUSTOM PAGE ===
function renderCustom() {
  let c = $$('#page-custom');
  if (!c) return;
  c.innerHTML = `
    <div class="section-title">✨ Sesión Personalizada</div>
    <p style="font-size:.65em;color:var(--dim)">Escribe tu guion y genera audio</p>
    <div class="section-title">🗣️ Voz</div>
    <div class="voice-grid" id="vg-custom"></div>
    <div class="section-title">🐌 Velocidad</div>
    <div class="speed-bar" id="sp-custom"></div>
    <div class="slider-row"><label>Volumen</label><input type="range" id="cvVol" min="0" max="100" value="80"><span id="cvVolV">80%</span></div>
    <div class="section-title">📝 Guion</div>
    <textarea id="txCustom" placeholder="Escribe el guion de hipnosis... Usa ... para pausas."></textarea>
    <button class="btn-primary" id="btnCustom" onclick="window._zmxGenCustom()">🎙️ Generar Audio</button>
    <div id="customOut"></div>
  `;
  renderVoices('vg-custom');
  renderSpeed('sp-custom');
}

window._zmxGenCustom = () => {
  let tx = $$('#txCustom').value.trim();
  if (!tx) return alert('Escribe un guion primero');
  synth.cancel();
  let u = new SpeechSynthesisUtterance(tx);
  u.voice = synth.getVoices().find(v => v.name.includes(selVoice.split('-').pop())) || synth.getVoices()[0];
  u.lang = 'es-MX';
  let r = parseFloat(selRate) / 100;
  u.rate = 1 + r;
  u.volume = ($$('#cvVol').value || 80) / 100;
  u.pitch = 0.85;
  synth.speak(u);
  let out = $$('#customOut');
  out.innerHTML = '<p style="color:var(--accent);font-size:.7em;margin:6px 0">🔊 Reproduciendo...</p>';
  u.onend = () => { out.innerHTML = '<p style="color:var(--dim);font-size:.7em">✅ Completado</p>'; };
};

// === START SESSION ===
function startSession(id) {
  let s = sessions[id]; if (!s) return;
  curSes = id; secs = 0; playing = true;
  switchTab('session');
  renderSessionPage(id);
}

function renderSessionPage(id) {
  let c = $$('#page-session'); if (!c) return;
  let s = sessions[id];
  c.innerHTML = `
    <div class="zen-player">
      <div class="zen-circle playing" id="zenCircle">${s.t.split(' ').pop()}</div>
      <h3 style="margin:4px 0">${s.t}</h3>
      <p style="font-size:.62em;color:var(--dim)">${s.d} minutos</p>
    </div>
    <div class="timer" id="sesTimer">00:00</div>
    <div class="progress-bar"><div class="progress-fill" id="sesProg"></div></div>
    <div class="player-ctrls">
      <button class="stop-btn" onclick="window._zmxStopSes()">⏹</button>
      <button class="play-btn" id="sesPlayBtn" onclick="window._zmxToggleSes()">⏸</button>
      <button class="stop-btn" onclick="window._zmxRestartSes()">🔄</button>
    </div>
    <div class="section-title">🔊 Audio</div>
    <div class="slider-row"><label>Voz</label><input type="range" id="sesVoice" min="0" max="100" value="80"><span id="sesVoiceV">80%</span></div>
    <div class="slider-row"><label>Binaural</label><input type="range" id="sesBin" min="0" max="100" value="30"><span id="sesBinV">30%</span></div>
    <div class="section-title">⏱ Auto-stop</div>
    <div style="display:flex;gap:6px;justify-content:center" id="autoStopRow">
      <button class="sopt" style="font-size:.62em" data-min="5">5 min</button>
      <button class="sopt sel" style="font-size:.62em" data-min="0">∞</button>
      <button class="sopt" style="font-size:.62em" data-min="30">30 min</button>
    </div>
  `;
  // Start TTS
  playScript(id);
  // Timer
  startTimer();
  // Start binaural
  if (!activeBin) toggleBin('theta', null);
}

window._zmxToggleSes = () => {
  playing = !playing;
  let b = $$('#sesPlayBtn');
  b.textContent = playing ? '⏸' : '▶';
  if (playing) { synth.resume(); if (bCtx?.state === 'suspended') bCtx.resume(); startTimer(); }
  else { synth.pause(); if (bCtx) bCtx.suspend(); clearInterval(timer); }
};
window._zmxStopSes = () => { synth.cancel(); stopBin(); playing = false; clearInterval(timer); switchTab('home'); };
window._zmxRestartSes = () => { if (curSes) { synth.cancel(); playScript(curSes); secs = 0; } };

function playScript(id) {
  let txt = scripts[id]; if (!txt) return;
  synth.cancel();
  // Load voices
  let vs = synth.getVoices();
  if (!vs.length) { synth.onvoiceschanged = () => playScript(id); return; }
  let v = vs.find(x => x.name.includes('Jorge')) || vs.find(x => x.lang.startsWith('es')) || vs[0];
  // Split by sentences
  let parts = txt.split('...').filter(p => p.trim());
  let delay = 0;
  parts.forEach((part, i) => {
    let u = new SpeechSynthesisUtterance(part.trim());
    u.voice = v; u.lang = 'es-MX'; u.rate = 0.65; u.pitch = 0.8; u.volume = 0.85;
    setTimeout(() => {
      if (playing) synth.speak(u);
    }, delay);
    delay += part.length * 45; // aprox chars to ms
  });
  // Restart when done
  let totalMs = delay + 2000;
  setTimeout(() => {
    if (playing && curSes) playScript(id);
  }, totalMs);
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (!playing) return;
    secs++;
    let m = Math.floor(secs / 60), s = secs % 60;
    let el = $$('#sesTimer'); if (el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    let prog = $$('#sesProg');
    if (prog && curSes) {
      let dur = sessions[curSes].d * 60;
      prog.style.width = Math.min(100, (secs / dur) * 100) + '%';
    }
    // Auto-stop
    let asBtn = $$('#autoStopRow .sopt.sel');
    if (asBtn && asBtn.dataset.min !== '0' && secs >= parseInt(asBtn.dataset.min) * 60) {
      window._zmxStopSes();
      stats.sessions++; stats.minutes += Math.floor(secs/60);
      stats.last = new Date().toISOString().split('T')[0];
      if (stats.last !== (new Date(Date.now()-86400000)).toISOString().split('T')[0]) stats.streak = 0;
      else stats.streak++;
      localStorage.zmx_stats = JSON.stringify(stats);
    }
  }, 1000);
}

// === BINAURAL ===
function toggleBin(id, el) {
  if (activeBin === id) { stopBin(); return; }
  stopBin();
  let b = binaurals.find(x => x.id === id); if (!b) return;
  bCtx = new (window.AudioContext || window.webkitAudioContext)();
  let oL = bCtx.createOscillator(), oR = bCtx.createOscillator();
  bGain = bCtx.createGain();
  bGain.gain.value = (parseInt($$('#binVol')?.value || 30) / 100) * 0.3;
  oL.frequency.value = 200 + b.hz; oR.frequency.value = 200;
  oL.type = 'sine'; oR.type = 'sine';
  let mg = bCtx.createChannelMerger(2);
  bGain.connect(mg, 0, 0); bGain.connect(mg, 0, 1);
  mg.connect(bCtx.destination);
  oL.start(); oR.start();
  bOsc = {oL, oR}; activeBin = id;
  // Update viz
  if (window.ZENMIX?.setFrequency) window.ZENMIX.setFrequency(id);
  $$('#page-brain') && renderBinaurals();
}
function stopBin() {
  if (bOsc) { try { bOsc.oL.stop(); bOsc.oR.stop(); } catch(e){} bOsc = null; }
  if (bCtx) { bCtx.close().catch(()=>{}); bCtx = null; }
  bGain = null; activeBin = null;
  if (window.ZENMIX?.dispose) window.ZENMIX.dispose();
  $$('#page-brain') && renderBinaurals();
}

// === RECORD ===
let recStream = null, recMedia = null, recChunks = [], recActive = false, recSecs = 0, recTimer = null;
function renderRecord() {
  let c = $$('#page-record'); if (!c) return;
  c.innerHTML = `
    <div class="section-title">🎤 Grabadora</div>
    <div style="text-align:center;padding:8px 0">
      <button class="rec-btn" id="recBtn" onclick="window._zmxToggleRec()">🎙️</button>
      <div style="font-size:.85em;color:#f44336;margin:4px 0" id="recTime">00:00</div>
    </div>
    <div style="display:flex;gap:6px;justify-content:center" id="recActions" hidden>
      <button class="sopt" style="font-size:.62em" onclick="window._zmxPauseRec()">⏸ Pausar</button>
      <button class="sopt" style="font-size:.62em;border-color:var(--accent);color:var(--accent)" onclick="window._zmxSaveRec()">✅ Guardar</button>
    </div>
    <div id="recAudioBox"></div>
  `;
}

window._zmxToggleRec = async () => {
  if (recActive) { window._zmxSaveRec(); return; }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({audio: true});
    recMedia = new MediaRecorder(recStream, {mimeType: 'audio/webm;codecs=opus'});
    recChunks = []; recSecs = 0;
    recMedia.ondataavailable = e => recChunks.push(e.data);
    recMedia.onstop = () => {
      let blob = new Blob(recChunks, {type: 'audio/webm'});
      let url = URL.createObjectURL(blob);
      let box = $$('#recAudioBox');
      box.innerHTML = `<p style="font-size:.65em;color:var(--accent);margin:6px 0">✅ Grabado</p><audio controls src="${url}" style="width:100%"></audio><button class="btn-outline" onclick="this.previousElementSibling.src && (function(a){let lnk=document.createElement('a');lnk.href=a.src;lnk.download='zenmix_grabacion.webm';lnk.click()})(this.previousElementSibling)">⬇️ Descargar</button>`;
    };
    recMedia.start(); recActive = true;
    $$('#recBtn')?.classList.add('recording'); $$('#recBtn').textContent = '⏹';
    $$('#recActions').hidden = false;
    recTimer = setInterval(() => {
      recSecs++;
      let m = Math.floor(recSecs/60), s = recSecs % 60;
      let el = $$('#recTime'); if (el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
  } catch(e) { alert('Micrófono: ' + e.message); }
};

window._zmxPauseRec = () => {
  if (!recMedia) return;
  let b = $$('#recActions .sopt');
  if (recMedia.state === 'recording') { recMedia.pause(); clearInterval(recTimer); b.textContent = '▶ Reanudar'; }
  else { recMedia.resume(); b.textContent = '⏸ Pausar'; recTimer = setInterval(() => { recSecs++; let m=Math.floor(recSecs/60),s=recSecs%60; let e=$$('#recTime');if(e)e.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }, 1000); }
};

window._zmxSaveRec = () => {
  if (!recMedia) return;
  recActive = false; clearInterval(recTimer);
  recMedia.stop();
  recStream?.getTracks().forEach(t => t.stop());
  $$('#recBtn')?.classList.remove('recording'); $$('#recBtn').textContent = '🎙️';
  $$('#recActions').hidden = true;
};

// === STATS ===
function renderStats() {
  let c = $$('#page-stats'); if (!c) return;
  c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="num">${stats.sessions}</div><div class="lbl">Sesiones</div></div>
      <div class="stat-card"><div class="num">${stats.minutes}</div><div class="lbl">Minutos</div></div>
      <div class="stat-card"><div class="num">${stats.streak}🔥</div><div class="lbl">Racha</div></div>
    </div>
    <button class="btn-outline" onclick="localStorage.zmx_stats='{}';stats={sessions:0,minutes:0,streak:0,last:null};renderStats()">🗑️ Reset Stats</button>
  `;
}

// === NAVIGATION ===
function switchTab(t) {
  curTab = t;
  $$$('.tab-btn').forEach(b => b.classList.toggle('active', b.textContent.trim().startsWith(t === 'home' ? '🏠' : t === 'session' ? '🧘' : t === 'custom' ? '✨' : t === 'record' ? '🎤' : t === 'brain' ? '🧠' : t === 'stats' ? '📊' : '')));
  $$$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + t));

  if (t === 'home') renderHome();
  else if (t === 'brain') renderBinaurals();
  else if (t === 'custom') renderCustom();
  else if (t === 'record') renderRecord();
  else if (t === 'stats') renderStats();
}
window.switchTab = switchTab;

// === THEME ===
let prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
dark = localStorage.zmx_theme !== 'light';
if (!localStorage.zmx_theme && !prefersDark.matches) dark = false;

function applyTheme() {
  document.body.classList.toggle('light', !dark);
  let tb = $$('#themeBtn'); if (tb) tb.textContent = dark ? '🌙' : '☀️';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0a0a1a' : '#f0f0f8';
}
window.toggleTheme = () => { dark = !dark; localStorage.zmx_theme = dark ? 'dark' : 'light'; applyTheme(); };
prefersDark.addEventListener('change', e => { if (!localStorage.zmx_theme) { dark = e.matches; applyTheme(); } });
applyTheme();

// === INIT ===
function init() {
  // Preload voices
  synth.getVoices();
  synth.onvoiceschanged = () => synth.getVoices();

  // Init visualizer
  if (typeof THREE !== 'undefined' && window.ZENMIX) {
    window.ZENMIX.init();
  }

  // Start
  renderHome();
  renderCustom();
  renderBinaurals();
  renderRecord();
  renderStats();
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();
})();