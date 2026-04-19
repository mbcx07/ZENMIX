// ZENMIX — Complete Application Logic
const S = window.location.origin;
let curSession = null, playing = false, sAudio = null, binSesAudio = null, ambSesAudio = null;
let timerInt = null, secs = 0, autoStopTimer = null, animId = null;
let selVoice = 'es-MX-JorgeNeural', selRate = '-40%';
let favorites = JSON.parse(localStorage.getItem('zenmix_favs') || '[]');
let stats = JSON.parse(localStorage.getItem('zenmix_stats') || '{"sessions":0,"totalMinutes":0,"streak":0,"lastDate":null,"perSession":{}}');

// Onboarding
if (!localStorage.getItem('zenmix_onboard')) document.getElementById('onboard').style.display = 'flex';
function closeOnboard() { document.getElementById('onboard').style.display = 'none'; localStorage.setItem('zenmix_onboard', '1'); }

const sessions = {
  insomnio: { title: 'Insomnio', sub: 'Hipnosis profunda para dormir', emoji: '🌙', tags: ['30 min', 'Sueño'], color: '#4a6cf7' },
  ansiedad: { title: 'Ansiedad', sub: 'Calma tu mente y cuerpo', emoji: '😌', tags: ['20 min', 'Calma'], color: '#10b981' },
  migrania: { title: 'Migraña', sub: 'Alivio con frecuencias binaurales', emoji: '🤕', tags: ['25 min', 'Alivio'], color: '#8b5cf6' },
  autoestima: { title: 'Autoestima', sub: 'Confianza interior profunda', emoji: '💪', tags: ['20 min', 'Confianza'], color: '#f59e0b' },
  'dejar-fumar': { title: 'Dejar de Fumar', sub: 'Libérate del tabaco', emoji: '🚭', tags: ['25 min', 'Libertad'], color: '#ef4444' },
  peso: { title: 'Control de Peso', sub: 'Hábitos saludables', emoji: '⚖️', tags: ['20 min', 'Salud'], color: '#06b6d4' },
  focus: { title: 'Concentración', sub: 'Enfoque mental', emoji: '🎯', tags: ['15 min', 'Mente'], color: '#a855f7' }
};

const voices = [
  { id: 'es-MX-JorgeNeural', name: 'Jorge', lang: '🇲🇽', g: 'M', deep: true },
  { id: 'es-MX-DaliaNeural', name: 'Dalia', lang: '🇲🇽', g: 'F', deep: false },
  { id: 'es-ES-AlvaroNeural', name: 'Álvaro', lang: '🇪🇸', g: 'M', deep: true },
  { id: 'es-AR-TomasNeural', name: 'Tomás', lang: '🇦🇷', g: 'M', deep: true },
  { id: 'es-CO-GonzaloNeural', name: 'Gonzalo', lang: '🇨🇴', g: 'M', deep: true },
  { id: 'es-VE-SebastianNeural', name: 'Sebastián', lang: '🇻🇪', g: 'M', deep: true },
  { id: 'es-CL-LorenzoNeural', name: 'Lorenzo', lang: '🇨🇱', g: 'M', deep: true },
  { id: 'es-PE-AlexNeural', name: 'Alex', lang: '🇵🇪', g: 'M', deep: true },
  { id: 'es-US-AlonsoNeural', name: 'Alonso', lang: '🇺🇸', g: 'M', deep: true },
  { id: 'es-ES-ElviraNeural', name: 'Elvira', lang: '🇪🇸', g: 'F', deep: false },
  { id: 'es-ES-XimenaNeural', name: 'Ximena', lang: '🇪🇸', g: 'F', deep: false },
  { id: 'es-AR-ElenaNeural', name: 'Elena', lang: '🇦🇷', g: 'F', deep: false },
  { id: 'es-CO-SalomeNeural', name: 'Salomé', lang: '🇨🇴', g: 'F', deep: false },
  { id: 'es-PE-CamilaNeural', name: 'Camila', lang: '🇵🇪', g: 'F', deep: false },
  { id: 'es-US-PalomaNeural', name: 'Paloma', lang: '🇺🇸', g: 'F', deep: false },
];

