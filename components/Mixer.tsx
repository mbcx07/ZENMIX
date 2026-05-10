
import React, { memo, useState, useRef, useEffect, useCallback, startTransition } from 'react';
import { ProjectConfig, SessionData } from '../types';
import { BINAURAL_PRESETS, BRAINWAVE_CATEGORIES } from '../constants';
import { Volume2, Clock, Activity, Mic, Waves, Play, Pause, Sparkles, Zap, BarChart3, Settings2, Sliders, Wind, Radio, Info, Moon, Brain, Coffee, Eye, HelpCircle } from 'lucide-react';
import { createPinkNoiseBuffer } from '../services/audioEngine';
import { createAudioContext, safeDecodeAudioData, formatAudioError } from '../services/audioUtils';

// ── Impulso de reverb natural para preview (versión ligera) ──
const createPreviewReverbImpulse = (ctx: AudioContext): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const duration = 2.5;
  const rt60 = 1.3;
  const length = Math.ceil(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    const erCount = ch === 0 ? 10 : 12;
    // Early reflections
    for (let e = 0; e < erCount; e++) {
      const t = 0.005 + 0.055 * (e / erCount) + (Math.random() - 0.5) * 0.003;
      const idx = Math.floor(t * sampleRate);
      if (idx < length) {
        data[idx] = (1 - e / erCount) * 0.3 * (0.7 + Math.random() * 0.3) * (e % 2 === 0 ? 1 : -1);
      }
    }
    // Late reflections con filtro lowpass
    let b0 = 0, b1 = 0;
    const lateStart = Math.floor(0.06 * sampleRate);
    for (let i = lateStart; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-3 * t / rt60);
      const noise = (Math.random() * 2 - 1) * 0.25;
      const cutoff = 10000 * Math.exp(-t * 3);
      const alpha = Math.exp(-2 * Math.PI * cutoff / sampleRate);
      b0 = b0 + alpha * (noise - b0);
      b1 = b1 + alpha * (b0 - b1);
      data[i] = b1 * env * 0.5;
    }
  }
  return impulse;
};

interface MixerProps {
  config: ProjectConfig;
  setConfig: React.Dispatch<React.SetStateAction<ProjectConfig>>;
  session: SessionData;
}

const TOOLTIPS: Record<string, string> = {
  voiceVolume: 'Controla el nivel general de la narración. Ajusta para balancear con las ondas binaurales.',
  binauralVolume: 'Intensidad de las ondas binaurales. Volúmenes altos pueden causar fatiga auditiva.',
  duckingAmount: 'Reduce automáticamente el volumen binaural cuando hay voz activa. 0 = sin atenuación.',
  usePinkNoise: 'Sonido de fondo tipo cascada o viento suave. Mejora el enmascaramiento y la relajación.',
  noiseLevel: 'Intensidad del ruido rosa de fondo. Ajusta para un ambiente sonoro envolvente.',
  voiceBass: 'Ecualizador shelving de graves. Valores positivos añaden calidez y cuerpo a la voz.',
  voiceTreble: 'Ecualizador shelving de agudos. Valores positivos mejoran claridad y presencia.',
  voiceReverb: 'Simula una sala acústica. Más espacio = mayor sensación de profundidad ambiental.',
  carrierFreq: 'Frecuencia portadora base de las ondas binaurales (40-1000 Hz). Define el tono central.',
  beatFreq: 'Diferencia de frecuencia entre oídos. Define el estado mental: Delta (0.5-4), Theta (4-8), Alpha (8-14), Beta (14-30).',
  voiceEnhance: 'Filtro pasa-altos + compresor para limpiar ruido de fondo y ecualizar la voz automáticamente.',
};

// ── Tooltip component ──
const TooltipHelp: React.FC<{ text: string }> = ({ text }) => (
  <span className="group relative inline-flex align-middle ml-1">
    <HelpCircle size={12} className="text-sage-400 cursor-help hover:text-sage-700 transition-colors" />
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 sm:w-56 p-2 bg-sage-900 text-white text-[9px] leading-relaxed rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl border border-sage-700 pointer-events-none" style={{ whiteSpace: 'normal' }}>
      {text}
    </span>
  </span>
);

