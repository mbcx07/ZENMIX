// ── CLONEVOICE TTS SERVICE ──────────────────────────────────────────────────
// Proxy via Cloudflare Pages Function (/api/clonevoice/)
// La API key se mantiene en el servidor, nunca se expone al frontend
// ─────────────────────────────────────────────────────────────────────────────

const API_PROXY = '/api/clonevoice/';

export const HYPNOSIS_VOICES = [
  { id: 'es-MX-DaliaNeural', name: 'Dalia (MX)', gender: 'female', lang: 'es-MX', engine: 'neural', emotion: 'calm', description: 'Voz femenina mexicana, cálida y calmada — perfecta para hipnosis' },
  { id: 'es-MX-JorgeNeural', name: 'Jorge (MX)', gender: 'male', lang: 'es-MX', engine: 'neural', emotion: 'deep', description: 'Voz masculina mexicana, profunda y serena — ideal para trance' },
  { id: 'es-ES-ElviraNeural', name: 'Elvira (ES)', gender: 'female', lang: 'es-ES', engine: 'neural', emotion: 'calm', description: 'Voz española femenina, melodiosa y envolvente' },
  { id: 'en-US-JoannaNeural', name: 'Joanna (US)', gender: 'female', lang: 'en-US', engine: 'neural', emotion: 'calm', description: 'AWS Polly Joanna — la mejor voz neural para bilingüe' },
  { id: 'en-US-MatthewNeural', name: 'Matthew (US)', gender: 'male', lang: 'en-US', engine: 'neural', emotion: 'deep', description: 'AWS Polly Matthew — profunda, calmada, autoritaria' },
  { id: 'es-US-LupeNeural', name: 'Lupe (US Latam)', gender: 'female', lang: 'es-US', engine: 'neural', emotion: 'calm', description: 'Voz latina femenina, cálida y natural' },
];

export interface CloneVoiceOptions {
  text: string;
  voice_id: string;
  emotion?: 'calm' | 'whisper' | 'melancholic' | 'happy' | 'sad';
  speed?: number;
  pitch?: number;
}

// ── Listar voces clonadas (si tienes) ────────────────────────────────────────
export async function listClonedVoices(): Promise<any[]> {
  const resp = await fetch(`${API_PROXY}voices`);
  if (!resp.ok) throw new Error('Error al conectar con CloneVoice');
  return resp.json();
}

// ── Generar audio de hipnosis ────────────────────────────────────────────────
export async function generateHypnosisAudio(options: CloneVoiceOptions): Promise<Blob> {
  const { text, voice_id, emotion = 'calm', speed = 0.85, pitch = 0 } = options;

  const resp = await fetch(`${API_PROXY}generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice_id,
      language: voice_id.startsWith('en-') ? 'en' : 'es',
      quality: 'high',
      emotion,
      speed,
      pitch,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    let msg = 'Error de conexión';
    try {
      const parsed = JSON.parse(err);
      msg = parsed.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return resp.blob();
}

// ── Preview rápido (texto corto) ─────────────────────────────────────────────
export async function previewVoice(voice_id: string): Promise<void> {
  const previewText = "Hola, soy tu guía de hipnosis. Escúchame con atención... relájate profundamente...";
  const blob = await generateHypnosisAudio({
    text: previewText,
    voice_id,
    emotion: 'calm',
    speed: 0.85,
  });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
}

// ── Procesar texto de hipnosis ────────────────────────────────────────────────
export function processHypnosisText(text: string): string {
  return text
    .replace(/\.\.\./g, '... ')
    .replace(/\(pausa\)/gi, '... ')
    .replace(/\(pausa larga\)/gi, '... ... ')
    .replace(/\(respira\)/gi, '... ')
    .replace(/\(énfasis\)(.*?)\(énfasis\)/gi, '$1')
    .replace(/\(susurro\)(.*?)\(susurro\)/gi, '$1')
    .trim();
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
