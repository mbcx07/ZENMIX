const express = require('express');
const path = require('path');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ dest: '/tmp/zenmix_uploads/', limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Progressive Hypnosis Scripts ────────────────────────────
const scripts = {
  insomnio: `[Relajación]
Respira... profundamente... Siente cómo el aire entra por tu nariz... lentamente... llenando tus pulmones... y luego... suéltalo suavemente... por la boca... Una vez más... inhala... y exhala... Con cada respiración... tu cuerpo se vuelve más pesado... más relajado... Siente cómo tus pies... se hunden en la cama... como si flotaras en agua tibia... La relajación sube por tus tobillos... tus pantorrillas... tus rodillas... como una ola cálida que recorre tu cuerpo... Tus muslos se relajan... tu abdomen se suaviza... siente cómo la tensión se derrite... como cera de vela... Tu espalda descansa contra la cama... tus hombros caen suavemente... el cuello se suelta... Y ahora... deja que tu mente descienda... como una pluma que cae... suavemente... lentamente... en un lugar de paz profunda...

[Profundización]
Estás bajando... un escalón... más profundo... dos escalones... más relajado... tres escalones... en el lugar más tranquilo de tu mente... Cuatro... más profundo... cinco... más y más relajado... Seis... cada músculo suelto... siete... cada pensamiento sereno... ocho... flotando en calma... nueve... casi allí... diez... completamente en paz... Aquí... solo existe la paz... el silencio... la calma...

[Sugestión]
Eres sueño... eres descanso... eres renovación... Deja que las imágenes del día se desvanezcan... como niebla que se levanta... Tu mente está vacía... serena... abierta al descanso... Cada noche... te será más fácil dormir... más fácil descansar... más fácil soltar el día... Cuando te acuestas... tu cuerpo sabe... que es hora de descansar... y te rindes... suavemente... naturalmente... Mañana despertarás renovado... lleno de energía... con una sonrisa en el alma...

[Emergencia]
En un momento... contaré del uno al cinco... y despertarás... renovado... Uno... tu cuerpo empieza a despertar... Dos... tu respiración se vuelve más activa... Tres... sientes tu cuerpo ligero y fresco... Cuatro... tu mente está clara... Cinco... completamente despierto... renovado... en paz...`,

  ansiedad: `[Relajación]
Cierra los ojos... respira profundamente... Siente cómo el aire fresco entra... y el aire caliente sale... Llevando consigo... toda la tensión... todo el estrés... como hojas que el viento se lleva... Cuenta mentalmente... inhala en uno... sostén en dos... exhala en tres... Uno... dos... tres... Siente cómo tu corazón se calma... su ritmo se vuelve suave... constante... como las olas del mar... que van y vienen... sin prisa... sin pausa... La ansiedad es como una nube... que pasa por el cielo de tu mente... Tú eres el cielo... inmenso... sereno... eterno...

[Profundización]
Imagina una luz azul... que envuelve todo tu cuerpo... Esta luz es protección... es seguridad... es calma... Fluye por tu pecho... disolviendo el nudo... por tu estómago... relajando el vacío... por tu garganta... soltando las palabras no dichas... Con cada respiración... la luz se hace más intensa... más brillante... y tú... más profundo... más sereno... más en paz... Te hundes en esta luz... como en un océano de calma...

[Sugestión]
Eres fuerte... eres capaz... eres suficiente... Todo está bien... en este momento... todo está bien... La ansiedad es solo temporal... viene y va... como las nubes en el cielo... pero tú permaneces... en calma... en paz... Repite internamente... estoy en calma... estoy seguro... estoy en paz... Tu sistema nervioso se equilibra... se fortalece... cada día más... cada día mejor...

[Emergencia]
Ahora... cuento del uno al cinco... y regresas... renovado... en calma... Uno... sientes tus pies en el suelo... Dos... tu cuerpo está relajado pero presente... Tres... respiras profundo... sin ansiedad... Cuatro... tu mente está clara... Cinco... completamente despierto... en paz...`,

  migrania: `[Relajación]
Respira suavemente... y con cada exhalación... imagina que el dolor... se hace más pequeño... más pequeño... como un globo que se desinfla lentamente... Siente cómo tus hombros se sueltan... tu mandíbula se relaja... tu frente se alisa... como si una mano invisible... acariciara tu cabeza... quitando toda la tensión... toda la presión...

[Profundización]
Ahora... visualiza una luz azul brillante... que entra por la parte superior de tu cabeza... Esta luz es fresca... como agua de manantial... como brisa de montaña... Fluye por tu frente... y sientes cómo la presión se alivia... Por tus sienes... y la pulsación se suaviza... Te hundes en esta luz... más profundo... más aliviado... más libre...

[Sugestión]
La luz azul recorre tu cabeza entera... como un casco fresco y protector... Cada célula se baña en esta luz curativa... El dolor se reduce... se reduce... hasta que es solo un recuerdo lejano... Tu cabeza está libre... ligera... fresca... como si la hubieras sumergido en agua fresca... Y ahora... la luz se convierte en dorada... y llena tu cuerpo de energía renovada... de vitalidad... de bienestar...

[Emergencia]
En un momento... contaré del uno al cinco... y abrirás los ojos... sin dolor... Uno... la luz se integra en ti... Dos... sientes tu cabeza ligera... Tres... tu cuerpo está relajado... Cuatro... respiras sin molestia... Cinco... completamente despierto... sin dolor... libre...`,

  autoestima: `[Relajación]
Respira profundamente... y con cada respiración... siéntete más seguro... más fuerte... más presente... Suelta las tensiones... suelta las dudas... como si fueran hojas secas... que caen de un árbol... Tu cuerpo se relaja... pie a cabeza... cada músculo se suelta... cada hueso descansa... Estás en un lugar seguro... un lugar donde nadie te juzga... donde puedes ser... completamente tú...

[Profundización]
Imagina una luz dorada... que emana de tu corazón... Esta luz es tu poder interior... tu confianza... tu valor... Se expande... te envuelve... te transforma... Con cada respiración... la luz se hace más intensa... más brillante... Te hundes en esta luz... como en un océano de autoestima... de seguridad... de amor propio... Cada capa de duda se disuelve...

[Sugestión]
Tú vales... tú importas... tú eres suficiente... tal como eres... No necesitas ser diferente... ya eres completo... Eres digno de amor... digno de respeto... digno de éxito... Cada día te vuelves más seguro... más decidido... más auténtico... No necesitas la aprobación de otros... tú te apruebas... tú te aceptas... tú te amas... profundamente... sin condiciones...

[Emergencia]
Ahora... cuento del uno al cinco... y despiertas... sintiéndote poderoso... Uno... la luz dorada permanece en ti... Dos... te sientes más fuerte... Tres... tu corazón late con confianza... Cuatro... abres los ojos... y te ves con amor... Cinco... completamente despierto... seguro... valioso... listo para brillar...`,

  'dejar-fumar': `[Relajación]
Respira profundo... muy profundo... Siente cómo tus pulmones se llenan... de aire puro... aire limpio... aire que te da vida... Este aire es tuyo... te pertenece... es libertad... Con cada exhalación... sueltas el deseo... la necesidad... el hábito... Tu cuerpo se relaja... cada célula respira... cada célula celebra el aire limpio...

[Profundización]
Imagínate caminando... por un bosque fresco... el aire huele a pinos... a tierra mojada... a libertad... Con cada paso... te alejas más del cigarro... más de la nicotina... más de la esclavitud... El camino es hermoso... y cada paso te lleva a un lugar mejor... un lugar donde no hay humo... donde el aire es puro... donde eres libre... Te hundes en esta sensación de libertad...

[Sugestión]
Ya no necesitas el cigarro... tu cuerpo está libre... tu mente está libre... Cada vez que piensas en fumar... sientes rechazo... el olor te molesta... el sabor te desagrada... Eres libre del tabaco... libre de la nicotina... Eres más fuerte que cualquier hábito... más grande que cualquier adicción... Tus pulmones se limpian... tu piel mejora... tu energía vuelve... Cuando veas un cigarro... sentirás compasión... pero tú ya saliste... ya eres libre...

[Emergencia]
En un momento... contaré del uno al cinco... y despertarás... libre... limpio... sin deseos... Uno... tu cuerpo ya no necesita nicotina... Dos... tu mente rechaza el cigarro... Tres... respiras profundo... y el aire es delicioso... Cuatro... te sientes fuerte... libre... Cinco... completamente despierto... libre del tabaco... para siempre...`,

  peso: `[Relajación]
Respira suavemente... y siéntete en control... Totalmente en control... Tu cuerpo es sabio... siempre lo ha sido... Con cada respiración... te conectas más... con la sabiduría de tu cuerpo... Suelta la culpa... suelta la presión... como cadenas que se rompen... una por una... Tu cuerpo se relaja... tu mente se aquieta... estás en paz... en control... en armonía...

[Profundización]
Imagina un jardín interior... donde crece todo lo que nutres... Las plantas sanas son tus hábitos buenos... las malezas son los hábitos que ya no necesitas... Con cada respiración... las malezas se van... y las plantas sanas crecen... más fuertes... más hermosas... Te hundes en esta imagen... este jardín eres tú...

[Sugestión]
Tú decides qué comes... cuánto comes... cuándo comes... Tu cuerpo te dice cuando tiene hambre de verdad... y cuando es solo un antojo... Escucha a tu cuerpo... respétalo... ámalo... Comes para vivir... no vives para comer... Eres dueño de tus decisiones... de tu cuerpo... de tu salud... El hambre emocional ya no te controla... porque tú tienes el control... siempre lo tuviste...

[Emergencia]
Ahora... cuento del uno al cinco... y despiertas... en control... en paz... Uno... tu cuerpo y mente están alineados... Dos... sientes el poder sobre tus decisiones... Tres... eliges lo que te nutre... Cuatro... tu cuerpo encuentra su equilibrio... Cinco... completamente despierto... dueño de ti... en armonía...`,

  focus: `[Relajación]
Respira profundo... muy profundo... Siente cómo el aire llena tus pulmones... y con él... llega la claridad... la concentración... Tu cuerpo se relaja... pero tu mente se afila... como un cuchillo que se pule... cada respiración la hace más precisa... más nítida... más poderosa... Suelta las distracciones... como hojas al viento... no las necesitas...

[Profundización]
Imagina una luz blanca... brillante... que entra por tus ojos... y enciende tu cerebro... como si encendiera mil neuronas... que estaban dormidas... Con cada respiración... la luz se hace más intensa... más clara... más enfocada... Te hundes en esta claridad... como un buzo en aguas cristalinas... todo es nítido... preciso... posible... Tu mente es como un rayo láser... cortando a través de la niebla...

[Sugestión]
Tu mente es como un rayo láser... enfocada... precisa... poderosa... Cuando te concentras... nada te distrae... nada te detiene... Cada pensamiento es nítido... cada decisión es correcta... cada acción es efectiva... Estás en flujo... en la zona... en tu mejor estado... Las distracciones se desvanecen... como polvo en el viento... Tu atención es imparable... tu concentración es absoluta...

[Emergencia]
En un momento... contaré del uno al cinco... y despertarás... con la mente clara... Uno... la luz se integra en ti... Dos... tu mente es nítida y poderosa... Tres... estás listo para actuar... Cuatro... sientes la energía... la claridad... Cinco... completamente despierto... enfocado... imparable... listo para lograr...`
};

