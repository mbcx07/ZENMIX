
export type BinauralWaveType = 'delta' | 'theta' | 'alpha' | 'beta' | 'custom';

export interface ProjectConfig {
  id: string;
  name: string;
  carrierFreq: number;
  beatFreq: number;
  noiseLevel: number; 
  usePinkNoise: boolean;
  
  preRollDuration: number; 
  postRollDuration: number; 
  
  binauralVolume: number; 
  voiceVolume: number; 
  
  // Efectos de Voz
  voiceReverb: number; 
  voiceBass: number;   
  voiceTreble: number; 
  voiceEnhance: boolean; // Nuevo: Mejora de ruido y claridad
  
  fadeDuration: number; 
  duckingAmount: number; 
}

export interface SessionData {
  voiceBlob: Blob | null;
  voiceUrl: string | null;
  duration: number; 
}

export interface Preset {
  name: string;
  description: string;
  carrier: number;
  beat: number;
}