const Mixer: React.FC<MixerProps> = ({ config, setConfig, session }) => {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Nodos de Audio Ref
  const voiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const enhanceFilterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const voiceMasterGainRef = useRef<GainNode | null>(null);
  const leftOscRef = useRef<OscillatorNode | null>(null);
  const rightOscRef = useRef<OscillatorNode | null>(null);
  const binauralGainRef = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);

  // 🔥 Use startTransition for non-urgent config updates (sliders, knobs)
  // This keeps the UI responsive during rapid slider changes
  const handleChange = useCallback((key: keyof ProjectConfig, value: any) => {
    startTransition(() => {
      setConfig(prev => ({ ...prev, [key]: value }));
    });
  }, [setConfig]);

  const drawVisualizer = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#0a0f0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#84a183';
      ctx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      
      ctx.strokeStyle = 'rgba(132, 161, 131, 0.1)';
      ctx.lineWidth = 1;
      for(let i=0; i<canvas.width; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
    };
    draw();
  }, []);

  useEffect(() => {
    if (!audioCtxRef.current || !isPreviewing) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    if (enhanceFilterRef.current) {
        enhanceFilterRef.current.frequency.setTargetAtTime(config.voiceEnhance ? 100 : 20, now, 0.05);
    }
    if (compressorRef.current) {
        compressorRef.current.threshold.setTargetAtTime(config.voiceEnhance ? -26 : 0, now, 0.05);
        compressorRef.current.ratio.setTargetAtTime(config.voiceEnhance ? 5 : 1, now, 0.05);
    }
    if (bassFilterRef.current) bassFilterRef.current.gain.setTargetAtTime(config.voiceBass, now, 0.05);
    if (trebleFilterRef.current) trebleFilterRef.current.gain.setTargetAtTime(config.voiceTreble, now, 0.05);
    if (wetGainRef.current) wetGainRef.current.gain.setTargetAtTime(config.voiceReverb * 1.3, now, 0.05);
    if (dryGainRef.current) dryGainRef.current.gain.setTargetAtTime(1.0 - (config.voiceReverb * 0.4), now, 0.05);
    if (voiceMasterGainRef.current) voiceMasterGainRef.current.gain.setTargetAtTime(config.voiceVolume, now, 0.05);
    
    if (leftOscRef.current) leftOscRef.current.frequency.setTargetAtTime(config.carrierFreq - config.beatFreq / 2, now, 0.05);
    if (rightOscRef.current) rightOscRef.current.frequency.setTargetAtTime(config.carrierFreq + config.beatFreq / 2, now, 0.05);
    
    if (binauralGainRef.current) {
        const targetVol = config.voiceVolume > 0.05 ? config.binauralVolume * (1 - config.duckingAmount) : config.binauralVolume;
        binauralGainRef.current.gain.setTargetAtTime(targetVol, now, 0.1);
    }
    if (noiseGainRef.current) {
        noiseGainRef.current.gain.setTargetAtTime(config.usePinkNoise ? config.noiseLevel * 0.3 : 0, now, 0.1);
    }
  }, [config, isPreviewing]);

  const stopPreview = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    [voiceSourceRef, leftOscRef, rightOscRef, noiseSourceRef].forEach(ref => {
      if (ref.current) { try { ref.current.stop(); } catch(e) {} ref.current = null; }
    });
    // 🔥 Close AudioContext to free system audio resources
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    }
    // 🔥 Nullify all node refs to allow GC
    [enhanceFilterRef, compressorRef, bassFilterRef, trebleFilterRef, reverbRef, wetGainRef, dryGainRef, voiceMasterGainRef, binauralGainRef, noiseGainRef].forEach(ref => {
      ref.current = null;
    });
    setIsPreviewing(false);
  }, []);

  const startPreview = async () => {
    if (isPreviewing) { stopPreview(); return; }
    if (!session.voiceBlob) return;

    try {
      audioCtxRef.current = createAudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      
      const arrayBuffer = await session.voiceBlob.arrayBuffer();
      const audioBuffer = await safeDecodeAudioData(ctx, arrayBuffer);
      
      const vSource = ctx.createBufferSource();
      vSource.buffer = audioBuffer;
      vSource.loop = true; 
      voiceSourceRef.current = vSource;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const enh = ctx.createBiquadFilter();
      enh.type = 'highpass';
      enh.frequency.value = config.voiceEnhance ? 100 : 20;
      enhanceFilterRef.current = enh;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = config.voiceEnhance ? -26 : 0;
      comp.ratio.value = config.voiceEnhance ? 5 : 1;
      compressorRef.current = comp;

      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 250;
      bass.gain.value = config.voiceBass;
      bassFilterRef.current = bass;

      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 3500;
      treble.gain.value = config.voiceTreble;
      trebleFilterRef.current = treble;

      const reverbNode = ctx.createConvolver();
      reverbNode.buffer = createPreviewReverbImpulse(ctx);
      reverbRef.current = reverbNode;

      const wet = ctx.createGain();
      wet.gain.value = config.voiceReverb * 1.3;
      wetGainRef.current = wet;

      const dry = ctx.createGain();
      dry.gain.value = 1.0 - (config.voiceReverb * 0.4);
      dryGainRef.current = dry;

      const vMaster = ctx.createGain();
      vMaster.gain.value = config.voiceVolume;
      voiceMasterGainRef.current = vMaster;

      vSource.connect(enh);
      enh.connect(comp);
      comp.connect(bass);
      bass.connect(treble);
      treble.connect(dry);
      treble.connect(reverbNode);
      reverbNode.connect(wet);
      dry.connect(vMaster);
      wet.connect(vMaster);
      vMaster.connect(analyser);
      vMaster.connect(ctx.destination);

      const lOsc = ctx.createOscillator();
      const rOsc = ctx.createOscillator();
      const bGain = ctx.createGain();
      const merger = ctx.createChannelMerger(2);
      lOsc.frequency.value = config.carrierFreq - config.beatFreq / 2;
      rOsc.frequency.value = config.carrierFreq + config.beatFreq / 2;
      bGain.gain.value = config.binauralVolume;
      leftOscRef.current = lOsc;
      rightOscRef.current = rOsc;
      binauralGainRef.current = bGain;
      
      lOsc.connect(merger, 0, 0);
      rOsc.connect(merger, 0, 1);
      merger.connect(bGain);
      bGain.connect(analyser);
      bGain.connect(ctx.destination);

      const nSource = ctx.createBufferSource();
      nSource.buffer = createPinkNoiseBuffer(ctx, 10);
      // El pink noise ya es estéreo en la nueva implementación
      nSource.loop = true;
      const nGain = ctx.createGain();
      nGain.gain.value = config.usePinkNoise ? config.noiseLevel * 0.3 : 0;
      noiseSourceRef.current = nSource;
      noiseGainRef.current = nGain;
      nSource.connect(nGain);
      nGain.connect(ctx.destination);
      nSource.start(0);

      vSource.start(0);
      lOsc.start(0);
      rOsc.start(0);
      setIsPreviewing(true);
      drawVisualizer();
    } catch(e) {
      console.error(e);
      alert(formatAudioError(e));
    }
  };

  useEffect(() => { return () => stopPreview(); }, [stopPreview]);

  return (
    <div className="space-y-10 pb-32">
      {/* MONITOR STUDIO (DARK) */}
      <section className="dark-studio-card p-10 rounded-[3rem] space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${isPreviewing ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)]' : 'bg-sage-800 border border-sage-600'}`}>
              <BarChart3 size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Consola de Monitoreo</h3>
              <div className="flex items-center gap-2">
                 <span className={`w-2 h-2 rounded-full ${isPreviewing ? 'bg-red-500 animate-pulse' : 'bg-sage-600'}`}></span>
                 <p className="text-[10px] text-sage-400 font-bold uppercase tracking-[0.2em]">Live Master Output</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button 
               onClick={() => handleChange('voiceEnhance', !config.voiceEnhance)}
               className={`px-8 py-5 rounded-2xl font-black text-xs uppercase transition-all flex items-center gap-3 border-2 ${config.voiceEnhance ? 'bg-sage-400 border-sage-200 text-sage-950 shadow-lg' : 'bg-transparent border-sage-700 text-sage-500 hover:border-sage-500'}`}
             >
               <Sparkles size={18} /> {config.voiceEnhance ? 'Limpieza ON' : 'Mejorar Ruido'}
               <TooltipHelp text={TOOLTIPS['voiceEnhance']} />
             </button>
             <button 
               onClick={startPreview}
               className={`px-12 py-5 rounded-2xl font-black text-xs uppercase transition-all flex items-center gap-3 border-2 ${isPreviewing ? 'bg-white border-white text-sage-900 shadow-xl' : 'bg-sage-600 border-sage-500 text-white hover:bg-sage-500'}`}
             >
               {isPreviewing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />} {isPreviewing ? 'Detener' : 'Escuchar Mezcla'}
             </button>
          </div>
        </div>

        <div className="relative group">
           <canvas ref={canvasRef} width={800} height={160} className="w-full h-40 bg-black rounded-[2rem] border-2 border-sage-800 shadow-inner" />
           <div className="absolute top-4 right-6 flex items-center gap-4">
              <span className="text-[9px] font-black text-sage-500 uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full border border-sage-800">Analyzer active</span>
           </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* COLUMNA IZQUIERDA: VOLUMENES Y RUIDO */}
        <div className="xl:col-span-4 space-y-8">
           <div className="studio-card p-8 rounded-[3rem] bg-white border-2 border-sage-800 shadow-[4px_4px_0px_#2d3d2d]">
              <div className="flex items-center gap-3 mb-10 border-b-2 border-sand-100 pb-4">
                 <Sliders size={20} className="text-sage-800" />
                 <h3 className="text-xs font-black text-sage-900 uppercase tracking-widest">Niveles de Mezcla</h3>
              </div>
              <div className="space-y-10">
                {[
                  { label: 'Volumen Voz', key: 'voiceVolume', max: 2, icon: Mic },
                  { label: 'Volumen Binaural', key: 'binauralVolume', max: 1, icon: Activity },
                  { label: 'Atenuación (Ducking)', key: 'duckingAmount', max: 0.9, icon: Wind }
                ].map(ctrl => (
                  <div key={ctrl.key} className="space-y-4">
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <ctrl.icon size={14} className="text-sage-500" />
                          <label className="text-[10px] font-black uppercase text-sage-900">{ctrl.label}</label>
                          <TooltipHelp text={TOOLTIPS[ctrl.key]} />
                        </div>
                        <span className="text-xs font-black text-sage-900 bg-sand-100 px-3 py-1 rounded-lg border-2 border-sage-800">
                          {Math.round((config[ctrl.key as keyof ProjectConfig] as number / ctrl.max) * 100)}%
                        </span>
                     </div>
                     <input type="range" min="0" max={ctrl.max} step="0.05" value={config[ctrl.key as keyof ProjectConfig] as number} onChange={(e) => handleChange(ctrl.key as keyof ProjectConfig, parseFloat(e.target.value))} className="w-full h-2 bg-sage-100 rounded-full appearance-none cursor-pointer accent-sage-800 border border-sage-200" />
                  </div>
                ))}
                
                {/* CONTROL DE RUIDO BLANCO / ROSA */}
                <div className="pt-8 border-t-2 border-sand-100 space-y-6">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio size={16} className={config.usePinkNoise ? 'text-sage-800' : 'text-sage-300'} />
                        <label className="text-[10px] font-black uppercase text-sage-900">Ruido Rosa (Atmosférico)</label>
                        <TooltipHelp text={TOOLTIPS['usePinkNoise']} />
                      </div>
                      <button 
                        onClick={() => handleChange('usePinkNoise', !config.usePinkNoise)}
                        className={`w-14 h-8 rounded-full transition-all relative border-2 ${config.usePinkNoise ? 'bg-sage-800 border-sage-900' : 'bg-sand-200 border-sand-300'}`}
                      >
                         <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${config.usePinkNoise ? 'left-8 bg-white' : 'left-1 bg-sage-400'}`}></div>
                      </button>
                   </div>
                   <div className={`space-y-4 transition-opacity ${config.usePinkNoise ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                      <div className="flex justify-between">
                         <span className="text-[9px] font-black text-sage-400 uppercase">Intensidad Ruido</span>
                         <TooltipHelp text={TOOLTIPS['noiseLevel']} />
                         <span className="text-xs font-black text-sage-800">{Math.round(config.noiseLevel * 100)}%</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.05" value={config.noiseLevel} onChange={(e) => handleChange('noiseLevel', parseFloat(e.target.value))} className="w-full appearance-none h-2 bg-sage-100 rounded-full border border-sage-200" />
                   </div>
                </div>
              </div>
           </div>

           <div className="studio-card p-8 rounded-[3rem] bg-white border-2 border-sage-800 shadow-[4px_4px_0px_#2d3d2d]">
              <div className="flex items-center gap-3 mb-8">
                 <Clock size={20} className="text-sage-800" />
                 <h3 className="text-xs font-black text-sage-900 uppercase tracking-widest">Master Timeline</h3>
              </div>
              <div className="grid grid-cols-1 gap-6">
                 <div className="p-6 bg-sand-50 rounded-[2rem] border-2 border-sage-800">
                    <label className="text-[10px] font-black text-sage-500 uppercase block mb-3">Inicio (Pre-roll)</label>
                    <div className="flex items-center gap-4">
                      <input type="number" value={config.preRollDuration} onChange={(e) => handleChange('preRollDuration', parseInt(e.target.value))} className="bg-white border-2 border-sage-800 rounded-xl px-4 py-3 font-black text-2xl text-sage-900 w-full outline-none" />
                      <span className="text-xs font-black text-sage-400 uppercase">Segs</span>
                    </div>
                 </div>
                 <div className="p-6 bg-sand-50 rounded-[2rem] border-2 border-sage-800">
                    <label className="text-[10px] font-black text-sage-500 uppercase block mb-3">Final (Post-roll)</label>
                    <div className="flex items-center gap-4">
                      <input type="number" value={config.postRollDuration} onChange={(e) => handleChange('postRollDuration', parseInt(e.target.value))} className="bg-white border-2 border-sage-800 rounded-xl px-4 py-3 font-black text-2xl text-sage-900 w-full outline-none" />
                      <span className="text-xs font-black text-sage-400 uppercase">Segs</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* COLUMNA DERECHA: BINAURAL MANUAL Y PRESETS */}
        <div className="xl:col-span-8 space-y-8">
           <div className="studio-card p-8 rounded-[3rem] bg-white border-2 border-sage-800 shadow-[4px_4px_0px_#2d3d2d]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 border-b-2 border-sand-100 pb-6">
                 <div className="flex items-center gap-3">
                    <Zap size={20} className="text-sage-800" />
                    <h3 className="text-xs font-black text-sage-900 uppercase tracking-widest">Sintonización de Ondas</h3>
                 </div>
                 <div className="flex items-center gap-2 bg-sage-50 px-4 py-2 rounded-xl border border-sage-200">
                    <Info size={14} className="text-sage-500" />
                    <span className="text-[10px] font-bold text-sage-600 uppercase">Ajusta los hercios manualmente o usa un preset</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-sage-500 uppercase tracking-widest">Frecuencia Portadora (Carrier) <TooltipHelp text={TOOLTIPS['carrierFreq']} /></label>
                    <div className="relative">
                       <input 
                         type="number" min="40" max="1000" 
                         value={config.carrierFreq} onChange={(e) => handleChange('carrierFreq', parseFloat(e.target.value))}
                         className="w-full bg-sand-50 border-4 border-sage-800 rounded-3xl py-8 px-10 text-5xl font-black text-sage-900 outline-none focus:bg-white transition-all shadow-inner"
                       />
                       <span className="absolute right-8 top-1/2 -translate-y-1/2 text-2xl font-black text-sage-300">Hz</span>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-sage-500 uppercase tracking-widest">Frecuencia de Pulso (Beat) <TooltipHelp text={TOOLTIPS['beatFreq']} /></label>
                    <div className="relative">
                       <input 
                         type="number" min="0.5" max="40" step="0.1"
                         value={config.beatFreq} onChange={(e) => handleChange('beatFreq', parseFloat(e.target.value))}
                         className="w-full bg-sand-50 border-4 border-sage-800 rounded-3xl py-8 px-10 text-5xl font-black text-sage-900 outline-none focus:bg-white transition-all shadow-inner"
                       />
                       <span className="absolute right-8 top-1/2 -translate-y-1/2 text-2xl font-black text-sage-300">Hz</span>
                    </div>
                 </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto pr-4 custom-scrollbar bg-sand-50 p-6 rounded-[2.5rem] border-2 border-sand-200 space-y-4">
                 {/* ── PRESETS POR CATEGORÍA DE ONDA CEREBRAL ── */}
                 {BRAINWAVE_CATEGORIES.map(cat => {
                   const CategoryIcon = cat.key === 'delta' ? Moon : cat.key === 'theta' ? Brain : cat.key === 'alpha' ? Eye : Coffee;
                   return (
                     <div key={cat.key} className="mb-4 last:mb-0">
                       <div className="flex items-center gap-2 mb-2 px-1">
                         <CategoryIcon size={14} className={cat.key === 'delta' ? 'text-indigo-500' : cat.key === 'theta' ? 'text-purple-500' : cat.key === 'alpha' ? 'text-teal-500' : 'text-amber-500'} />
                         <span className="text-[11px] font-black uppercase tracking-widest text-sage-900">{cat.label}</span>
                         <span className="text-[9px] font-bold text-sage-400 uppercase">• {cat.sublabel}</span>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                         {cat.presets.map(p => (
                           <button
                             key={p.name}
                             onClick={() => setConfig(prev => ({ ...prev, carrierFreq: p.carrier, beatFreq: p.beat }))}
                             className={`p-5 rounded-[1.5rem] border-2 text-left transition-all group ${
                               config.beatFreq === p.beat
                                 ? 'bg-sage-900 border-sage-900 text-white shadow-xl scale-[1.02]'
                                 : 'bg-white border-sage-200 text-sage-900 hover:border-sage-800 hover:shadow-md'
                             }`}
                           >
                             <div className="flex justify-between items-start mb-2">
                               <span className="font-black text-[9px] uppercase tracking-tighter leading-tight">{p.name}</span>
                               <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                 config.beatFreq === p.beat ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-800'
                               }`}>{p.beat}Hz</span>
                             </div>
                             <p className={`text-[9px] leading-snug font-medium ${
                               config.beatFreq === p.beat ? 'opacity-70' : 'text-sage-400'
                             }`}>{p.description}</p>
                           </button>
                         ))}
                       </div>
                     </div>
                   );
                 })}

                 {/* ── PRESETS TERAPÉUTICOS ORIGINALES ── */}
                 <div className="pt-4 border-t-2 border-sand-200">
                   <div className="flex items-center gap-2 mb-2 px-1">
                     <Sparkles size={14} className="text-sage-600" />
                     <span className="text-[11px] font-black uppercase tracking-widest text-sage-900">Presets Terapéuticos</span>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                     {BINAURAL_PRESETS.map(p => (
                       <button
                         key={p.name}
                         onClick={() => setConfig(prev => ({ ...prev, carrierFreq: p.carrier, beatFreq: p.beat }))}
                         className={`p-5 rounded-[1.5rem] border-2 text-left transition-all group ${
                           config.beatFreq === p.beat
                             ? 'bg-sage-900 border-sage-900 text-white shadow-xl scale-[1.02]'
                             : 'bg-white border-sage-200 text-sage-900 hover:border-sage-800 hover:shadow-md'
                         }`}
                       >
                         <div className="flex justify-between items-start mb-2">
                           <span className="font-black text-[9px] uppercase tracking-tighter leading-tight">{p.name}</span>
                           <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                             config.beatFreq === p.beat ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-800'
                           }`}>{p.beat}Hz</span>
                         </div>
                         <p className={`text-[9px] leading-snug font-medium ${
                           config.beatFreq === p.beat ? 'opacity-70' : 'text-sage-400'
                         }`}>{p.description}</p>
                       </button>
                     ))}
                   </div>
                 </div>
              </div>
           </div>

           <div className="studio-card p-8 rounded-[3rem] bg-white border-2 border-sage-800 shadow-[4px_4px_0px_#2d3d2d]">
              <div className="flex items-center gap-3 mb-10 border-b-2 border-sand-100 pb-4">
                 <Settings2 size={20} className="text-sage-800" />
                 <h3 className="text-xs font-black text-sage-900 uppercase tracking-widest">Ecualización Paramétrica</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                 {[
                   { label: 'Cuerpo (Bass)', key: 'voiceBass', min: -12, max: 18, unit: 'dB' },
                   { label: 'Brillo (Treble)', key: 'voiceTreble', min: -12, max: 18, unit: 'dB' },
                   { label: 'Espacio (Reverb)', key: 'voiceReverb', min: 0, max: 1, step: 0.01, unit: '%' }
                 ].map(ctrl => (
                   <div key={ctrl.key} className="space-y-5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-sage-500 uppercase">{ctrl.label}</label>
                        <TooltipHelp text={TOOLTIPS[ctrl.key]} />
                        <span className="text-xs font-black text-sage-900 bg-sand-100 px-3 py-1 rounded-lg border-2 border-sage-800">
                          {ctrl.unit === '%' ? Math.round(config[ctrl.key as keyof ProjectConfig] as number * 100) : config[ctrl.key as keyof ProjectConfig]}{ctrl.unit}
                        </span>
                      </div>
                      <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step || 1} value={config[ctrl.key as keyof ProjectConfig] as number} onChange={(e) => handleChange(ctrl.key as keyof ProjectConfig, parseFloat(e.target.value))} className="w-full appearance-none h-2 bg-sage-100 rounded-full border border-sage-200" />
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
      
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #abc1aa; border-radius: 10px; border: 2px solid #fff; }`}</style>
    </div>
  );
};

export default memo(Mixer);