// ─── All Spanish Voices ───────────────────────────────────────
const allVoices = [
  {id:'es-MX-JorgeNeural',name:'Jorge',lang:'🇲🇽 México',gender:'Masculino',deep:true},
  {id:'es-MX-DaliaNeural',name:'Dalia',lang:'🇲🇽 México',gender:'Femenino',deep:false},
  {id:'es-ES-AlvaroNeural',name:'Álvaro',lang:'🇪🇸 España',gender:'Masculino',deep:true},
  {id:'es-AR-TomasNeural',name:'Tomás',lang:'🇦🇷 Argentina',gender:'Masculino',deep:true},
  {id:'es-CO-GonzaloNeural',name:'Gonzalo',lang:'🇨🇴 Colombia',gender:'Masculino',deep:true},
  {id:'es-VE-SebastianNeural',name:'Sebastián',lang:'🇻🇪 Venezuela',gender:'Masculino',deep:true},
  {id:'es-CL-LorenzoNeural',name:'Lorenzo',lang:'🇨🇱 Chile',gender:'Masculino',deep:true},
  {id:'es-PE-AlexNeural',name:'Alex',lang:'🇵🇪 Perú',gender:'Masculino',deep:true},
  {id:'es-US-AlonsoNeural',name:'Alonso',lang:'🇺🇸 EE.UU.',gender:'Masculino',deep:true},
  {id:'es-ES-ElviraNeural',name:'Elvira',lang:'🇪🇸 España',gender:'Femenino',deep:false},
  {id:'es-ES-XimenaNeural',name:'Ximena',lang:'🇪🇸 España',gender:'Femenino',deep:false},
  {id:'es-AR-ElenaNeural',name:'Elena',lang:'🇦🇷 Argentina',gender:'Femenino',deep:false},
  {id:'es-CO-SalomeNeural',name:'Salomé',lang:'🇨🇴 Colombia',gender:'Femenino',deep:false},
  {id:'es-PE-CamilaNeural',name:'Camila',lang:'🇵🇪 Perú',gender:'Femenino',deep:false},
  {id:'es-US-PalomaNeural',name:'Paloma',lang:'🇺🇸 EE.UU.',gender:'Femenino',deep:false},
];

