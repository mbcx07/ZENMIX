// ── CLONEVOICE TTS SERVICE ──────────────────────────────────────────────────
// Integración con API de CloneVoice.app (voiceclone.cloud)
// Voces neuronales con EmotionFX para hipnosis profesional.
// Requiere API key: sk_8e2mlFaYTPZqYlOvS4ioTb33LfHmtMfJ
// ─────────────────────────────────────────────────────────────────────────────

import cloneVoiceCreds from '../credentials/clonevoice.json';

const API_KEY = cloneVoiceCreds.apiKey;
const BASE_URL = 'https://voiceclone.cloud/v1';

export interface CloneVoiceInfo {
  voice_id: string;
  name: string;
  language: string;
  status: string;
  created_at: string;
  preview_url?: string;
}

export interface CloneVoiceGenerateOptions {
  text: string;
  voice_id: string;
  language?: string;
  quality?: 'standard' | 'high';
  emotion?: 'happy' | 'sad' | 'angry' | 'afraid' | 'disgusted' | 'melancholic' | 'surprised' | 'calm';
  speed?: number;  // 0.5 - 2.0
  pitch?: number;  // -10 to +10
}

// ── Voces recomendadas para hipnosis (pre-clonadas en la cuenta) ──────────────
// Estas voice_ids deben existir en la cuenta de CloneVoice del usuario.
// Si no existen, el usuario debe clonarlas primero desde clonevoice.ai
export const HYPNOSIS_VOICES: { id: string; name: string; desc: string }[] = [
  { id: 'cv_hypnosis_es_calm', name: 'Voz Hipnosis Calmada', desc: 'Femenina, serena, ideal para inducción' },
  { id: 'cv_hypnosis_es_deep', name: 'Voz Hipnosis Profunda', desc: 'Masculina, grave, para trance profundo' },
  { id: 'cv_hypnosis_es_whisper', name: 'Voz Hipnosis Susurro', desc: 'Susurrante, para sueño y relajación' },
  { id: 'cv_custom_voice', name: 'Tu Voz Clonada', desc: 'Tu propia voz clonada desde CloneVoice' },
];

// ⚠️ TEMPORAL: Usar TTS directo mientras se clonan voces
// CloneVoice tiene voces pre-hechas disponibles para generar sin clonar
export async function listVoices(): Promise<CloneVoiceInfo[]> {
  const resp = await fetch(`${BASE_URL}/voices`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  if (!resp.ok) throw new Error(`Error al listar voces: ${resp.status}`);
  return resp.json();
}

// ── Generar audio con CloneVoice ─────────────────────────────────────────────
export async function generateCloneVoice(options: CloneVoiceGenerateOptions): Promise<Blob> {
  const { text, voice_id, language = 'es', quality = 'high', emotion = 'calm', speed = 1.0, pitch = 0 } = options;

  const resp = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      voice_id,
      language,
      quality,
      emotion,
      speed,
      pitch
    })
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`CloneVoice error ${resp.status}: ${errBody}`);
  }

  return await resp.blob();
}

// ── Generar audio con emoción de hipnosis (atajo) ────────────────────────────
export async function generateHypnosisAudio(
  text: string,
  voice_id: string,
  emotion: 'calm' | 'whisper' | 'melancholic' = 'calm',
  speed: number = 0.85
): Promise<Blob> {
  return generateCloneVoice({
    text,
    voice_id,
    language: 'es',
    quality: 'high',
    emotion,
    speed,
    pitch: emotion === 'calm' ? -1 : emotion === 'whisper' ? -2 : 0
  });
}

// ── Procesar texto con marcadores de hipnosis ────────────────────────────────
export function processHypnosisText(text: string): string {
  return text
    // Pausas largas
    .replace(/\.\.\./g, '... ')
    .replace(/\(pausa\)/gi, '... ')
    .replace(/\(pausa larga\)/gi, '... ... ')
    // Respiraciones
    .replace(/\(respira\)/gi, '... *respira* ... ')
    .replace(/\(inhala\)/gi, '... inhala ... ')
    .replace(/\(exhala\)/gi, '... exhala ... ')
    // Énfasis (CloneVoice soporta emociones inline?)
    .replace(/\(énfasis\)(.*?)\(énfasis\)/gi, '$1')
    .replace(/\(susurro\)(.*?)\(susurro\)/gi, '$1')
    .trim();
}

// ── Verificar que la API key funciona ────────────────────────────────────────
export async function testConnection(): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/voices`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    return resp.ok;
  } catch {
    return false;
  }
}