const binaurals = [
  { id: 'delta', freq: 2, name: 'Delta', emoji: '😴', desc: 'Sueño profundo' },
  { id: 'theta', freq: 6, name: 'Theta', emoji: '🧠', desc: 'Meditación' },
  { id: 'alpha', freq: 10, name: 'Alfa', emoji: '✨', desc: 'Relajación' },
  { id: 'sigma', freq: 14, name: 'Sigma', emoji: '💡', desc: 'Enfoque' },
  { id: 'gamma', freq: 40, name: 'Gamma', emoji: '⚡', desc: 'Concentración' },
  { id: 'beta', freq: 20, name: 'Beta', emoji: '🔥', desc: 'Activación' }
];

const ambients = [
  { id: 'pad', name: 'Pad', emoji: '🎵', desc: 'Ambiente suave' },
  { id: 'rain', name: 'Lluvia', emoji: '🌧', desc: 'Lluvia' },
  { id: 'ocean', name: 'Océano', emoji: '🌊', desc: 'Olas' },
  { id: 'forest', name: 'Bosque', emoji: '🌲', desc: 'Naturaleza' },
  { id: 'fire', name: 'Fuego', emoji: '🔥', desc: 'Leña' },
  { id: 'wind', name: 'Viento', emoji: '💨', desc: 'Brisa' }
];

const presets = {
  estudio: { reverb: 50, echo: 10, bass: 30, name: '🎙️ Estudio' },
  cueva: { reverb: 80, echo: 40, bass: 60, name: '🕳️ Cueva' },
  bosque: { reverb: 30, echo: 5, bass: 20, name: '🌲 Bosque' },
  radio: { reverb: 15, echo: 0, bass: 10, name: '📻 Radio' },
};

// ─── THEME (auto dark/light + toggle) ────────────────────────
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
let darkMode = localStorage.getItem('zenmix_theme') !== 'light';
if (!localStorage.getItem('zenmix_theme') && !prefersDark.matches) darkMode = false;

function applyTheme() {
  document.body.classList.toggle('light', !darkMode);
  document.getElementById('themeBtn').textContent = darkMode ? '🌙' : '☀️';
  document.querySelector('meta[name="theme-color"]').content = darkMode ? '#0a0a1a' : '#f0f0f8';
}
applyTheme();

function toggleTheme() {
  darkMode = !darkMode;
  localStorage.setItem('zenmix_theme', darkMode ? 'dark' : 'light');
  applyTheme();
}

prefersDark.addEventListener('change', e => {
  if (!localStorage.getItem('zenmix_theme')) { darkMode = e.matches; applyTheme(); }
});

// ─── TABS ─────────────────────────────────────────────────────
function showTab(i) {
  document.querySelectorAll('.tab').forEach((t, j) => t.classList.toggle('active', j === i));
  ['homeScreen', 'recordScreen', 'customScreen', 'binauralScreen', 'statsScreen'].forEach((id, j) =>
    document.getElementById(id).classList.toggle('active', j === i)
  );
  document.getElementById('sessionScreen').classList.remove('active');
  if (i === 4) loadStatsUI();
}

// ─── VOICES ───────────────────────────────────────────────────
function renderV(cid) {
  const c = document.getElementById(cid);
  if (!c) return;
  c.innerHTML = '';
  voices.forEach(v => {
    const d = document.createElement('div');
    d.className = 'vcard' + (selVoice === v.id ? ' sel' : '');
    d.innerHTML = '<div class="nm">' + v.name + '</div><div class="inf">' + v.lang + ' ' + v.g + '</div>' + (v.deep ? '<div class="dp">🎙️ Grave</div>' : '');
    d.onclick = () => { selVoice = v.id; ['voiceGrid', 'sessionVoiceGrid', 'recVoiceGrid'].forEach(renderV); };
    c.appendChild(d);
  });
}
['voiceGrid', 'sessionVoiceGrid', 'recVoiceGrid'].forEach(renderV);