// ─── Effect Presets ──────────────────────────────────────────
const presets = {
  estudio: { reverb: 50, echo: 10, bass: 30, name: '🎙️ Estudio' },
  cueva:   { reverb: 80, echo: 40, bass: 60, name: '🕳️ Cueva' },
  bosque:  { reverb: 30, echo: 5,  bass: 20, name: '🌲 Bosque' },
  radio:   { reverb: 15, echo: 0,  bass: 10, name: '📻 Radio' },
};

app.get('/api/voices', (req, res) => res.json(allVoices));
app.get('/api/presets', (req, res) => res.json(presets));

// ─── Build audio filter array ────────────────────────────────
function buildAudioFilter(opts = {}) {
  const { echo = 0, reverb = 50, bassBoost = 30, deEss = true, warm = true, normalize = true, fadeIn = 0 } = opts;
  const filters = [];

  if (fadeIn > 0) filters.push('afade=t=in:d=' + fadeIn);

  if (deEss) {
    filters.push('highpass=f=60');
    filters.push('lowpass=f=10000');
  }

  if (warm) {
    filters.push('equalizer=f=100:t=q:w=1.5:g=4');
    filters.push('equalizer=f=200:t=q:w=1.5:g=3');
    filters.push('equalizer=f=500:t=q:w=2:g=1');
    filters.push('equalizer=f=2500:t=q:w=2:g=-3');
    filters.push('equalizer=f=5000:t=q:w=2:g=-4');
    filters.push('equalizer=f=8000:t=q:w=2:g=-5');
  }

  if (bassBoost > 0) {
    const g = (2 + (bassBoost / 100) * 6).toFixed(1);
    filters.push('equalizer=f=60:t=q:w=2:g=' + g);
    filters.push('equalizer=f=100:t=q:w=2:g=' + (g * 0.8).toFixed(1));
    filters.push('equalizer=f=150:t=q:w=2:g=' + (g * 0.5).toFixed(1));
  }

  if (reverb > 0) {
    const rv = reverb / 100;
    filters.push('aecho=0.8:0.88:' + (20 + Math.round(rv * 25)) + ':' + (0.25 + rv * 0.4).toFixed(2));
    filters.push('aecho=0.7:0.85:' + (40 + Math.round(rv * 50)) + ':' + (0.2 + rv * 0.3).toFixed(2));
    filters.push('aecho=0.6:0.82:' + (70 + Math.round(rv * 90)) + ':' + (0.15 + rv * 0.2).toFixed(2));
  }

  if (echo > 0) {
    const ei = echo / 100;
    const d = (0.3 + ei * 0.4).toFixed(2);
    filters.push('aecho=' + d + ':' + (parseFloat(d) + 0.1).toFixed(2) + ':' + (150 + Math.round(ei * 250)) + ':' + (ei * 0.5).toFixed(2));
  }

  if (normalize) filters.push('alimiter=limit=-1dB:level=off');

  return filters;
}

