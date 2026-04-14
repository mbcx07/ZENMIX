const express = require('express');
const path = require('path');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ─── Multer for voice recording uploads ─────────────────────
const upload = multer({
  dest: '/tmp/zenmix_uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ─── Hypnosis Scripts ────────────────────────────────────────
const scripts = {
  insomnio: `Respira... profundamente... Siente cómo el aire... entra por tu nariz... lentamente... y sale... suavemente por tu boca... Con cada respiración... tu cuerpo se relaja... más y más... Siente cómo tus pies... se hunden en la cama... tus piernas... se vuelven pesadas... tu abdomen... se relaja completamente... tus brazos... descansan pesadamente... tu cuello... se suaviza... y tu mente... se aquieta... Eres paz... eres tranquilidad... eres sueño... Deja que el sueño... te abrace... te envuelva... te lleve... a un lugar de descanso profundo... Mañana despertarás... renovado... lleno de energía... listo para un nuevo día... Ahora... simplemente... duerme... duerme... duerme...`,
  ansiedad: `Cierra los ojos un momento... Respira profundo... Cuenta hasta cuatro... mientras inhalas... uno... dos... tres... cuatro... Sostén el aire... y ahora... suéltalo lentamente... Siente cómo con cada exhalación... la ansiedad sale de tu cuerpo... como humo que se disipa... Tu mente está en calma... tu corazón late suave... Eres fuerte... eres capaz... La ansiedad es solo temporal... viene y va... como las nubes en el cielo... Tú eres el cielo... inmenso... sereno... en paz...`,
  migrania: `Relaja tu cuerpo completamente... Imagina una luz azul suave... que entra por la parte superior de tu cabeza... Esta luz azul es fresca... calmante... curativa... Fluye por tu cabeza... por tu frente... por tus sienes... deshaciendo la tensión... liberando el dolor... Siente cómo la frescura... alivia cada célula... El dolor se va haciendo más pequeño... más pequeño... hasta desaparecer... Tu cabeza está libre... ligera... en paz...`,
  autoestima: `Respira profundamente... Y con cada respiración... siéntete más seguro... más fuerte... más capaz... Tú vales... tú importas... tú eres suficiente... tal como eres... Imagina una luz dorada... que te envuelve... esta luz es tu poder interior... tu confianza... tu valor... Cada día te vuelves más seguro... más decidido... más auténtico... No necesitas la aprobación de otros... tú te apruebas... tú te aceptas... tú te amas...`,
  'dejar-fumar': `Respira profundo... Siente cómo tus pulmones se llenan... de aire puro... aire limpio... aire fresco... Ya no necesitas el cigarro... tu cuerpo está libre... tu mente está libre... Cada vez que piensas en fumar... sientes rechazo... el olor te molesta... el sabor te desagrada... Eres libre del tabaco... libre de la nicotina... libre de la esclavitud del cigarro...`,
  peso: `Respira suavemente... y siéntete en control... Tú decides qué comes... cuánto comes... cuándo comes... Tu cuerpo es sabio... te dice cuando tiene hambre de verdad... y cuando es solo un antojo... Escucha a tu cuerpo... respétalo... ámalo... Comes para vivir... no vives para comer... Eres dueño de tus decisiones... de tu cuerpo... de tu salud...`,
  focus: `Respira profundo... Tu mente es como un rayo láser... enfocada... precisa... poderosa... Cuando te concentras... nada te distrae... nada te detiene... Tu cerebro trabaja con claridad... con velocidad... con precisión... Cada pensamiento es nítido... cada decisión es correcta... cada acción es efectiva... Estás en flujo... en la zona... en tu mejor estado...`
};

// ─── All Spanish voices ──────────────────────────────────────
const allVoices = [
  {id:'es-ES-AlvaroNeural',name:'Álvaro',lang:'España',gender:'Masculino',deep:true},
  {id:'es-MX-JorgeNeural',name:'Jorge',lang:'México',gender:'Masculino',deep:true},
  {id:'es-AR-TomasNeural',name:'Tomás',lang:'Argentina',gender:'Masculino',deep:true},
  {id:'es-CO-GonzaloNeural',name:'Gonzalo',lang:'Colombia',gender:'Masculino',deep:true},
  {id:'es-VE-SebastianNeural',name:'Sebastián',lang:'Venezuela',gender:'Masculino',deep:true},
  {id:'es-CL-LorenzoNeural',name:'Lorenzo',lang:'Chile',gender:'Masculino',deep:true},
  {id:'es-PE-AlexNeural',name:'Alex',lang:'Perú',gender:'Masculino',deep:true},
  {id:'es-US-AlonsoNeural',name:'Alonso',lang:'EE.UU.',gender:'Masculino',deep:true},
  {id:'es-MX-DaliaNeural',name:'Dalia',lang:'México',gender:'Femenino',deep:false},
  {id:'es-ES-ElviraNeural',name:'Elvira',lang:'España',gender:'Femenino',deep:false},
  {id:'es-ES-XimenaNeural',name:'Ximena',lang:'España',gender:'Femenino',deep:false},
  {id:'es-AR-ElenaNeural',name:'Elena',lang:'Argentina',gender:'Femenino',deep:false},
  {id:'es-CO-SalomeNeural',name:'Salomé',lang:'Colombia',gender:'Femenino',deep:false},
  {id:'es-PE-CamilaNeural',name:'Camila',lang:'Perú',gender:'Femenino',deep:false},
  {id:'es-US-PalomaNeural',name:'Paloma',lang:'EE.UU.',gender:'Femenino',deep:false},
];

app.get('/api/voices', (req, res) => res.json(allVoices));

// ─── Studio-quality audio processing chain ──────────────────
// Uses: EQ → Compressor → Reverb → Echo → Loudness normalize
// Returns an array of individual filter strings (NOT comma-joined)
function buildAudioFilter(opts = {}) {
  const {
    echo = 0,
    reverb = 50,
    bassBoost = 30,
    deEss = true,
    warm = true,
    normalize = true
  } = opts;
  
  const filters = [];
  
  // 1. Clean up rumble and harshness
  if (deEss) {
    filters.push('highpass=f=80');
    filters.push('lowpass=f=12000');
  }
  
  // 2. Warm EQ: boost low-mids, cut nasal frequencies
  if (warm) {
    filters.push('equalizer=f=150:t=q:w=1.5:g=3');
    filters.push('equalizer=f=300:t=q:w=1.5:g=2');
    filters.push('equalizer=f=2500:t=q:w=2:g=-2');
    filters.push('equalizer=f=5000:t=q:w=2:g=-3');
    filters.push('equalizer=f=8000:t=q:w=2:g=-4');
  }
  
  // 3. Bass boost for deep voice effect
  if (bassBoost > 0) {
    const bassGain = 1 + (bassBoost / 100) * 5;
    filters.push('equalizer=f=80:t=q:w=2:g=' + bassGain.toFixed(1));
    filters.push('equalizer=f=120:t=q:w=2:g=' + (bassGain * 0.7).toFixed(1));
  }
  
  // 4. Compressor: even out volume, add warmth
  filters.push('compand=0.3|0.3:1|1:-90/-60|-60/-40|-40/-30|-20/-20:6:0:-90:0.1');
  
  // 5. Reverb: multi-tap studio reverb using multiple aecho calls
  if (reverb > 0) {
    const rv = reverb / 100;
    // Short room reflections
    const r1 = Math.round(18 + rv * 30);
    const d1 = (0.25 + rv * 0.45).toFixed(2);
    filters.push('aecho=0.8:0.88:' + r1 + ':' + d1);
    // Medium reflections
    const r2 = Math.round(35 + rv * 60);
    const d2 = (0.2 + rv * 0.35).toFixed(2);
    filters.push('aecho=0.7:0.85:' + r2 + ':' + d2);
    // Long tail
    const r3 = Math.round(60 + rv * 100);
    const d3 = (0.15 + rv * 0.25).toFixed(2);
    filters.push('aecho=0.6:0.82:' + r3 + ':' + d3);
  }
  
  // 6. Simple echo (separate from reverb)
  if (echo > 0) {
    const ei = echo / 100;
    const eDecay = (0.3 + ei * 0.4).toFixed(2);
    const eDelay = 150 + Math.round(ei * 250);
    const eRet = (parseFloat(eDecay) + 0.1).toFixed(2);
    filters.push('aecho=' + eDecay + ':' + eRet + ':' + eDelay + ':' + (ei * 0.5).toFixed(2));
  }
  
  // 7. Loudness normalization (EBU R128)
  if (normalize) {
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  }
  
  return filters;
}

// ─── Run ffmpeg with audio filter chain ──────────────────────
function processAudio(inputFile, outputFile, filterArray) {
  // filterArray is an array of individual filter strings
  // Join with commas — this avoids the pipe parsing issue with execFile
  const audioFilter = Array.isArray(filterArray) ? filterArray.join(',') : filterArray;
  
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', inputFile, '-af', audioFilter, '-ar', '44100', '-ac', '2', '-b:a', '192k', outputFile];
    const proc = spawn('ffmpeg', args, { timeout: 120000 });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error('ffmpeg exit code ' + code + ': ' + stderr.slice(-200)));
        return;
      }
      if (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0) {
        resolve(outputFile);
      } else {
        reject(new Error('Output file empty or missing'));
      }
    });
    proc.on('error', reject);
  });
}