// ─── SPEED ────────────────────────────────────────────────────
function initSpd(cid) {
  const c = document.getElementById(cid);
  c.querySelectorAll('.sopt').forEach(b => b.onclick = () => {
    c.querySelectorAll('.sopt').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
    selRate = b.dataset.rate;
  });
}
['speedOpts', 'sessionSpeedOpts', 'recSpeedOpts'].forEach(initSpd);

// ─── PRESETS ───────────────────────────────────────────────────
function renderPresets(cid, rId, eId, bId) {
  const c = document.getElementById(cid);
  if (!c) return;
  c.innerHTML = '';
  Object.entries(presets).forEach(([k, v]) => {
    const b = document.createElement('button');
    b.className = 'preset-btn';
    b.textContent = v.name;
    b.onclick = () => {
      c.querySelectorAll('.preset-btn').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      const r = document.getElementById(rId), e = document.getElementById(eId), bs = document.getElementById(bId);
      if (r) { r.value = v.reverb; const rl = document.getElementById(rId + 'Val'); if (rl) rl.textContent = v.reverb + '%'; }
      if (e) { e.value = v.echo; const el = document.getElementById(eId + 'Val'); if (el) el.textContent = v.echo + '%'; }
      if (bs) { bs.value = v.bass; const bl = document.getElementById(bId + 'Val'); if (bl) bl.textContent = v.bass + '%'; }
    };
    c.appendChild(b);
  });
}
renderPresets('customPresets', 'reverbSlider', 'echoSlider', 'bassSlider');
renderPresets('sessionPresets', 'sessionReverb', 'sessionEcho', 'sessionBass');
renderPresets('recPresets', 'recReverb', 'recEcho', 'recBass');

// ─── SLIDERS ──────────────────────────────────────────────────
document.querySelectorAll('input[type=range]').forEach(s => {
  const span = document.getElementById(s.id + 'Val');
  if (span && !s.oninput) s.oninput = () => {
    if (s.id.includes('Pitch')) span.textContent = s.value + 'Hz';
    else if (s.id.includes('Start') || s.id.includes('End')) span.textContent = s.value + 's';
    else span.textContent = s.value + '%';
  };
});

// ─── HOME (with favorites) ─────────────────────────────────────
function renderHome() {
  const c = document.getElementById('homeScreen');
  c.innerHTML = '';
  const favEntries = Object.entries(sessions).filter(([id]) => favorites.includes(id));
  const otherEntries = Object.entries(sessions).filter(([id]) => !favorites.includes(id));
  if (favEntries.length) {
    const t = document.createElement('div'); t.className = 'stitle'; t.textContent = '⭐ Favoritos'; c.appendChild(t);
  }
  [...favEntries, ...otherEntries].forEach(([id, s]) => {
    const d = document.createElement('div');
    d.className = 'card';
    d.onclick = () => startSession(id);
    const isFav = favorites.includes(id);
    d.innerHTML = '<div class="session-color" style="background:' + s.color + '"></div>' +
      '<div class="fav-star ' + (isFav ? 'active' : '') + '" onclick="event.stopPropagation();toggleFav(\'' + id + '\')">' + (isFav ? '⭐' : '☆') + '</div>' +
      '<h3>' + s.emoji + ' ' + s.title + '</h3><p>' + s.sub + '</p>' +
      '<div class="tags">' + s.tags.map(t => '<span class="tag">' + t + '</span>').join('') + '</div>';
    c.appendChild(d);
  });
}
renderHome();

function toggleFav(id) {
  const i = favorites.indexOf(id);
  if (i >= 0) favorites.splice(i, 1); else favorites.push(id);
  localStorage.setItem('zenmix_favs', JSON.stringify(favorites));
  renderHome();
}