// ─── FFmpeg helpers ───────────────────────────────────────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { timeout: 180000 });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code !== 0) reject(new Error('ffmpeg exit ' + code + ': ' + stderr.slice(-300)));
      else resolve();
    });
    proc.on('error', reject);
  });
}

function processAudio(inputFile, outputFile, filterArray) {
  const af = Array.isArray(filterArray) ? filterArray.join(',') : filterArray;
  return runFfmpeg(['-y', '-i', inputFile, '-af', af, '-ar', '44100', '-ac', '2', '-b:a', '192k', outputFile]);
}

function getDuration(filePath) {
  return new Promise(resolve => {
    execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], { timeout: 10000 }, (err, stdout) => {
      resolve(err ? 60 : parseFloat(stdout.trim()) || 60);
    });
  });
}

// ─── Generate binaural WAV ────────────────────────────────────
function generateBinauralWav(type, duration, filePath) {
  const freqs = { delta: { base: 100, beat: 2 }, theta: { base: 150, beat: 6 }, alpha: { base: 200, beat: 10 }, sigma: { base: 200, beat: 14 }, gamma: { base: 200, beat: 40 }, beta: { base: 250, beat: 20 } };
  const f = freqs[type] || freqs.theta;
  const sr = 44100, n = duration * sr;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  // Crossfade loop: last 3 seconds fade out for seamless loop
  const xfRegion = Math.min(sr * 3, n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let fi = Math.min(1, i / (sr * 3));
    let fo = Math.min(1, (n - i) / (sr * 3));
    // Crossfade: smooth the end to connect to the beginning
    let loopXf = 1;
    if (i > n - xfRegion) {
      loopXf = (n - i) / xfRegion;
    }
    const v = 0.25 * fi * fo * loopXf;
    const L = (Math.sin(2 * Math.PI * f.base * t) * 0.6 + Math.sin(2 * Math.PI * f.base * 2 * t) * 0.25 + Math.sin(2 * Math.PI * f.base * 0.5 * t) * 0.05) * v;
    const R = (Math.sin(2 * Math.PI * (f.base + f.beat) * t) * 0.6 + Math.sin(2 * Math.PI * (f.base + f.beat) * 2 * t) * 0.25 + Math.sin(2 * Math.PI * (f.base + f.beat) * 0.5 * t) * 0.05) * v;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R)) * 32767), 44 + i * 4 + 2);
  }
  fs.writeFileSync(filePath, buf);
}

