// ── GOOGLE TTS SERVICE — voz principal de ZENMIX ────────────────────────────
// Google Cloud Text-to-Speech Neural2 — calidad profesional para hipnosis
// API key configurada en el servidor local (/api/tts)
// ─────────────────────────────────────────────────────────────────────────────

export const HYPNOSIS_VOICES = [
  { id: 'google-tts', name: 'Google Neural2', gender: 'female', lang: 'es', engine: 'cloud', emotion: 'calm', description: '☁️ Voz neural de Google — calidad profesional para hipnosis' },
  { id: 'piper-es', name: 'Piper (Local CPU)', gender: 'neutral', lang: 'es', engine: 'local', emotion: 'calm', description: '🧠 TTS local en CPU — sin internet, sin límites' },
];

export interface TTSOptions {
  text: string;
  voice_id: string;
  speed?: number;
}

// ── Generar audio con Google TTS o Piper ────────────────────────────────────
export async function generateHypnosisAudio(options: TTSOptions): Promise<Blob> {
  const { text, voice_id, speed = 0.85 } = options;

  // Piper local
  if (voice_id === 'piper-es') {
    const resp = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: 'piper-es',
        reverb: 50,
        echo: 0,
        bass: 30,
      }),
    });
    if (!resp.ok) throw new Error('Piper: servidor local no disponible');
    return resp.blob();
  }

  // Google TTS (voz por defecto)
  const resp = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: 'google-tts',
      speed: speed,
      reverb: 50,
      echo: 0,
      bass: 30,
    }),
  });
  if (!resp.ok) throw new Error('Google TTS: error al generar audio');
  return resp.blob();
}

// ── Preview rápido ───────────────────────────────────────────────────────────
export async function previewVoice(): Promise<void> {
  const blob = await generateHypnosisAudio({
    text: "Hola... soy tu guía de hipnosis... relájate profundamente...",
    voice_id: 'google-tts',
    speed: 0.8,
  });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
}

// ── AudioBuffer → WAV ────────────────────────────────────────────────────────
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
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

  for (let ch = 0; ch < numChannels; ch++) {
    const data = ch < buffer.numberOfChannels ? buffer.getChannelData(ch) : buffer.getChannelData(0);
    let offset = headerSize + ch * 2;
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += blockAlign;
    }
  }

  return new Blob([buf], { type: 'audio/wav' });
}
