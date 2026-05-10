/**
 * AudioUtils — Polyfill helpers + consistent error types for the ZenMix audio pipeline.
 *
 * - AudioContext / webkitAudioContext fallback for Safari
 * - OfflineAudioContext fallback
 * - Structured AudioError class
 * - Safe decode + resume wrappers
 */

// ── Error types ──────────────────────────────────────────────────────────────

export type AudioErrorCode =
  | 'MICROPHONE_DENIED'
  | 'DECODE_FAILED'
  | 'RENDER_FAILED'
  | 'CONTEXT_SUSPENDED'
  | 'UNSUPPORTED_FORMAT'
  | 'UNSUPPORTED_BROWSER'
  | 'GENERIC';

export class AudioError extends Error {
  public readonly code: AudioErrorCode;

  constructor(message: string, code: AudioErrorCode = 'GENERIC') {
    super(message);
    this.name = 'AudioError';
    this.code = code;
  }
}

// ── Polyfill helpers ─────────────────────────────────────────────────────────

/** Resolves the best available AudioContext constructor (Safari fallback). */
function resolveAudioContextCtor(): typeof AudioContext {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) {
    throw new AudioError(
      'Tu navegador no soporta Web Audio API. Usa Chrome, Firefox, Edge o Safari.',
      'UNSUPPORTED_BROWSER',
    );
  }
  return Ctor;
}

function resolveOfflineCtor(): typeof OfflineAudioContext {
  const Ctor: typeof OfflineAudioContext | undefined =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!Ctor) {
    throw new AudioError(
      'OfflineAudioContext no disponible en este navegador.',
      'UNSUPPORTED_BROWSER',
    );
  }
  return Ctor;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Create a real-time AudioContext (safe cross-browser). */
export function createAudioContext(): AudioContext {
  return new (resolveAudioContextCtor())();
}

/** Create an OfflineAudioContext (safe cross-browser). */
export function createOfflineAudioContext(
  channels: number,
  length: number,
  sampleRate: number,
): OfflineAudioContext {
  return new (resolveOfflineCtor())(channels, length, sampleRate);
}

/** Resume a suspended context (e.g. after user gesture). */
export async function resumeAudioContext(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (e) {
      throw new AudioError(
        'No se pudo activar el motor de audio. Toca cualquier botón para desbloquearlo.',
        'CONTEXT_SUSPENDED',
      );
    }
  }
}

/** Decode audio data with a friendly error message. */
export async function safeDecodeAudioData(
  ctx: BaseAudioContext,
  buffer: ArrayBuffer,
): Promise<AudioBuffer> {
  try {
    return await ctx.decodeAudioData(buffer);
  } catch (e) {
    throw new AudioError(
      'No se pudo decodificar el archivo de audio. Verifica que sea un formato válido (WAV, MP3, WebM).',
      'DECODE_FAILED',
    );
  }
}

/** Format any error into a user-facing string. */
export function formatAudioError(err: unknown): string {
  if (err instanceof AudioError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Error inesperado en el motor de audio. Recarga la página e intenta de nuevo.';
}

/** Check if the browser likely supports the required APIs. */
export function isAudioSupported(): boolean {
  try {
    resolveAudioContextCtor();
    return true;
  } catch {
    return false;
  }
}