// ─── BINAURAL PLAYER (Web Audio API) ─────────────────────────
let bCtx = null, bOsc = null, bGain = null, activeBin = null;
const bg = document.getElementById('binauralGrid');
binaurals.forEach(b => {
  const d = document.createElement('div');
  d.className = 'bcard'; d.id = 'bin-' + b.id;
  d.innerHTML = '<div class="ic">' + b.emoji + '</div><div class="nm">' + b.name + '</div><div class="fr">' + b.desc + '</div>';
  d.onclick = () => toggleBin(b.id, d);
  bg.appendChild(d);
});

function toggleBin(id, el) {
  if (activeBin === id) { stopAllAudio(); return; }
  stopAllAudio();
  const b = binaurals.find(x => x.id === id);
  bCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oL = bCtx.createOscillator(), oR = bCtx.createOscillator();
  const mg = bCtx.createChannelMerger(2);
  bGain = bCtx.createGain();
  bGain.gain.value = document.getElementById('binVolume').value / 100 * 0.3;
  oL.frequency.value = 200 + b.freq; oR.frequency.value = 200;
  oL.connect(bGain); oR.connect(bGain);
  bGain.connect(mg, 0, 0); bGain.connect(mg, 0, 1);
  mg.connect(bCtx.destination);
  oL.start(); oR.start();
  bOsc = { oL, oR }; activeBin = id;
  document.querySelectorAll('.bcard').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('binControls').style.display = 'block';
  document.getElementById('binPlaying').style.display = 'block';
  document.getElementById('binCircle').textContent = b.emoji;
  document.getElementById('binLabel').textContent = b.name + ' ' + b.freq + 'Hz — ' + b.desc;
  startMandala('mandalaCanvas');
}

document.getElementById('binVolume').oninput = e => { if (bGain) bGain.gain.value = e.target.value / 100 * 0.3; };

// ─── AMBIENT SOUNDS (server-side generated WAV) ──────────────
let activeAmb = null, ambAudio = null;
const ag = document.getElementById('ambientGrid');
ambients.forEach(a => {
  const d = document.createElement('div');
  d.className = 'bcard'; d.id = 'amb-' + a.id;
  d.innerHTML = '<div class="ic">' + a.emoji + '</div><div class="nm">' + a.name + '</div><div class="fr">' + a.desc + '</div>';
  d.onclick = () => toggleAmb(a.id, d);
  ag.appendChild(d);
});

function toggleAmb(id, el) {
  if (activeAmb === id) { stopAmb(); return; }
  stopAmb();
  activeAmb = id;
  document.querySelectorAll('#ambientGrid .bcard').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('ambControls').style.display = 'block';
  ambAudio = new Audio(S + '/api/ambient/' + id + '?duration=300');
  ambAudio.volume = document.getElementById('ambVolume').value / 100;
  ambAudio.loop = true;
  ambAudio.play().catch(() => {});
}

function stopAmb() {
  if (ambAudio) { ambAudio.pause(); ambAudio = null; }
  activeAmb = null;
  document.querySelectorAll('#ambientGrid .bcard').forEach(c => c.classList.remove('active'));
  document.getElementById('ambControls').style.display = 'none';
}

document.getElementById('ambVolume').oninput = e => { if (ambAudio) ambAudio.volume = e.target.value / 100; };

function stopAllAudio() {
  if (bOsc) { bOsc.oL.stop(); bOsc.oR.stop(); }
  if (bCtx) bCtx.close();
  bOsc = null; bCtx = null; activeBin = null;
  stopAmb();
  document.querySelectorAll('.bcard').forEach(c => c.classList.remove('active'));
  document.getElementById('binControls').style.display = 'none';
  document.getElementById('ambControls').style.display = 'none';
  document.getElementById('binPlaying').style.display = 'none';
  stopMandala();
}

