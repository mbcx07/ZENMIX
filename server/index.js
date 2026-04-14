const express = require('express');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ─── Hypnosis Scripts ──────────────────────────────────────
const scripts = {
  insomnio: `Respira... profundamente... Siente cómo el aire... entra por tu nariz... lentamente... y sale... suavemente por tu boca... Con cada respiración... tu cuerpo se relaja... más y más... Siente cómo tus pies... se hunden en la cama... tus piernas... se vuelven pesadas... tu abdomen... se relaja completamente... tus brazos... descansan pesadamente... tu cuello... se suaviza... y tu mente... se aquieta... Eres paz... eres tranquilidad... eres sueño... Deja que el sueño... te abrace... te envuelva... te lleve... a un lugar de descanso profundo... Mañana despertarás... renovado... lleno de energía... listo para un nuevo día... Ahora... simplemente... duerme... duerme... duerme...`,

  ansiedad: `Cierra los ojos un momento... Respira profundo... Cuenta hasta cuatro... mientras inhalas... uno... dos... tres... cuatro... Sostén el aire... y ahora... suéltalo lentamente... Siente cómo con cada exhalación... la ansiedad sale de tu cuerpo... como humo que se disipa en el aire... Tu mente está en calma... tu corazón late suave... Eres fuerte... eres capaz... La ansiedad es solo una emoción temporal... viene y va... como las nubes en el cielo... Tú eres el cielo... inmenso... sereno... en paz... Repite internamente... estoy en calma... estoy seguro... todo está bien...`,

  migrania: `Relaja tu cuerpo completamente... Imagina una luz azul suave... que entra por la parte superior de tu cabeza... Esta luz azul es fresca... calmante... curativa... Fluye por tu cabeza... por tu frente... por tus sienes... deshaciendo la tensión... liberando el dolor... Siente cómo la frescura de esta luz... alivia cada célula... El dolor se va haciendo más pequeño... más pequeño... hasta desaparecer... Tu cabeza está libre... ligera... en paz... Eres libre del dolor... tu cuerpo sana... tu mente descansa...`,

  autoestima: `Respira profundamente... Y con cada respiración... siéntete más seguro... más fuerte... más capaz... Tú vales... tú importas... tú eres suficiente... tal como eres... Imagina una luz dorada... que te envuelve... esta luz es tu poder interior... tu confianza... tu valor... Cada día te vuelves más seguro... más decidido... más auténtico... No necesitas la aprobación de otros... tú te apruebas... tú te aceptas... tú te amas... Eres capaz de lograr todo lo que te propones...`,

  'dejar-fumar': `Respira profundo... Siente cómo tus pulmones se llenan... de aire puro... aire limpio... aire fresco... Ya no necesitas el cigarro... tu cuerpo está libre... tu mente está libre... Cada vez que piensas en fumar... sientes rechazo... el olor te molesta... el sabor te desagrada... Eres una persona libre del tabaco... libre de la nicotina... libre de la esclavitud del cigarro... Tus pulmones se regeneran... tu cuerpo se cura... tu vida mejora cada día... Eres libre... eres fuerte... eres no fumador...`,

  peso: `Respira suavemente... y siéntete en control... Tú decides qué comes... cuánto comes... cuándo comes... Tu cuerpo es sabio... te dice cuando tiene hambre de verdad... y cuando es solo un antojo... Escucha a tu cuerpo... respétalo... ámalo... Cada comida es una oportunidad de nutrirte... no de castigarte... Comes para vivir... no vives para comer... Eres dueño de tus decisiones... de tu cuerpo... de tu salud...`,

  focus: `Respira profundo... Tu mente es como un rayo láser... enfocada... precisa... poderosa... Cuando te concentras... nada te distrae... nada te detiene... nada te aparta de tu objetivo... Tu cerebro trabaja con claridad... con velocidad... con precisión... Cada pensamiento es nítido... cada decisión es correcta... cada acción es efectiva... Estás en flujo... en la zona... en tu mejor estado... Eres productivo... eres creativo... eres imparable...`
};

// ─── Voice list ─────────────────────────────────────────────
const voices = [
  { id: 'es-MX-DaliaNeural', name: 'Dalia', lang: 'México', gender: 'Femenina' },
  { id: 'es-MX-JorgeNeural', name: 'Jorge', lang: 'México', gender: 'Masculino' },
  { id: 'es-ES-ElviraNeural', name: 'Elvira', lang: 'España', gender: 'Femenina' },
  { id: 'es-ES-AlvaroNeural', name: 'Álvaro', lang: 'España', gender: 'Masculino' },
  { id: 'es-ES-XimenaNeural', name: 'Ximena', lang: 'España', gender: 'Femenina' },
];

// ─── Get voices ─────────────────────────────────────────────
app.get('/api/voices', (req, res) => {
  res.json(voices);
});

