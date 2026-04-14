const express = require('express');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ─── Hypnosis Scripts ──────────────────────────────────────
const scripts = {
  insomnio: `Respira profundamente... Siente cómo el aire entra por tu nariz... lentamente... y sale suavemente por tu boca. Con cada respiración, tu cuerpo se relaja más y más. Siente cómo tus pies se hunden en la cama... tus piernas se vuelven pesadas... tu abdomen se relaja completamente... tus brazos descansan pesadamente... tu cuello se suaviza... y tu mente se aquieta. Eres paz... eres tranquilidad... eres sueño. Deja que el sueño te abrace... te envuelva... te lleve a un lugar de descanso profundo. Mañana despertarás renovado... lleno de energía... listo para un nuevo día. Ahora... simplemente... duerme... duerme... duerme...`,

  ansiedad: `Cierra los ojos un momento... Respira profundo... cuenta hasta cuatro mientras inhalas... uno... dos... tres... cuatro... sostén el aire... y ahora suéltalo lentamente... Siente cómo con cada exhalación, la ansiedad sale de tu cuerpo como humo que se disipa en el aire. Tu mente está en calma... tu corazón late suave y steady... Eres fuerte... eres capaz de manejar cualquier situación... La ansiedad es solo una emoción temporal... viene y va como las nubes en el cielo... Tú eres el cielo... inmenso... sereno... en paz. Repite internamente: estoy en calma... estoy seguro... todo está bien...`,

  migrania: `Relaja tu cuerpo completamente... Imagina una luz azul suave que entra por la parte superior de tu cabeza... Esta luz azul es fresca... calmante... curativa... Fluye por tu cabeza... por tu frente... por tus sienes... deshaciendo la tensión... liberando el dolor... Siente cómo la frescura de esta luz alivia cada célula... El dolor se va haciendo más pequeño... más pequeño... hasta desaparecer... Tu cabeza está libre... ligera... en paz. Eres libre del dolor... libre de la molestia... Tu cuerpo sana... tu mente descansa...`,

  autoestima: `Respira profundamente... Y con cada respiración, siéntete más seguro... más fuerte... más capaz. Tú vales... tú importas... tú eres suficiente tal como eres. Imagina una luz dorada que te envuelve... esta luz es tu poder interior... tu confianza... tu valor. Cada día te vuelves más seguro... más decidido... más auténtico. No necesitas la aprobación de otros... tú te apruebas... tú te aceptas... tú te amas. Eres capaz de lograr todo lo que te propones... porque tienes todo lo necesario dentro de ti...`,

  'dejar-fumar': `Respira profundo... Siente cómo tus pulmones se llenan de aire puro... aire limpio... aire fresco. Ya no necesitas el cigarro... tu cuerpo está libre... tu mente está libre. Cada vez que piensas en fumar, sientes rechazo... el olor te molesta... el sabor te desagrada. Eres una persona libre del tabaco... libre de la nicotina... libre de la esclavitud del cigarro. Tus pulmones se regeneran... tu cuerpo se cura... tu vida mejora cada día. Eres libre... eres fuerte... eres no-fumador...`,

  peso: `Respira suavemente... Y siéntete en control... Tú decides qué comes... cuánto comes... cuándo comes. Tu cuerpo es sabio... te dice cuando tiene hambre de verdad y cuando es solo un antojo. Escucha a tu cuerpo... respétalo... ámalo. Cada comida es una oportunidad de nutrirte... no de castigarte. Comes para vivir... no vives para comer. Eres dueño de tus decisiones... de tu cuerpo... de tu salud. Cada día te acercas más a tu peso ideal... naturalmente... sin esfuerzo...`,

  focus: `Respira profundo... Tu mente es como un rayo láser... enfocada... precisa... poderosa. Cuando te concentras, nada te distrae... nada te detiene... nada te aparta de tu objetivo. Tu cerebro trabaja con claridad... con velocidad... con precisión. Cada pensamiento es nítido... cada decisión es correcta... cada acción es efectiva. Estás en flujo... en la zona... en tu mejor estado. Eres productivo... eres creativo... eres imparable...`
};

// ─── Generate hypnosis audio ────────────────────────────────
app.get('/api/hypnosis/:session', async (req, res) => {
  try {
    const session = req.params.session;
    const text = scripts[session];
    if (!text) return res.status(404).json({ error: 'Sesión no encontrada' });
    
    const outputFile = `/tmp/zenmix_${session}_${Date.now()}.mp3`;
    
    await new Promise((resolve, reject) => {
      execFile('edge-tts', [
        '--text', text,
        '--voice', 'es-MX-DaliaNeural',
        '--rate=-10%',
        '--pitch=-2Hz',
        '--write-media', outputFile
      ], { timeout: 60000 }, (err) => {
        if (err) { console.error('edge-tts error:', err.message); reject(err); return; }
        else resolve();
      });
    });
    
    const audioBuffer = fs.readFileSync(outputFile);
    try { fs.unlinkSync(outputFile); } catch(e) {}
    
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (e) {
    console.error('Hypnosis generation error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Custom TTS ─────────────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice, rate } = req.body;
    if (!text) return res.status(400).json({ error: 'No text' });
    
    const outputFile = `/tmp/zenmix_custom_${Date.now()}.mp3`;
    
    await new Promise((resolve, reject) => {
      const args = [
        '--text', text.substring(0, 5000),
        '--voice', voice || 'es-MX-DaliaNeural',
        '--rate=' + (rate || '-10%'),
        '--pitch=-2Hz',
        '--write-media', outputFile
      ];
      execFile('edge-tts', args, { timeout: 120000 }, (err) => {
        if (err) { console.error('edge-tts custom error:', err.message); reject(err); return; }
        else resolve();
      });
    });
    
    const audioBuffer = fs.readFileSync(outputFile);
    try { fs.unlinkSync(outputFile); } catch(e) {}
    
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (e) {
    console.error('TTS error:', e);
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧘 ZENMIX server running on http://0.0.0.0:${PORT}`);
});