// ─── MANDALA VISUALIZATION ───────────────────────────────────
function startMandala(cid) {
  const cv = document.getElementById(cid);
  if (!cv) return;
  cv.style.display = 'block';
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height, cx = w / 2, cy = h / 2;
  let angle = 0;
  const colors = ['#a78bfa', '#7c3aed', '#4ecdc4', '#f093fb', '#ffd700'];
  function draw() {
    angle += 0.008;
    ctx.fillStyle = document.body.classList.contains('light') ? 'rgba(245,245,245,0.12)' : 'rgba(10,10,26,0.12)';
    ctx.fillRect(0, 0, w, h);
    for (let ring = 0; ring < 5; ring++) {
      const r = 12 + ring * 14, n = 6 + ring * 2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = angle * (ring % 2 ? 1 : -1.3) + (Math.PI * 2 / n) * i;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        ctx.moveTo(x, y); ctx.arc(x, y, 2 + ring, 0, Math.PI * 2);
      }
      ctx.fillStyle = colors[ring % colors.length] + '50';
      ctx.fill();
    }
    animId = requestAnimationFrame(draw);
  }
  draw();
}

function stopMandala() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
}

// ─── SESSION PLAYER ──────────────────────────────────────────
function startSession(id) {
  const s = sessions[id]; if (!s) return;
  curSession = id;
  document.getElementById('sessionTitle').textContent = s.emoji + ' ' + s.title;
  document.getElementById('sessionSub').textContent = s.sub;
  document.getElementById('breatheCircle').textContent = s.emoji;
  document.getElementById('breatheCircle').style.borderColor = s.color;
  document.getElementById('timer').textContent = '00:00';
  secs = 0;
  document.getElementById('progressFill').style.width = '0%';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('sessionScreen').classList.add('active');
  startMandala('vizCanvas');
}

async function togglePlay() {
  if (playing) {
    playing = false;
    document.getElementById('playBtn').textContent = '▶';
    document.getElementById('breatheCircle').classList.remove('playing');
    if (sAudio) sAudio.pause();
    if (binSesAudio) binSesAudio.pause();
    if (ambSesAudio) ambSesAudio.pause();
    clearInterval(timerInt);
    return;
  }

  playing = true;
  document.getElementById('playBtn').textContent = '⏳';
  document.getElementById('breatheCircle').classList.add('playing');

  timerInt = setInterval(() => {
    secs++;
    document.getElementById('timer').textContent =
      String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
    if (sAudio && sAudio.duration && !isNaN(sAudio.duration)) {
      document.getElementById('progressFill').style.width = (sAudio.currentTime / sAudio.duration * 100) + '%';
    }
  }, 1000);

  // Fetch voice audio
  sAudio = null;
  const voice = selVoice, rate = selRate;
  const pitch = document.getElementById('sessionPitch').value + 'Hz';
  const reverb = document.getElementById('sessionReverb').value;
  const echo = document.getElementById('sessionEcho').value;
  const bass = document.getElementById('sessionBass').value;

  try {
    const url = S + '/api/hypnosis/' + curSession +
      '?voice=' + encodeURIComponent(voice) +
      '&rate=' + encodeURIComponent(rate) +
      '&pitch=' + encodeURIComponent(pitch) +
      '&reverb=' + reverb + '&echo=' + echo + '&bass=' + bass;
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      sAudio = new Audio(URL.createObjectURL(blob));
      sAudio.volume = document.getElementById('mixVoiceVol').value / 100;

      // Crossfade loop: on ended, restart immediately
      sAudio.onended = () => {
        if (playing) { sAudio.currentTime = 0; sAudio.play().catch(() => {}); }
        else { stopSession(); }
      };

      await sAudio.play();
    } else { playing = false; document.getElementById('playBtn').textContent = '▶'; return; }
  } catch (e) {
    console.error('Audio error:', e);
    playing = false;
    document.getElementById('playBtn').textContent = '▶';
    return;
  }

  // Start binaural audio if selected
  const binType = document.getElementById('sessionBinType').value;
  if (binType) {
    binSesAudio = new Audio(S + '/api/binaural/' + binType + '?duration=600');
    binSesAudio.volume = document.getElementById('mixBinVol').value / 100;
    binSesAudio.loop = true;
    binSesAudio.play().catch(() => {});
  }

  // Start ambient audio
  const ambType = document.getElementById('sessionAmbType').value;
  if (ambType) {
    ambSesAudio = new Audio(S + '/api/ambient/' + ambType + '?duration=600');
    ambSesAudio.volume = document.getElementById('mixAmbVol').value / 100;
    ambSesAudio.loop = true;
    ambSesAudio.play().catch(() => {});
  }

  document.getElementById('playBtn').textContent = '⏸';
  recordStats();
}