// ─── Generate hypnosis audio with echo ──────────────────────
app.get('/api/hypnosis/:session', async (req, res) => {
  try {
    const session = req.params.session;
    const text = scripts[session];
    if (!text) return res.status(404).json({ error: 'Sesión no encontrada' });
    
    const voice = req.query.voice || 'es-MX-DaliaNeural';
    const rate = req.query.rate || '-30%'; // Más lento por defecto
    const echo = req.query.echo !== 'false'; // echo enabled by default
    
    const outputFile = `/tmp/zenmix_${session}_${Date.now()}.mp3`;
    
    await new Promise((resolve, reject) => {
      execFile('edge-tts', [
        '--text', text,
        '--voice', voice,
        '--rate=' + rate,
        '--pitch=-3Hz',
        '--write-media', outputFile
      ], { timeout: 60000 }, (err) => {
        if (err) { console.error('edge-tts error:', err.message); reject(err); return; }
        else resolve();
      });
    });
    
    let audioBuffer = fs.readFileSync(outputFile);
    try { fs.unlinkSync(outputFile); } catch(e) {}
    
    // Apply echo effect using ffmpeg if available
    if (echo) {
      const echoFile = `/tmp/zenmix_echo_${Date.now()}.mp3`;
      const inputFile = `/tmp/zenmix_input_${Date.now()}.mp3`;
      try {
        fs.writeFileSync(inputFile, audioBuffer);
        await new Promise((resolve, reject) => {
          execFile('ffmpeg', [
            '-y',
            '-i', inputFile,
            '-af', 'aecho=0.8:0.88:60:0.4,aecho=0.6:0.85:120:0.3',
            echoFile
          ], { timeout: 30000 }, (err) => {
            if (err) reject(err); else resolve();
          });
        });
        
        if (fs.existsSync(echoFile)) {
          audioBuffer = fs.readFileSync(echoFile);
          try { fs.unlinkSync(echoFile); } catch(e) {}
        }
        try { fs.unlinkSync(inputFile); } catch(e) {}
      } catch(e) {
        console.log('ffmpeg echo failed, using original audio');
        try { fs.unlinkSync(inputFile); } catch(e2) {}
      }
    }
    
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (e) {
    console.error('Hypnosis generation error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Custom TTS with echo ───────────────────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice, rate, echo: addEcho } = req.body;
    if (!text) return res.status(400).json({ error: 'No text' });
    
    const outputFile = `/tmp/zenmix_custom_${Date.now()}.mp3`;
    
    await new Promise((resolve, reject) => {
      const args = [
        '--text', text.substring(0, 5000),
        '--voice', voice || 'es-MX-DaliaNeural',
        '--rate=' + (rate || '-30%'),
        '--pitch=-3Hz',
        '--write-media', outputFile
      ];
      execFile('edge-tts', args, { timeout: 120000 }, (err) => {
        if (err) { console.error('edge-tts custom error:', err.message); reject(err); return; }
        else resolve();
      });
    });
    
    let audioBuffer = fs.readFileSync(outputFile);
    try { fs.unlinkSync(outputFile); } catch(e) {}
    
    // Apply echo effect
    if (addEcho !== false) {
      const echoFile = `/tmp/zenmix_custom_echo_${Date.now()}.mp3`;
      const tmpInput = `/tmp/zenmix_custom_input_${Date.now()}.mp3`;
      try {
        fs.writeFileSync(tmpInput, audioBuffer);
        await new Promise((resolve, reject) => {
          execFile('ffmpeg', [
            '-y',
            '-i', tmpInput,
            '-af', 'aecho=0.8:0.88:60:0.4,aecho=0.6:0.85:120:0.3',
            echoFile
          ], { timeout: 60000 }, (err) => {
            if (err) { console.error('ffmpeg echo error:', err.message); reject(err); return; }
            else resolve();
          });
        });
        
        if (fs.existsSync(echoFile)) {
          audioBuffer = fs.readFileSync(echoFile);
          try { fs.unlinkSync(echoFile); } catch(e) {}
        }
        try { fs.unlinkSync(tmpInput); } catch(e) {}
      } catch(e) {
        console.log('ffmpeg echo failed, using original');
        try { fs.unlinkSync(tmpInput); } catch(e2) {}
      }
    }
    
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (e) {
    console.error('TTS error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Binaural beat generator ────────────────────────────────
app.get('/api/binaural/:type', (req, res) => {
  const type = req.params.type;
  const freqs = {
    theta: { base: 200, beat: 6, name: 'Theta 6Hz' },
    alpha: { base: 200, beat: 10, name: 'Alfa 10Hz' },
    delta: { base: 200, beat: 2, name: 'Delta 2Hz' },
    gamma: { base: 200, beat: 40, name: 'Gamma 40Hz' },
    sigma: { base: 200, beat: 14, name: 'Sigma 14Hz' }
  };
  const f = freqs[type];
  if (!f) return res.status(404).json({ error: 'Tipo no encontrado' });
  
  // Generate a simple binaural beat WAV file
  const duration = 300; // 5 minutes
  const sampleRate = 44100;
  const numSamples = duration * sampleRate;
  const buffer = Buffer.alloc(44 + numSamples * 4);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(2, 22); // stereo
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 4, 40);
  
  // Generate binaural tones with fade in/out
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, i / (sampleRate * 3));
    const fadeOut = Math.min(1, (numSamples - i) / (sampleRate * 3));
    const volume = 0.3 * fadeIn * fadeOut;
    
    const left = Math.sin(2 * Math.PI * f.base * t) * volume;
    const right = Math.sin(2 * Math.PI * (f.base + f.beat) * t) * volume;
    
    const offset = 44 + i * 4;
    buffer.writeInt16LE(Math.round(left * 32767), offset);
    buffer.writeInt16LE(Math.round(right * 32767), offset + 2);
  }
  
  res.set('Content-Type', 'audio/wav');
  res.send(buffer);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧘 ZENMIX server running on http://0.0.0.0:${PORT}`);
});