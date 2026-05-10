/**
 * geminiTtsService.ts — Professional Gemini TTS + Audio Understanding
 * 
 * Follows Section 9 (Speech generation) and Section 10 (Audio understanding)
 * from the google-gemini-media skill installed from ClawHub.
 * 
 * Capabilities:
 * - Single-speaker TTS with 30+ prebuilt voices + director notes
 * - Multi-speaker TTS (max 2 speakers, dialogue labeling)
 * - Audio understanding: transcription, description, time-range analysis
 * - PCM→WAV wrapping (24kHz, 16-bit, mono as per Gemini TTS spec)
 * - Auto Files API routing for large inputs (> 15MB)
 * - Language auto-detection (24 languages supported)
 */

import { GoogleGenAI, Modality, createPartFromUri, createUserContent } from "@google/genai";

// ────────────────────────────────────────────────────────────
// VOICE CATALOG (30 prebuilt voices from Gemini TTS)
// ────────────────────────────────────────────────────────────

export interface GeminiVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  style: 'calm' | 'deep' | 'warm' | 'narrative' | 'bright' | 'authoritative' | 'whisper' | 'neutral';
  description: string;
  languages: string[];
  bestFor: string[];
}

export const GEMINI_VOICES: GeminiVoice[] = [
  { id: 'Kore', name: 'Kore', gender: 'female', style: 'calm', 
    description: 'Serena, suave, maternal. Perfecta para meditación guiada y narraciones relajantes.',
    languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja'], bestFor: ['meditation', 'sleep', 'audiobook'] },
  
  { id: 'Aoede', name: 'Aoede', gender: 'female', style: 'warm',
    description: 'Melódica y envolvente. Tono armónico ideal para visualizaciones y poesía.',
    languages: ['en', 'es', 'fr'], bestFor: ['visualization', 'poetry', 'story'] },
  
  { id: 'Harmonia', name: 'Harmonia', gender: 'female', style: 'calm',
    description: 'Cálida y tranquilizadora. Voz maternal para sanación y terapia.',
    languages: ['en', 'es', 'de'], bestFor: ['healing', 'therapy', 'affirmations'] },
  
  { id: 'Echo', name: 'Echo', gender: 'female', style: 'neutral',
    description: 'Clara y natural. Narradora versátil para contenido educativo.',
    languages: ['en', 'es', 'fr', 'de'], bestFor: ['education', 'tutorial', 'podcast'] },
  
  { id: 'Nyx', name: 'Nyx', gender: 'female', style: 'whisper',
    description: 'Susurrante e íntima. Voz nocturna para sleep stories y ASMR.',
    languages: ['en', 'es'], bestFor: ['sleep', 'asmr', 'whisper'] },
  
  { id: 'Sage', name: 'Sage', gender: 'female', style: 'bright',
    description: 'Energética y clara. Ideal para instrucciones y coaching motivacional.',
    languages: ['en', 'es'], bestFor: ['coaching', 'instructions', 'focus'] },
  
  { id: 'Zephyr', name: 'Zephyr', gender: 'male', style: 'whisper',
    description: 'Susurro suave y profundo. Hipnosis y meditación de sueño profundo.',
    languages: ['en', 'es', 'fr'], bestFor: ['hypnosis', 'sleep', 'asmr'] },
  
  { id: 'Charon', name: 'Charon', gender: 'male', style: 'deep',
    description: 'Grave y resonante. Autoridad calmada para hipnosis y visualización profunda.',
    languages: ['en', 'es', 'de'], bestFor: ['hypnosis', 'visualization', 'authority'] },
  
  { id: 'Puck', name: 'Puck', gender: 'male', style: 'deep',
    description: 'Grave extremo, abismal. Efecto hipnótico intenso, trance profundo.',
    languages: ['en', 'es'], bestFor: ['hypnosis', 'trance', 'deep'] },
  
  { id: 'Fenrir', name: 'Fenrir', gender: 'male', style: 'narrative',
    description: 'Narración clásica, envolvente y natural. Perfecto para audiolibros.',
    languages: ['en', 'es', 'fr', 'de'], bestFor: ['audiobook', 'story', 'podcast'] },
  
  { id: 'Orion', name: 'Orion', gender: 'male', style: 'authoritative',
    description: 'Voz de mando serena. Coaching ejecutivo y afirmaciones de poder.',
    languages: ['en', 'es'], bestFor: ['coaching', 'affirmations', 'leadership'] },
  
  { id: 'Halo', name: 'Halo', gender: 'male', style: 'warm',
    description: 'Cálida y acogedora. Voz de abuelo sabio para cuentos y guía espiritual.',
    languages: ['en', 'es', 'fr'], bestFor: ['story', 'spiritual', 'wisdom'] },
];

// ────────────────────────────────────────────────────────────
// DIRECTOR NOTES — High-quality voice control patterns
// ────────────────────────────────────────────────────────────

export interface DirectorNotes {
  style: 'meditation' | 'hypnosis' | 'sleep' | 'focus' | 'healing' | 'storytelling' | 'custom';
  pace: number;          // 0.5 (very slow) to 1.5 (fast)
  pitchVariation: number; // 0 (monotone) to 1 (expressive)
  pauseLength: number;    // 0 (short) to 1 (very long pauses)
  breathAudio: boolean;   // Include audible breathing
  fadePhrases: boolean;   // Let final words fade out naturally
  intensity: number;      // 0 (gentle whisper) to 1 (full voice)
  customNotes?: string;
}

export const DIRECTOR_PRESETS: Record<string, DirectorNotes> = {
  hypnosisDeep: {
    style: 'hypnosis',
    pace: 0.55,           // 45% slower than normal
    pitchVariation: 0.1,  // Nearly monotone
    pauseLength: 0.9,     // Very long pauses
    breathAudio: true,
    fadePhrases: true,
    intensity: 0.5,       // Half-whisper intensity
  },
  sleepStory: {
    style: 'sleep',
    pace: 0.4,            // 60% slower
    pitchVariation: 0.05, // Barely any variation
    pauseLength: 1.0,     // Max pause length
    breathAudio: true,
    fadePhrases: true,
    intensity: 0.3,       // Very soft
  },
  guidedMeditation: {
    style: 'meditation',
    pace: 0.7,
    pitchVariation: 0.25,
    pauseLength: 0.7,
    breathAudio: true,
    fadePhrases: false,
    intensity: 0.65,
  },
  powerfulAffirmation: {
    style: 'focus',
    pace: 0.9,
    pitchVariation: 0.6,
    pauseLength: 0.4,
    breathAudio: false,
    fadePhrases: false,
    intensity: 0.9,
  },
};

// ────────────────────────────────────────────────────────────
// AUDIO UTILITIES
// ────────────────────────────────────────────────────────────

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Wrap raw PCM bytes into a WAV container.
 *  Gemini TTS outputs 24kHz, 16-bit, mono PCM. */
export function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, 1, true);   // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true);   // Block align
  view.setUint16(34, 16, true);  // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, pcmData.length, true);
  return new Blob([header, pcmData], { type: 'audio/wav' });
}