// Real-time mixer controls
document.getElementById('mixVoiceVol').oninput = e => {
  document.getElementById('mixVoiceVolVal').textContent = e.target.value + '%';
  if (sAudio) sAudio.volume = e.target.value / 100;
};
document.getElementById('mixBinVol').oninput = e => {
  document.getElementById('mixBinVolVal').textContent = e.target.value + '%';
  if (binSesAudio) binSesAudio.volume = e.target.value / 100;
};
document.getElementById('mixAmbVol').oninput = e => {
  document.getElementById('mixAmbVolVal').textContent = e.target.value + '%';
  if (ambSesAudio) ambSesAudio.volume = e.target.value / 100;
};

function seekAudio(e) {
  if (!sAudio || !sAudio.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  sAudio.currentTime = ((e.clientX - r.left) / r.width) * sAudio.duration;
}

function setAutoStop() {
  const min = parseInt(document.getElementById('autoStopMin').value);
  if (!min || min < 1) return;
  if (autoStopTimer) clearTimeout(autoStopTimer);
  autoStopTimer = setTimeout(() => {
    stopSession();
    document.getElementById('autoStopLabel').textContent = '⏲ Apagado';
  }, min * 60000);
  document.getElementById('autoStopLabel').textContent = '⏲ ' + min + ' min';
}

function stopSession() {
  playing = false;
  if (sAudio) { sAudio.pause(); sAudio.currentTime = 0; sAudio = null; }
  if (binSesAudio) { binSesAudio.pause(); binSesAudio = null; }
  if (ambSesAudio) { ambSesAudio.pause(); ambSesAudio = null; }
  clearInterval(timerInt); secs = 0;
  if (autoStopTimer) { clearTimeout(autoStopTimer); autoStopTimer = null; }
  document.getElementById('playBtn').textContent = '▶';
  document.getElementById('breatheCircle').classList.remove('playing');
  document.getElementById('sessionScreen').classList.remove('active');
  document.getElementById('homeScreen').classList.add('active');
  stopMandala();
  document.getElementById('vizCanvas').style.display = 'none';
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.getElementById('autoStopLabel').textContent = '';
}

function recordStats() {
  stats.sessions++;
  stats.totalMinutes += 1;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (stats.lastDate !== today) {
    stats.streak = (stats.lastDate === yesterday) ? stats.streak + 1 : 1;
    stats.lastDate = today;
  }
  if (curSession) stats.perSession[curSession] = (stats.perSession[curSession] || 0) + 1;
  localStorage.setItem('zenmix_stats', JSON.stringify(stats));
}

function downloadSession() {
  const voice = selVoice, rate = selRate;
  const pitch = document.getElementById('sessionPitch').value + 'Hz';
  const reverb = document.getElementById('sessionReverb').value;
  const echo = document.getElementById('sessionEcho').value;
  const bass = document.getElementById('sessionBass').value;
  window.open(S + '/api/hypnosis/' + curSession +
    '?voice=' + encodeURIComponent(voice) +
    '&rate=' + encodeURIComponent(rate) +
    '&pitch=' + encodeURIComponent(pitch) +
    '&reverb=' + reverb + '&echo=' + echo + '&bass=' + bass + '&download=true', '_blank');
}

// ─── STATS ────────────────────────────────────────────────────
function loadStatsUI() {
  const g = document.getElementById('statsGrid');
  g.innerHTML = '<div class="stat-card"><div class="num">' + stats.sessions + '</div><div class="lbl">Sesiones</div></div>' +
    '<div class="stat-card"><div class="num">' + stats.totalMinutes + '</div><div class="lbl">Minutos</div></div>' +
    '<div class="stat-card"><div class="num">' + stats.streak + '</div><div class="lbl">Racha 🔥</div></div>';
  document.getElementById('streakInfo').textContent = stats.lastDate ? 'Última sesión: ' + stats.lastDate : '¡Empieza tu primera sesión!';
  const c = document.getElementById('sessionCounts'); c.innerHTML = '';
  Object.entries(sessions).forEach(([id, s]) => {
    const count = stats.perSession[id] || 0;
    if (count > 0) {
      const d = document.createElement('div'); d.className = 'card';
      d.innerHTML = '<h3>' + s.emoji + ' ' + s.title + ': ' + count + ' veces</h3>';
      c.appendChild(d);
    }
  });
}

function shareApp() {
  if (navigator.share) {
    navigator.share({ title: 'ZENMIX — Hipnosis Subliminal', text: 'Prueba ZENMIX: hipnosis con binaurales y efectos de estudio', url: S }).catch(() => {});
  } else {
    navigator.clipboard.writeText(S).then(() => alert('Link copiado: ' + S));
  }
}

// ─── CUSTOM TTS ──────────────────────────────────────────────
async function generateCustom() {
  const script = document.getElementById('customScript').value.trim();
  if (!script) { alert('Escribe un guion'); return; }
  const voice = selVoice, rate = selRate;
  const pitch = document.getElementById('pitchSlider').value + 'Hz';
  const reverb = document.getElementById('reverbSlider').value;
  const echo = document.getElementById('echoSlider').value;
  const bass = document.getElementById('bassSlider').value;
  document.getElementById('generateBtn').disabled = true;
  document.getElementById('generating').classList.add('active');
  document.getElementById('customResult').style.display = 'none';
  try {
    const res = await fetch(S + '/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: script, voice, rate, pitch, reverb, echo, bass })
    });
    if (res.ok) {
      const blob = await res.blob();
      document.getElementById('customAudio').src = URL.createObjectURL(blob);
      document.getElementById('customResult').style.display = 'block';
    } else { const err = await res.json(); alert('Error: ' + err.error); }
  } catch (e) { alert('Error: ' + e.message); }
  document.getElementById('generateBtn').disabled = false;
  document.getElementById('generating').classList.remove('active');
}

