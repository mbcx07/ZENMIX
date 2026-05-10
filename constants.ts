import { Preset, ProjectConfig } from './types';

// ── PRESETS TERAPÉUTICOS ORIGINALES ────────────────────────────────────────────
export const BINAURAL_PRESETS: Preset[] = [
  { name: 'TDAH: Enfoque Láser', description: 'SMR 12Hz. Mejora la atención sostenida.', carrier: 155, beat: 12 },
  { name: 'Autismo: Calma Segura', description: 'Theta 5.5Hz. Regular el sistema nervioso.', carrier: 110, beat: 5.5 },
  { name: 'TDAH + Autismo: Foco Zen', description: 'Alpha 7.83Hz (Schumann). Enraizamiento.', carrier: 125, beat: 7.83 },
  { name: 'TDAH: Impulso Ejecutivo', description: 'Beta 15.5Hz. Activa organización.', carrier: 200, beat: 15.5 },
  { name: 'Autismo: Procesamiento', description: 'Delta 2.5Hz. Integra info sensorial.', carrier: 95, beat: 2.5 },
  { name: 'Hipersensibilidad', description: 'Theta 4.0Hz. Frecuencia de aislamiento.', carrier: 105, beat: 4.0 },
  { name: 'Trauma: Liberación Somática', description: 'Theta 4.5Hz. Procesa memorias corporales.', carrier: 174, beat: 4.5 },
  { name: 'Hipnosis: Perdón Profundo', description: 'Theta 5.8Hz. Facilita el desapego.', carrier: 195, beat: 5.8 },
  { name: 'Regeneración Muscular', description: 'Delta 1.0Hz. Reparación de tejidos.', carrier: 111, beat: 1.0 },
  { name: 'Viaje Astral: Fase Salida', description: 'Theta 6.3Hz. Umbral de proyección.', carrier: 145, beat: 6.3 },
  { name: 'Estado de Flow', description: 'Alpha 12.0Hz. Creatividad sin esfuerzo.', carrier: 205, beat: 12.0 },
];

// ── PRESETS POR CATEGORÍA DE ONDA CEREBRAL ─────────────────────────────────────
// Delta (1-4Hz)   → Sueño profundo, regeneración
// Theta (4-8Hz)   → Meditación, creatividad, hipnosis
// Alpha (8-14Hz)  → Relajación, flow, aprendizaje pasivo
// Beta (14-30Hz)  → Concentración, enfoque, energía mental

export const DELTA_PRESETS: Preset[] = [
  { name: 'Sueño Profundo', description: 'Delta 1.0Hz. Máxima regeneración celular y GH.', carrier: 100, beat: 1.0 },
  { name: 'Sueño Restaurador', description: 'Delta 2.0Hz. Sueño REM profundo sin despertares.', carrier: 120, beat: 2.0 },
  { name: 'Sanación Delta', description: 'Delta 3.0Hz. Estimula sistema inmune y reparación.', carrier: 140, beat: 3.0 },
  { name: 'Regeneración Profunda', description: 'Delta 3.5Hz. Liberación de melatonina natural.', carrier: 110, beat: 3.5 },
  { name: 'Anestesia Natural', description: 'Delta 1.5Hz. Alivio de dolor crónico y tensión.', carrier: 90, beat: 1.5 },
];

export const THETA_PRESETS: Preset[] = [
  { name: 'Meditación Profunda', description: 'Theta 5.0Hz. Puerta al subconsciente.', carrier: 150, beat: 5.0 },
  { name: 'Creatividad Expandida', description: 'Theta 6.0Hz. Acceso a insights y soluciones.', carrier: 160, beat: 6.0 },
  { name: 'Visualización Guiada', description: 'Theta 7.0Hz. Imágenes mentales vívidas.', carrier: 140, beat: 7.0 },
  { name: 'Intuición Despierta', description: 'Theta 7.5Hz. Conexión con sabiduría interior.', carrier: 180, beat: 7.5 },
  { name: 'Trance Ligero', description: 'Theta 4.5Hz. Hipnosis y reprogramación mental.', carrier: 130, beat: 4.5 },
];

export const ALPHA_PRESETS: Preset[] = [
  { name: 'Relajación Serena', description: 'Alpha 8.0Hz. Calma y equilibrio emocional.', carrier: 200, beat: 8.0 },
  { name: 'Resonancia Schumann', description: 'Alpha 7.83Hz. Sincronización con la Tierra.', carrier: 125, beat: 7.83 },
  { name: 'Flow Creativo', description: 'Alpha 10.0Hz. Estado óptimo de rendimiento.', carrier: 210, beat: 10.0 },
  { name: 'Aprendizaje Acelerado', description: 'Alpha 12.0Hz. Retención y memoria mejorada.', carrier: 190, beat: 12.0 },
  { name: 'Mindfulness Alfa', description: 'Alpha 9.0Hz. Presencia consciente plena.', carrier: 180, beat: 9.0 },
];

export const BETA_PRESETS: Preset[] = [
  { name: 'Concentración Activa', description: 'Beta 15.0Hz. Foco sostenido sin fatiga.', carrier: 220, beat: 15.0 },
  { name: 'Energía Mental', description: 'Beta 18.0Hz. Claridad y agilidad cognitiva.', carrier: 250, beat: 18.0 },
  { name: 'Hiperenfoque', description: 'Beta 20.0Hz. Máxima productividad y fluidez.', carrier: 280, beat: 20.0 },
  { name: 'Alerta Optimizada', description: 'Beta 25.0Hz. Vigilia sin ansiedad.', carrier: 300, beat: 25.0 },
  { name: 'Rendimiento Cognitivo', description: 'Beta 16.5Hz. Resolución de problemas.', carrier: 240, beat: 16.5 },
];

// ── MAPEO DE CATEGORÍAS ────────────────────────────────────────────────────────
export const BRAINWAVE_CATEGORIES = [
  { key: 'delta', label: 'Delta (1-4Hz)', sublabel: 'Sueño Profundo', presets: DELTA_PRESETS, color: 'indigo' },
  { key: 'theta', label: 'Theta (4-8Hz)', sublabel: 'Meditación', presets: THETA_PRESETS, color: 'purple' },
  { key: 'alpha', label: 'Alpha (8-14Hz)', sublabel: 'Relajación', presets: ALPHA_PRESETS, color: 'teal' },
  { key: 'beta', label: 'Beta (14-30Hz)', sublabel: 'Concentración', presets: BETA_PRESETS, color: 'amber' },
] as const;

// ── ALL PRESETS COMBINADO (para búsqueda) ──────────────────────────────────────
export const ALL_PRESETS: Preset[] = [
  ...DELTA_PRESETS,
  ...THETA_PRESETS,
  ...ALPHA_PRESETS,
  ...BETA_PRESETS,
];

// ── DEFAULT CONFIG ─────────────────────────────────────────────────────────────
export const DEFAULT_CONFIG: ProjectConfig = {
  id: 'new-project',
  name: 'Nueva Meditación Zen',
  carrierFreq: 200,
  beatFreq: 6,
  noiseLevel: 0.1,
  usePinkNoise: true,
  preRollDuration: 60,
  postRollDuration: 120,
  binauralVolume: 0.35,
  voiceVolume: 0.9,
  voiceReverb: 0.25,
  voiceBass: 3,
  voiceTreble: 4,
  voiceEnhance: true,
  fadeDuration: 3000,
  duckingAmount: 0.4,
};