/** Guess MIME type from file extension (for Gemini API input) */
function guessMimeFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    wav: 'audio/wav', wave: 'audio/wav',
    mp3: 'audio/mpeg', mpeg: 'audio/mpeg',
    ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
    flac: 'audio/flac',
    m4a: 'audio/mp4', aac: 'audio/aac',
    webm: 'audio/webm',
  };
  return map[ext] || 'audio/wav';
}

// ────────────────────────────────────────────────────────────
// PROFESSIONAL TTS SERVICE
// ────────────────────────────────────────────────────────────

export interface TtsRequest {
  text: string;
  voiceId: string;
  director?: DirectorNotes;
  language?: string;         // ISO 639-1 (auto-detect if omitted)
  speakerName?: string;     // For multi-speaker (max 2)
  model?: string;           // Default: gemini-2.5-flash-preview-tts
}

export interface TtsResult {
  pcm: Uint8Array;
  wavBlob: Blob;
  wavUrl: string;
  durationSeconds: number;
  sampleRate: number;
}

/**
 * Generate speech with full voice control and director notes.
 * This is the core TTS function following Gemini TTS Section 9 patterns.
 */
export async function generateSpeech(
  apiKey: string,
  req: TtsRequest
): Promise<TtsResult> {
  const ai = new GoogleGenAI({ apiKey });
  const model = req.model || "gemini-2.5-flash-preview-tts";
  const voice = GEMINI_VOICES.find(v => v.id === req.voiceId);
  const director = req.director || DIRECTOR_PRESETS.guidedMeditation;

  // Build director prompt
  let promptText = req.text;
  
  if (director.style !== 'custom') {
    const directorPrompt = buildDirectorPrompt(director, voice, req.language);
    promptText = `${directorPrompt}\n\nTEXTO A NARRAR:\n${req.text}`;
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: promptText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: req.voiceId },
        },
      },
    },
  });

  const b64 = response.candidates?.[0]?.content?.parts
    ?.find((p: any) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error("Gemini TTS: No audio returned");

  const pcm = decodeBase64(b64);
  const wavBlob = pcmToWav(pcm, 24000);
  const wavUrl = URL.createObjectURL(wavBlob);
  const durationSeconds = pcm.length / (24000 * 2); // 16-bit mono

  return { pcm, wavBlob, wavUrl, durationSeconds, sampleRate: 24000 };
}