function dlCustom() {
  const script = document.getElementById('customScript').value.trim();
  const voice = selVoice, rate = selRate;
  const pitch = document.getElementById('pitchSlider').value + 'Hz';
  const reverb = document.getElementById('reverbSlider').value;
  const echo = document.getElementById('echoSlider').value;
  const bass = document.getElementById('bassSlider').value;
  fetch(S + '/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: script, voice, rate, pitch, reverb, echo, bass, download: true })
  }).then(r => r.blob()).then(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = 'zenmix_custom.mp3'; a.click();
  });
}

// ─── VOICE RECORDER (with pause/resume, multiple takes) ──────
let mediaRec = null, audioChunks = [], recording = false, recSec = 0, recInt = null, uploadedId = null, takes = [];

async function toggleRecord() {
  const btn = document.getElementById('recBtn');
  if (recording) { stopAndSave(); } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunks = [];
      mediaRec.ondataavailable = e => audioChunks.push(e.data);
      mediaRec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'take_' + takes.length + '.webm');
        try {
          const res = await fetch(S + '/api/upload-voice', { method: 'POST', body: fd });
          const data = await res.json();
          takes.push({ id: data.id, url: URL.createObjectURL(blob), sec: recSec });
          uploadedId = data.id;
          document.getElementById('recAudio').src = URL.createObjectURL(blob);
          document.getElementById('recResult').style.display = 'block';
          document.getElementById('noRec').style.display = 'none';
          renderTakes();
        } catch (e) { alert('Error: ' + e.message); }
      };
      recording = true;
      btn.classList.add('recording'); btn.textContent = '⏹';
      recSec = 0; document.getElementById('recTime').textContent = '00:00';
      recInt = setInterval(() => {
        recSec++;
        document.getElementById('recTime').textContent =
          String(Math.floor(recSec / 60)).padStart(2, '0') + ':' + String(recSec % 60).padStart(2, '0');
      }, 1000);
      document.getElementById('recActions').style.display = 'flex';
      mediaRec.start();
    } catch (e) { alert('Micrófono: ' + e.message); }
  }
}