// ─── Generate ambient WAV (Web Audio API style, server-side) ──
function generateAmbientWav(type, duration, filePath) {
  const sr = 44100, n = duration * sr;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  let seed = type.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  function rand() { seed = (seed * 16807 + 0) % 2147483647; return (seed & 0x7fffffff) / 2147483647; }
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const fi = Math.min(1, i / (sr * 2));
    const fo = Math.min(1, (n - i) / (sr * 2));
    const vol = 0.15 * fi * fo;
    let sL = 0, sR = 0;
    if (type === 'rain') {
      const noise = (rand() - 0.5) * 2;
      const lfo = Math.sin(2 * Math.PI * 0.3 * t) * 0.3 + 0.7;
      sL = noise * vol * lfo; sR = noise * vol * (1.3 - lfo);
    } else if (type === 'ocean') {
      const noise = (rand() - 0.5) * 2;
      const wave = Math.sin(2 * Math.PI * 0.08 * t) * 0.5 + 0.5;
      sL = noise * vol * wave * 0.7; sR = noise * vol * wave * 0.7;
    } else if (type === 'forest') {
      const noise = (rand() - 0.5) * 0.5;
      const chirp = Math.sin(2 * Math.PI * (2000 + Math.sin(2 * Math.PI * 6 * t) * 500) * t) * (rand() > 0.997 ? 1 : 0);
      sL = (noise + chirp) * vol; sR = (noise + chirp * 0.8) * vol;
    } else if (type === 'fire') {
      const noise = (rand() - 0.5) * 2;
      const crackle = rand() > 0.998 ? Math.sin(2 * Math.PI * 800 * t) * 0.5 : 0;
      sL = (noise * 0.3 + crackle) * vol; sR = (noise * 0.3 + crackle * 0.8) * vol;
    } else if (type === 'wind') {
      const noise = (rand() - 0.5) * 2;
      const lfo = Math.sin(2 * Math.PI * 0.05 * t) * 0.4 + 0.6;
      sL = noise * vol * lfo; sR = noise * vol * (1.4 - lfo);
    } else {
      // Pad: low sine harmonics with subtle detuning
      sL = (Math.sin(2 * Math.PI * 65 * t) * 0.4 + Math.sin(2 * Math.PI * 98 * t) * 0.3 + Math.sin(2 * Math.PI * 55 * t) * 0.3) * vol;
      sR = (Math.sin(2 * Math.PI * 65.5 * t) * 0.4 + Math.sin(2 * Math.PI * 98.5 * t) * 0.3 + Math.sin(2 * Math.PI * 55.5 * t) * 0.3) * vol;
    }
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sL)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sR)) * 32767), 44 + i * 4 + 2);
  }
  fs.writeFileSync(filePath, buf);
}

