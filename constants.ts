
import { Preset, ProjectConfig } from './types';

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
