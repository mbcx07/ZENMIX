// ── PUTER.JS TTS SERVICE ─────────────────────────────────────────────────────
// Usa Puter.js para acceder a AWS Polly Neural, ElevenLabs, etc.
// 100% gratis, sin API key, sin límites.
// Requiere: <script src="https://js.puter.com/v2/"></script>
// ─────────────────────────────────────────────────────────────────────────────

// Voces disponibles (AWS Polly + ElevenLabs via Puter)
export const PUTER_VOICES = [
  // 🇪🇸 Español - Voces neurales
  { id: 'es-ES', name: 'Español Neural', gender: 'female', lang: 'es-ES', engine: 'neural', description: 'AWS Polly Neural ES — natural, profesional' },
  { id: 'es-US', name: 'Español US Neural', gender: 'female', lang: 'es-US', engine: 'neural', description: 'AWS Polly Neural US Latam — cálida' },
  // 🇺🇸 English - para bilingüe
  { id: 'en-US-Joanna', name: 'Joanna (US)', gender: 'female', lang: 'en-US', engine: 'neural', description: 'AWS Polly Joanna — la mejor voz neural' },
  { id: 'en-US-Matthew', name: 'Matthew (US)', gender: 'male', lang: 'en-US', engine: 'neural', description: 'AWS Polly Matthew — profunda y calmada' },
  { id: 'en-US-Ivy', name: 'Ivy (US)', gender: 'female', lang: 'en-US', engine: 'neural', description: 'AWS Polly Ivy — natural americana' },
  // ElevenLabs (generative)
  { id: 'generative', name: 'Generativa Premium', gender: 'female', lang: 'es-ES', engine: 'generative', description: 'ElevenLabs via Puter — calidad máxima' },
];

export interface PuterTTSOptions {
  text: string;
  voice?: string;    // ej: 'es-ES', 'en-US-Joanna', 'generative'
  language?: string;  // ej: 'es-ES', 'en-US'
  engine?: 'standard' | 'neural' | 'generative';
}

// ── Verificar que Puter esté cargado ──────────────────────────────────────────
function checkPuter(): boolean {
  return typeof window !== 'undefined' && (window as any).puter?.ai?.txt2speech !== undefined;
}

// ── Esperar a que Puter cargue ────────────────────────────────────────────────
function waitForPuter(timeout = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (checkPuter()) return resolve();

    const start = Date.now();
    const check = () => {
      if (checkPuter()) return resolve();
      if (Date.now() - start > timeout) {
        reject(new Error('Puter.js no cargó. Revisa la conexión.'));
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}

// ── Convertir voz Puter (engine + voice) a opciones ───────────────────────────
function getVoiceOptions(voiceId: string): { engine: string; voice?: string; language: string } {
  const voice = PUTER_VOICES.find(v => v.id === voiceId) || PUTER_VOICES[0];

  if (voice.id === 'generative') {
    return { engine: 'generative', language: voice.lang };
  }

  if (voice.id.startsWith('en-US-')) {
    // Voces específicas AWS Polly
    return { engine: 'neural', voice: voice.id.replace('en-US-', ''), language: 'en-US' };
  }

  return { engine: voice.engine, language: voice.lang };
}

// ── Sintetizar texto con Puter.js ─────────────────────────────────────────────
export async function synthethizePuterTTS(options: PuterTTSOptions): Promise<Blob> {
  await waitForPuter();

  const puter = (window as any).puter;
  const voiceOpts = getVoiceOptions(options.voice || 'es-ES');

  // Construir opciones
  const opts: any = {
    engine: options.engine || voiceOpts.engine,
    language: options.language || voiceOpts.language,
  };

  if (voiceOpts.voice) {
    opts.voice = voiceOpts.voice;
  }

  // Llamar a Puter TTS
  const audio: HTMLAudioElement = await puter.ai.txt2speech(options.text, opts);

  // Puter devuelve un HTMLAudioElement con src blob URL
  if (!audio.src) {
    throw new Error('Puter TTS no devolvió audio');
  }

  // Obtener el blob desde la URL
  const resp = await fetch(audio.src);
  const blob = await resp.blob();

  return blob;
}

// ── Preview rápido ───────────────────────────────────────────────────────────
export async function previewPuterVoice(voiceId: string): Promise<HTMLAudioElement> {
  await waitForPuter();
  const puter = (window as any).puter;
  const voiceOpts = getVoiceOptions(voiceId);

  const opts: any = {
    engine: voiceOpts.engine,
    language: voiceOpts.language,
  };
  if (voiceOpts.voice) opts.voice = voiceOpts.voice;

  // Preview corto
  const text = voiceId.includes('generative')
    ? "Esta es mi voz generativa. Relájate y escucha..."
    : "Esta es mi voz. Escúchame con atención.";

  const audio: HTMLAudioElement = await puter.ai.txt2speech(text, opts);
  return audio;
}

// ── AudioBuffer → WAV ─────────────────────────────────────────────────────────
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuf = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuf);
  const w = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  w(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  w(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = buffer.getChannelData(0);
  let offset = headerSize;
  for (let i = 0; i < buffer.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([arrayBuf], { type: 'audio/wav' });
}