function pauseRecord() {
  if (!mediaRec) return;
  const btn = document.getElementById('pauseBtn');
  if (mediaRec.state === 'recording') { mediaRec.pause(); btn.textContent = '▶ Continuar'; }
  else if (mediaRec.state === 'paused') { mediaRec.resume(); btn.textContent = '⏸ Pausar'; }
}

function stopAndSave() {
  if (!mediaRec || !recording) return;
  recording = false;
  document.getElementById('recBtn').classList.remove('recording');
  document.getElementById('recBtn').textContent = '🎙️';
  document.getElementById('recActions').style.display = 'none';
  clearInterval(recInt);
  mediaRec.stop();
}

function renderTakes() {
  const c = document.getElementById('takesGrid'); c.innerHTML = '';
  if (!takes.length) { document.getElementById('takesList').style.display = 'none'; return; }
  document.getElementById('takesList').style.display = 'block';
  takes.forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'take-card' + (uploadedId === t.id ? ' sel' : '');
    const m = Math.floor(t.sec / 60), s = t.sec % 60;
    d.innerHTML = '<span class="tn">🎙️' + (i + 1) + '</span><span class="ti">' + m + ':' + String(s).padStart(2, '0') + '</span>';
    d.onclick = () => {
      uploadedId = t.id;
      document.getElementById('recAudio').src = t.url;
      document.getElementById('recResult').style.display = 'block';
      renderTakes();
    };
    c.appendChild(d);
  });
}

async function processRecording() {
  if (!uploadedId) { alert('Graba primero'); return; }
  const reverb = document.getElementById('recReverb').value;
  const echo = document.getElementById('recEcho').value;
  const bass = document.getElementById('recBass').value;
  const pitch = document.getElementById('recPitch').value;
  const trimStart = document.getElementById('trimStart').value;
  const trimEnd = document.getElementById('trimEnd').value;
  document.querySelector('#recordScreen .gen-btn').disabled = true;
  document.getElementById('procRecLoading').classList.add('active');
  document.getElementById('procRecResult').style.display = 'none';
  try {
    const res = await fetch(S + '/api/process-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: uploadedId, echo, reverb, bass, pitch, trimStart, trimEnd })
    });
    if (res.ok) {
      const blob = await res.blob();
      document.getElementById('procRecAudio').src = URL.createObjectURL(blob);
      document.getElementById('procRecResult').style.display = 'block';
    } else { const err = await res.json(); alert('Error: ' + err.error); }
  } catch (e) { alert('Error: ' + e.message); }
  document.querySelector('#recordScreen .gen-btn').disabled = false;
  document.getElementById('procRecLoading').classList.remove('active');
}

function dlProcessed() {
  if (!uploadedId) return;
  const reverb = document.getElementById('recReverb').value;
  const echo = document.getElementById('recEcho').value;
  const bass = document.getElementById('recBass').value;
  const pitch = document.getElementById('recPitch').value;
  fetch(S + '/api/process-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: uploadedId, echo, reverb, bass, pitch, download: true })
  }).then(r => r.blob()).then(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = 'zenmix_voz_editada.mp3'; a.click();
  });
}

// ─── PWA SERVICE WORKER ───────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ─── NOTIFICATION REMINDER ────────────────────────────────────
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}