// ─── API: Hypnosis with level ─────────────────────────────────
app.get('/api/hypnosis/:session', async (req, res) => {
  try {
    const session = req.params.session;
    const text = scripts[session];
    if (!text) return res.status(404).json({ error: 'Sesión no encontrada' });

    const voice = req.query.voice || 'es-MX-JorgeNeural';
    const rate = req.query.rate || '-40%';
    const pitch = req.query.pitch || '-12Hz';
    const echo = parseInt(req.query.echo) || 0;
    const reverb = parseInt(req.query.reverb) || 50;
    const bass = parseInt(req.query.bass) || 30;
    const download = req.query.download === 'true';

    const id = 'hyp_' + session + '_' + Date.now();
    const ttsFile = '/tmp/zenmix_' + id + '.mp3';
    const outFile = '/tmp/zenmix_' + id + '_out.mp3';

    await new Promise((resolve, reject) => {
      execFile('edge-tts', ['--text', text, '--voice', voice, '--rate=' + rate, '--pitch=' + pitch, '--write-media', ttsFile], { timeout: 120000 }, err => err ? reject(err) : resolve());
    });

    const filters = buildAudioFilter({ echo, reverb, bassBoost: bass, fadeIn: 3 });
    await processAudio(ttsFile, outFile, filters);

    try { fs.unlinkSync(ttsFile); } catch (e) {}
    const result = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (e) {}

    res.set('Content-Type', 'audio/mpeg');
    if (download) res.set('Content-Disposition', 'attachment; filename="zenmix_' + session + '.mp3"');
    res.send(result);
  } catch (e) {
    console.error('Hypnosis error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── API: Custom TTS ─────────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice, rate, pitch, echo, reverb, bass, download } = req.body;
    if (!text) return res.status(400).json({ error: 'No text' });

    const id = 'tts_' + Date.now();
    const ttsFile = '/tmp/zenmix_' + id + '.mp3';
    const outFile = '/tmp/zenmix_' + id + '_out.mp3';

    await new Promise((resolve, reject) => {
      execFile('edge-tts', ['--text', text.substring(0, 5000), '--voice', voice || 'es-MX-JorgeNeural', '--rate=' + (rate || '-40%'), '--pitch=' + (pitch || '-12Hz'), '--write-media', ttsFile], { timeout: 120000 }, err => err ? reject(err) : resolve());
    });

    const filters = buildAudioFilter({ echo: parseInt(echo) || 0, reverb: parseInt(reverb) || 50, bassBoost: parseInt(bass) || 30, fadeIn: 2 });
    await processAudio(ttsFile, outFile, filters);

    try { fs.unlinkSync(ttsFile); } catch (e) {}
    const result = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (e) {}

    res.set('Content-Type', 'audio/mpeg');
    if (download) res.set('Content-Disposition', 'attachment; filename="zenmix_custom.mp3"');
    res.send(result);
  } catch (e) {
    console.error('TTS error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── API: Upload voice ───────────────────────────────────────
app.post('/api/upload-voice', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio' });
  res.json({ id: req.file.filename, size: req.file.size });
});

// ─── API: Process voice ──────────────────────────────────────
app.post('/api/process-voice', async (req, res) => {
  try {
    const { fileId, echo, reverb, bass, pitch, download, trimStart, trimEnd } = req.body;
    if (!fileId) return res.status(400).json({ error: 'No fileId' });
    const inputPath = path.join('/tmp/zenmix_uploads', fileId);
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Not found' });

    const id = 'proc_' + Date.now();
    let processFile = inputPath;
    const trimmedFile = '/tmp/zenmix_' + id + '_trim.webm';
    const outFile = '/tmp/zenmix_' + id + '.mp3';
    const ts = parseFloat(trimStart) || 0;
    const te = parseFloat(trimEnd) || 0;

    if (ts > 0 || te > 0) {
      const dur = await getDuration(inputPath);
      const endTime = te > 0 ? te : dur;
      await runFfmpeg(['-y', '-i', inputPath, '-ss', String(ts), '-to', String(endTime), '-c', 'copy', trimmedFile]);
      processFile = trimmedFile;
    }

    const filterArray = buildAudioFilter({ echo: parseInt(echo) || 0, reverb: parseInt(reverb) || 50, bassBoost: parseInt(bass) || 30, fadeIn: 1 });
    const pitchVal = parseFloat(pitch) || 0;
    let fullFilter;
    if (pitchVal !== 0) {
      const pf = Math.pow(2, pitchVal / 12);
      fullFilter = ['asetrate=44100*' + pf.toFixed(4) + ',aresample=44100', ...filterArray];
    } else {
      fullFilter = filterArray;
    }

    await processAudio(processFile, outFile, fullFilter);
    try { if (processFile !== inputPath) fs.unlinkSync(trimmedFile); } catch (e) {}

    if (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0) return res.status(500).json({ error: 'Processing failed' });
    const result = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (e) {}

    res.set('Content-Type', 'audio/mpeg');
    if (download) res.set('Content-Disposition', 'attachment; filename="zenmix_voz_editada.mp3"');
    res.send(result);
  } catch (e) {
    console.error('Process voice error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── API: Binaural WAV ────────────────────────────────────────
app.get('/api/binaural/:type', (req, res) => {
  const type = req.params.type;
  const duration = parseInt(req.query.duration) || 300;
  const tmpFile = '/tmp/zenmix_bin_' + type + '_' + Date.now() + '.wav';
  generateBinauralWav(type, duration, tmpFile);
  const buffer = fs.readFileSync(tmpFile);
  try { fs.unlinkSync(tmpFile); } catch (e) {}
  res.set('Content-Type', 'audio/wav');
  if (req.query.download === 'true') res.set('Content-Disposition', 'attachment; filename="zenmix_' + type + '_binaural.wav"');
  res.send(buffer);
});

// ─── API: Ambient WAV ─────────────────────────────────────────
app.get('/api/ambient/:type', (req, res) => {
  const type = req.params.type;
  const duration = parseInt(req.query.duration) || 300;
  const tmpFile = '/tmp/zenmix_amb_' + type + '_' + Date.now() + '.wav';
  generateAmbientWav(type, duration, tmpFile);
  const buffer = fs.readFileSync(tmpFile);
  try { fs.unlinkSync(tmpFile); } catch (e) {}
  res.set('Content-Type', 'audio/wav');
  if (req.query.download === 'true') res.set('Content-Disposition', 'attachment; filename="zenmix_' + type + '.wav"');
  res.send(buffer);
});

// ─── API: Full mix ───────────────────────────────────────────
app.post('/api/mix-final', upload.single('voiceAudio'), async (req, res) => {
  try {
    const { binauralType = 'theta', ambientType = 'pad', binauralStart = 10, binauralEnd = 30, voiceVolume = 80, binauralVolume = 40, ambientVolume = 30, echo = 0, reverb = 50, bass = 30, download = false } = req.body;
    const voiceFile = req.file ? req.file.path : null;
    if (!voiceFile) return res.status(400).json({ error: 'No voice audio' });

    const id = 'mix_' + Date.now();
    const processedVoice = '/tmp/zenmix_' + id + '_voice.mp3';
    const voiceFilter = buildAudioFilter({ echo: parseInt(echo), reverb: parseInt(reverb), bassBoost: parseInt(bass), fadeIn: 2 });
    await processAudio(voiceFile, processedVoice, voiceFilter);

    const voiceDur = await getDuration(processedVoice);
    const totalDur = parseInt(binauralStart) + voiceDur + parseInt(binauralEnd);

    const binauralFile = '/tmp/zenmix_' + id + '_bin.wav';
    generateBinauralWav(binauralType, totalDur, binauralFile);

    const ambientFile = '/tmp/zenmix_' + id + '_amb.wav';
    generateAmbientWav(ambientType, totalDur, ambientFile);

    const outFile = '/tmp/zenmix_' + id + '_final.mp3';
    const vv = (parseInt(voiceVolume) / 100).toFixed(2);
    const bv = (parseInt(binauralVolume) / 100).toFixed(2);
    const av = (parseInt(ambientVolume) / 100).toFixed(2);
    const bStart = parseInt(binauralStart);

    await runFfmpeg([
      '-y', '-i', binauralFile, '-i', ambientFile, '-i', processedVoice,
      '-filter_complex',
      '[0:a]volume=' + bv + ',afade=t=in:d=3,afade=t=out:st=' + Math.max(0, totalDur - 3) + ':d=3[bin];' +
      '[1:a]volume=' + av + ',afade=t=in:d=3,afade=t=out:st=' + Math.max(0, totalDur - 3) + ':d=3[amb];' +
      '[2:a]adelay=' + (bStart * 1000) + '|' + (bStart * 1000) + ',volume=' + vv + ',afade=t=in:d=2,afade=t=out:st=' + Math.max(0, bStart + voiceDur - 2) + ':d=2[vox];' +
      '[bin][amb]amix=inputs=2:duration=longest[bg];[bg][vox]amix=inputs=2:duration=longest',
      '-b:a', '192k', outFile
    ]);

    try { fs.unlinkSync(processedVoice); } catch (e) {}
    try { fs.unlinkSync(binauralFile); } catch (e) {}
    try { fs.unlinkSync(ambientFile); } catch (e) {}

    if (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0) return res.status(500).json({ error: 'Mix failed' });
    const result = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (e) {}

    res.set('Content-Type', 'audio/mpeg');
    if (download === 'true' || download === true) res.set('Content-Disposition', 'attachment; filename="zenmix_hipnosis_completa.mp3"');
    res.send(result);
  } catch (e) {
    console.error('Mix error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── SPA fallback ─────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => console.log('🧘 ZENMIX server running on http://0.0.0.0:' + PORT));