// ─── Generate hypnosis audio with studio processing ─────────
app.get('/api/hypnosis/:session', async (req, res) => {
  try {
    const session = req.params.session;
    const text = scripts[session];
    if (!text) return res.status(404).json({ error: 'Sesión no encontrada' });
    
    const voice = req.query.voice || 'es-ES-AlvaroNeural';
    const rate = req.query.rate || '-40%';
    const pitch = req.query.pitch || '-8Hz';
    const echo = parseInt(req.query.echo) || 0;
    const reverb = parseInt(req.query.reverb) || 50;
    const bassBoost = parseInt(req.query.bass) || 30;
    const download = req.query.download === 'true';
    
    const id = `hyp_${session}_${Date.now()}`;
    const ttsFile = `/tmp/zenmix_${id}.mp3`;
    const outFile = `/tmp/zenmix_${id}_out.mp3`;
    
    // Generate TTS
    await new Promise((resolve, reject) => {
      execFile('edge-tts', [
        '--text', text,
        '--voice', voice,
        '--rate=' + rate,
        '--pitch=' + pitch,
        '--write-media', ttsFile
      ], { timeout: 120000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    
    // Apply studio processing
    const audioFilter = buildAudioFilter({ echo, reverb, bassBoost });
    await processAudio(ttsFile, outFile, audioFilter);
    
    try { fs.unlinkSync(ttsFile); } catch(e) {}
    
    const result = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch(e) {}
    
    res.set('Content-Type', 'audio/mpeg');
    if (download) res.set('Content-Disposition', `attachment; filename="zenmix_${session}.mp3"`);
    res.send(result);
  } catch (e) {
    console.error('Hypnosis error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Custom TTS with studio processing ───────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice, rate, pitch, echo, reverb, bass, download } = req.body;
    if (!text) return res.status(400).json({ error: 'No text' });
    
    const id = `tts_${Date.now()}`;
    const ttsFile = `/tmp/zenmix_${id}.mp3`;
    const outFile = `/tmp/zenmix_${id}_out.mp3`;
    
    await new Promise((resolve, reject) => {
      execFile('edge-tts', [
        '--text', text.substring(0, 5000),
        '--voice', voice || 'es-ES-AlvaroNeural',
        '--rate=' + (rate || '-40%'),
        '--pitch=' + (pitch || '-8Hz'),
        '--write-media', ttsFile
      ], { timeout: 120000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    
    const audioFilter = buildAudioFilter({
      echo: parseInt(echo) || 0,
      reverb: parseInt(reverb) || 50,
      bassBoost: parseInt(bass) || 30
    });
    await processAudio(ttsFile, outFile, audioFilter);
    
    try { fs.unlinkSync(ttsFile); } catch(e) {}
    
    const result = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch(e) {}
    
    res.set('Content-Type', 'audio/mpeg');
    if (download) res.set('Content-Disposition', 'attachment; filename="zenmix_custom.mp3"');
    res.send(result);
  } catch (e) {
    console.error('TTS error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Upload voice recording ─────────────────────────────────
app.post('/api/upload-voice', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file' });
  // Return the file ID for subsequent processing
  res.json({
    id: req.file.filename,
    size: req.file.size,
    originalName: req.file.originalname || 'recording.webm'
  });
});

// ─── Process uploaded voice with effects ────────────────────
app.post('/api/process-voice', async (req, res) => {
  try {
    const { fileId, echo, reverb, bass, pitch, download } = req.body;
    if (!fileId) return res.status(400).json({ error: 'No fileId' });
    
    const inputPath = path.join('/tmp/zenmix_uploads', fileId);
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'File not found' });
    
    const id = `proc_${Date.now()}`;
    const outFile = `/tmp/zenmix_${id}.mp3`;
    
    const filterArray = buildAudioFilter({
      echo: parseInt(echo) || 0,
      reverb: parseInt(reverb) || 50,
      bassBoost: parseInt(bass) || 30,
      normalize: true
    });
    
    // Add pitch shift if requested
    const pitchVal = parseFloat(pitch) || 0;
    let fullFilter;
    if (pitchVal !== 0) {
      const pitchFactor = Math.pow(2, pitchVal / 12);
      const pitchFilter = 'asetrate=44100*' + pitchFactor.toFixed(4) + ',aresample=44100';
      fullFilter = [pitchFilter, ...filterArray];
    } else {
      fullFilter = filterArray;
    }
    const audioFilterStr = fullFilter.join(',');
    
    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', ['-y', '-i', inputPath, '-af', audioFilterStr, '-ar', '44100', '-ac', '2', '-b:a', '192k', outFile], { timeout: 120000 });
      proc.on('close', code => { if (code !== 0) reject(new Error('ffmpeg exit ' + code)); else resolve(); });
      proc.on('error', reject);
    });
    
    if (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0) {
      return res.status(500).json({ error: 'Processing failed' });
    }
    
    const result = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch(e) {}
    // Don't delete uploaded file yet (user might re-process)
    
    res.set('Content-Type', 'audio/mpeg');
    if (download) res.set('Content-Disposition', 'attachment; filename="zenmix_voz_editada.mp3"');
    res.send(result);
  } catch (e) {
    console.error('Process voice error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Mix voice + binaural + ambient with timeline control ───
app.post('/api/mix-final', upload.single('voiceAudio'), async (req, res) => {
  try {
    const {
      binauralType = 'theta',
      binauralStart = 0,        // seconds before voice
      binauralEnd = 0,          // seconds after voice
      ambientStart = 0,         // seconds before voice
      ambientEnd = 0,          // seconds after voice
      voiceVolume = 80,         // 0-100
      binauralVolume = 40,      // 0-100
      echo = 0,
      reverb = 50,
      bass = 30,
      download = false
    } = req.body;
    
    const voiceFile = req.file ? req.file.path : null;
    if (!voiceFile) return res.status(400).json({ error: 'No voice audio' });
    
    const id = `mix_${Date.now()}`;
    
    // 1. Process voice with studio effects first
    const processedVoice = `/tmp/zenmix_${id}_voice.mp3`;
    const voiceFilter = buildAudioFilter({ echo: parseInt(echo), reverb: parseInt(reverb), bassBoost: parseInt(bass) });
    await processAudio(voiceFile, processedVoice, voiceFilter);
    
    // Get voice duration
    const voiceDur = await getDuration(processedVoice);
    
    // 2. Generate binaural WAV
    const binauralFile = `/tmp/zenmix_${id}_binaural.wav`;
    const totalDur = parseInt(binauralStart) + voiceDur + parseInt(binauralEnd);
    generateBinauralWav(binauralType, totalDur, binauralFile);
    
    // 3. Mix voice + binaural with ffmpeg
    const outFile = `/tmp/zenmix_${id}_final.mp3`;
    const vv = (parseInt(voiceVolume) / 100).toFixed(2);
    const bv = (parseInt(binauralVolume) / 100).toFixed(2);
    
    // Voice delayed by binauralStart seconds
    const voiceDelay = parseInt(binauralStart);
    
    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-y',
        '-i', binauralFile,
        '-i', processedVoice,
        '-filter_complex',
        '[0:a]volume=' + bv + '[bin];[1:a]adelay=' + (voiceDelay * 1000) + '|' + (voiceDelay * 1000) + ',volume=' + vv + '[vox];[bin][vox]amix=inputs=2:duration=longest',
        '-b:a', '192k',
        outFile
      ], { timeout: 180000 });
      proc.on('close', code => { if (code !== 0) reject(new Error('ffmpeg exit ' + code)); else resolve(); });
      proc.on('error', reject);
    });
    
    // Cleanup
    try { fs.unlinkSync(processedVoice); } catch(e) {}
    try { fs.unlinkSync(binauralFile); } catch(e) {}
    
    if (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0) {
      return res.status(500).json({ error: 'Mix failed' });
    }
    
    const result = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch(e) {}
    
    res.set('Content-Type', 'audio/mpeg');
    if (download === 'true' || download === true) {
      res.set('Content-Disposition', 'attachment; filename="zenmix_hipnosis_completa.mp3"');
    }
    res.send(result);
  } catch (e) {
    console.error('Mix error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Binaural beat generator (WAV file) ──────────────────────
app.get('/api/binaural/:type', (req, res) => {
  const type = req.params.type;
  const duration = parseInt(req.query.duration) || 300;
  const download = req.query.download === 'true';
  
  const freqs = {
    delta: { base: 100, beat: 2 },
    theta: { base: 150, beat: 6 },
    alpha: { base: 200, beat: 10 },
    sigma: { base: 200, beat: 14 },
    gamma: { base: 200, beat: 40 },
    beta: { base: 250, beat: 20 }
  };
  const f = freqs[type];
  if (!f) return res.status(404).json({ error: 'Tipo no encontrado' });
  
  const tmpFile = `/tmp/zenmix_bin_${type}_${Date.now()}.wav`;
  generateBinauralWav(type, duration, tmpFile);
  
  const buffer = fs.readFileSync(tmpFile);
  try { fs.unlinkSync(tmpFile); } catch(e) {}
  
  res.set('Content-Type', 'audio/wav');
  if (download) res.set('Content-Disposition', `attachment; filename="zenmix_${type}_binaural.wav"`);
  res.send(buffer);
});

function generateBinauralWav(type, duration, filePath) {
  const freqs = {
    delta: { base: 100, beat: 2 },
    theta: { base: 150, beat: 6 },
    alpha: { base: 200, beat: 10 },
    sigma: { base: 200, beat: 14 },
    gamma: { base: 200, beat: 40 },
    beta: { base: 250, beat: 20 }
  };
  const f = freqs[type] || freqs.theta;
  
  const sampleRate = 44100;
  const numSamples = duration * sampleRate;
  const buffer = Buffer.alloc(44 + numSamples * 4);
  
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 4, 40);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, i / (sampleRate * 3));
    const fadeOut = Math.min(1, (numSamples - i) / (sampleRate * 3));
    const vol = 0.25 * fadeIn * fadeOut;
    
    const left = (Math.sin(2 * Math.PI * f.base * t) * 0.6 +
                  Math.sin(2 * Math.PI * f.base * 2 * t) * 0.25 +
                  Math.sin(2 * Math.PI * f.base * 3 * t) * 0.1 +
                  Math.sin(2 * Math.PI * f.base * 0.5 * t) * 0.05) * vol;
    const right = (Math.sin(2 * Math.PI * (f.base + f.beat) * t) * 0.6 +
                   Math.sin(2 * Math.PI * (f.base + f.beat) * 2 * t) * 0.25 +
                   Math.sin(2 * Math.PI * (f.base + f.beat) * 3 * t) * 0.1 +
                   Math.sin(2 * Math.PI * (f.base + f.beat) * 0.5 * t) * 0.05) * vol;
    
    const offset = 44 + i * 4;
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left)) * 32767), offset);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right)) * 32767), offset + 2);
  }
  
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// ─── Get audio duration ──────────────────────────────────────
function getDuration(filePath) {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { timeout: 10000 }, (err, stdout) => {
      if (err) { resolve(60); return; }
      resolve(parseFloat(stdout.trim()) || 60);
    });
  });
}

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧘 ZENMIX server running on http://0.0.0.0:${PORT}`);
});