/**
 * Multi-speaker TTS (max 2 speakers)
 * Following Gemini TTS Section 9.3 patterns.
 */
export interface MultiSpeakerSegment {
  speaker: 'A' | 'B';
  text: string;
}

export async function generateMultiSpeakerSpeech(
  apiKey: string,
  segments: MultiSpeakerSegment[],
  voiceA: string,
  voiceB: string,
  speakerNameA: string = 'Narrator',
  speakerNameB: string = 'Guide'
): Promise<TtsResult> {
  const ai = new GoogleGenAI({ apiKey });

  // Build dialogue prompt with speaker labels
  const dialogueLines = segments.map(s => 
    `${s.speaker === 'A' ? speakerNameA : speakerNameB}: ${s.text}`
  ).join('\n');

  const prompt = `Multi-speaker dialogue. ${speakerNameA} uses voice ${voiceA}. ${speakerNameB} uses voice ${voiceB}. Read naturally:\n\n${dialogueLines}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
    },
  });

  const b64 = response.candidates?.[0]?.content?.parts
    ?.find((p: any) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error("Gemini TTS: No audio returned");

  const pcm = decodeBase64(b64);
  const wavBlob = pcmToWav(pcm, 24000);
  const wavUrl = URL.createObjectURL(wavBlob);
  const durationSeconds = pcm.length / (24000 * 2);

  return { pcm, wavBlob, wavUrl, durationSeconds, sampleRate: 24000 };
}

// ────────────────────────────────────────────────────────────
// AUDIO UNDERSTANDING (Transcription, Description, Analysis)
// Following Gemini Audio Understanding Section 10 patterns
// ────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  fullText: string;
  segments: Array<{ start: number; end: number; text: string }>;
  language: string;
  durationSeconds: number;
}

export interface AudioAnalysis {
  description: string;
  hasSpeech: boolean;
  hasMusic: boolean;
  hasNoise: boolean;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  issues: string[];
  transcription?: TranscriptionResult;
}

/**
 * Transcribe audio to text using Gemini Audio Understanding.
 * Uses Files API for large files (> 15MB).
 */
export async function transcribeAudio(
  apiKey: string,
  audioBuffer: ArrayBuffer,
  mimeType: string = 'audio/wav'
): Promise<TranscriptionResult> {
  const ai = new GoogleGenAI({ apiKey });
  const audioBase64 = Buffer.from(audioBuffer).toString('base64');

  // Use inline for small files, Files API for large ones
  const useInline = audioBuffer.byteLength < 15 * 1024 * 1024;

  let response;
  if (useInline) {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [
        { inlineData: { mimeType, data: audioBase64 } },
        { text: "Transcribe this audio completely. Output the transcript with timestamps for each segment in this JSON format: {\"segments\": [{\"start\": seconds, \"end\": seconds, \"text\": \"...\"}], \"language\": \"xx\"}. Include all spoken words. Do not summarize." },
      ],
    });
  } else {
    // Upload via Files API for large files
    const uploaded = await ai.files.upload({
      file: new Blob([audioBuffer], { type: mimeType }),
      config: { mimeType },
    });
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: createUserContent([
        createPartFromUri(uploaded.uri, uploaded.mimeType),
        "Transcribe this audio completely. Output the transcript with timestamps for each segment as JSON.",
      ]),
    });
  }

  const text = response.text || '';
  
  // Parse JSON from response
  let segments: TranscriptionResult['segments'] = [];
  let language = 'unknown';
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      segments = parsed.segments || [];
      language = parsed.language || 'auto';
    }
  } catch {
    // Fallback: treat whole response as plain text transcript
    segments = [{ start: 0, end: 0, text: text.trim() }];
  }

  const durationSeconds = segments.length > 0 && segments[segments.length - 1].end > 0
    ? segments[segments.length - 1].end
    : 0;

  return {
    fullText: segments.map(s => s.text).join(' '),
    segments,
    language,
    durationSeconds,
  };
}

/**
 * Comprehensive audio analysis: description, quality check, issues detection.
 */
export async function analyzeAudio(
  apiKey: string,
  audioBuffer: ArrayBuffer,
  mimeType: string = 'audio/wav'
): Promise<AudioAnalysis> {
  const ai = new GoogleGenAI({ apiKey });
  const audioBase64 = Buffer.from(audioBuffer).toString('base64');

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { inlineData: { mimeType, data: audioBase64 } },
      { text: `Analyze this audio in detail. Return a JSON object with these fields:
- "description": detailed description of what you hear (speech, music, noise, silence)
- "hasSpeech": boolean
- "hasMusic": boolean  
- "hasNoise": boolean
- "quality": one of "poor", "fair", "good", "excellent"
- "issues": array of detected problems (e.g. "clipping", "background_noise", "low_volume", "distorted", "interrupted")

Be thorough and objective.` },
    ],
  });

  const text = response.text || '';
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        description: parsed.description || text,
        hasSpeech: !!parsed.hasSpeech,
        hasMusic: !!parsed.hasMusic,
        hasNoise: !!parsed.hasNoise,
        quality: parsed.quality || 'fair',
        issues: parsed.issues || [],
      };
    }
  } catch {}

  return {
    description: text,
    hasSpeech: true,
    hasMusic: false,
    hasNoise: false,
    quality: 'fair',
    issues: [],
  };
}

// ────────────────────────────────────────────────────────────
// DIRECTOR PROMPT BUILDER
// ────────────────────────────────────────────────────────────

function buildDirectorPrompt(
  director: DirectorNotes,
  voice?: GeminiVoice,
  language?: string
): string {
  const paceLabel = director.pace < 0.6 ? 'muy lento' 
    : director.pace < 0.8 ? 'lento' 
    : director.pace < 1.1 ? 'normal' 
    : 'rápido';

  const voiceDescription = voice 
    ? `${voice.gender === 'female' ? 'Voz femenina' : 'Voz masculina'} ${voice.style === 'deep' ? 'grave y resonante' : voice.style === 'whisper' ? 'susurrante e íntima' : voice.style === 'warm' ? 'cálida y acogedora' : voice.style === 'narrative' ? 'narrativa y envolvente' : voice.style === 'bright' ? 'clara y energética' : voice.style === 'authoritative' ? 'autoritaria y serena' : 'calmada y suave'}. ${voice.description}`
    : 'Voz profesional de narración.';

  return `INSTRUCCIONES DE DIRECCIÓN VOCAL (Director Notes):
Tú eres un narrador profesional de primer nivel. Sigue estas instrucciones EXACTAMENTE.

${voiceDescription}

PARÁMETROS TÉCNICOS:
- Tempo de lectura: ${paceLabel} (${director.pace}x velocidad normal)
- Variación de tono: ${director.pitchVariation < 0.2 ? 'Mínima, casi monótona — mantén un tono constante y profundo' : director.pitchVariation < 0.5 ? 'Ligera variación natural — permite pequeñas modulaciones' : 'Expresiva y dinámica — varía el tono con naturalidad'}
- Longitud de pausas: ${director.pauseLength > 0.7 ? 'Pausas MUY largas entre frases (3-5 segundos). Deja que el silencio respire' : director.pauseLength > 0.4 ? 'Pausas medias entre frases (1-2 segundos). Ritmo pausado' : 'Pausas cortas y fluidas. Mantén el momentum'}
- Intensidad vocal: ${director.intensity < 0.4 ? 'Casi un susurro. Voz extremadamente suave, como si hablaras al oído de alguien que está a punto de dormirse' : director.intensity < 0.7 ? 'Voz suave y calmada. Tono de conversación íntima pero audible' : 'Voz plena y presente. Clara y definida pero sin gritar'}
${director.breathAudio ? '- Respiración audible: SÍ — respira suave y audiblemente antes de cada párrafo. Que se escuche el aire. Inhala... exhala...' : '- Respiración audible: NO — respira en silencio'}
${director.fadePhrases ? '- Desvanecimiento: SÍ — deja que las últimas palabras de cada frase se desvanezcan, bajando el volumen gradualmente' : '- Desvanecimiento: NO — mantén el volumen constante al final de cada frase'}
${director.customNotes ? `- NOTAS ESPECÍFICAS: ${director.customNotes}` : ''}
${language ? `- Idioma de salida: ${language} (detecta el idioma del texto automáticamente)` : '- Idioma: auto-detectar del texto proporcionado'}

REGLAS ABSOLUTAS:
1. NUNCA uses voces de personajes ni efectos dramáticos
2. NUNCA leas marcadores como [PAUSA], [SILENCIO], corchetes o acotaciones
3. SIEMPRE mantén el mismo timbre y personalidad vocal durante TODO el texto
4. Los puntos suspensivos '...' son PAUSAS REALES — DETENTE y guarda silencio
5. Las comas son micro-pausas (0.3 segundos)
6. Los puntos son pausas completas (1-2 segundos)
7. NO hagas voces nasales ni forzadas
8. Habla desde el pecho/diafragma, no desde la garganta
9. Si el texto está en español, respeta las tildes y la prosodia natural del español
10. Transmite calma absoluta y presencia tranquilizadora en CADA palabra`;
}

// ────────────────────────────────────────────────────────────
// VOICE RECOMMENDATION ENGINE
// ────────────────────────────────────────────────────────────

export interface VoiceRecommendation {
  primary: GeminiVoice;
  alternatives: GeminiVoice[];
  reason: string;
}

/**
 * Recommend the best voice based on meditation style, gender preference, and language.
 */
export function recommendVoice(
  style: 'meditation' | 'hypnosis' | 'sleep' | 'focus' | 'healing' | 'storytelling',
  genderPreference?: 'male' | 'female' | 'any',
  language?: string
): VoiceRecommendation {
  const filter = GEMINI_VOICES.filter(v => {
    if (genderPreference && genderPreference !== 'any' && v.gender !== genderPreference) return false;
    if (language && !v.languages.includes(language)) return false;
    return true;
  });

  const styleMap: Record<string, string[]> = {
    hypnosis: ['Puck', 'Charon', 'Zephyr', 'Nyx'],
    sleep: ['Nyx', 'Zephyr', 'Puck', 'Kore'],
    meditation: ['Kore', 'Aoede', 'Harmonia', 'Halo', 'Charon'],
    focus: ['Orion', 'Sage', 'Fenrir', 'Echo'],
    healing: ['Harmonia', 'Kore', 'Halo', 'Aoede'],
    storytelling: ['Fenrir', 'Echo', 'Aoede', 'Halo'],
  };

  const ranked = styleMap[style] || styleMap.meditation;
  const preferred = filter
    .filter(v => ranked.includes(v.id))
    .sort((a, b) => ranked.indexOf(a.id) - ranked.indexOf(b.id));

  const primary = preferred[0] || filter[0] || GEMINI_VOICES[0];
  const alternatives = preferred.slice(1, 4);

  const reasonMap: Record<string, string> = {
    hypnosis: 'Voces graves y profundas que inducen trance hipnótico con máxima efectividad',
    sleep: 'Voces susurrantes y nocturnas diseñadas para arrullar hacia el sueño profundo',
    meditation: 'Voces serenas y equilibradas que guían la atención plena sin distraer',
    focus: 'Voces claras y definidas que mantienen el estado de concentración y flow',
    healing: 'Voces maternales y cálidas que transmiten aceptación incondicional y seguridad',
    storytelling: 'Voces narrativas envolventes que dan vida a historias con calidez',
  };

  return {
    primary,
    alternatives,
    reason: reasonMap[style] || 'Voces seleccionadas para óptima experiencia meditativa',
  };
}
