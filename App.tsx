
import React, { useState, useEffect, useRef } from 'react';
import { Download, Play, Pause, Save, Headphones, Layers, FileAudio, CheckCircle2, Loader2, ArrowLeft, Wind, Disc, FileType, Mic, Sparkles, RefreshCcw, Edit3, UploadCloud, ChevronRight, LayoutDashboard } from 'lucide-react';
import { ProjectConfig, SessionData } from './types';
import { DEFAULT_CONFIG } from './constants';
import Recorder from './components/Recorder';
import Mixer from './components/Mixer';
import AIVoiceGenerator from './components/AIVoiceGenerator';
import AudioUpload from './components/AudioUpload';
import { renderFinalMix, audioBufferToWav, audioBufferToMp3 } from './services/audioEngine';

const App: React.FC = () => {
  const [config, setConfig] = useState<ProjectConfig>(DEFAULT_CONFIG);
  const [session, setSession] = useState<SessionData>({ voiceBlob: null, voiceUrl: null, duration: 0 });
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [finalWavUrl, setFinalWavUrl] = useState<string | null>(null);
  const [finalMp3Url, setFinalMp3Url] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [exportFormats, setExportFormats] = useState<{ wav: boolean, mp3: boolean }>({ wav: true, mp3: true });
  const [inputMode, setInputMode] = useState<'record' | 'ai' | 'upload'>('record');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleExport = async () => {
    if (!session.voiceBlob) {
      alert("Primero debes grabar, generar o subir tu voz.");
      return;
    }

    setIsRendering(true);
    setRenderProgress(10);
    setFinalWavUrl(null);
    setFinalMp3Url(null);

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await session.voiceBlob.arrayBuffer();
      const voiceBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setRenderProgress(30);

      const mixedBuffer = await renderFinalMix(config, voiceBuffer);
      setRenderProgress(60);

      if (exportFormats.wav) {
        const wavBlob = audioBufferToWav(mixedBuffer);
        setFinalWavUrl(URL.createObjectURL(wavBlob));
      }
      setRenderProgress(80);

      if (exportFormats.mp3) {
        const mp3Blob = await audioBufferToMp3(mixedBuffer);
        setFinalMp3Url(URL.createObjectURL(mp3Blob));
      }
      
      setRenderProgress(100);
      setActiveStep(4);
    } catch (err) {
      console.error("Export error:", err);
      alert("Error en el renderizado final. Intenta reducir la duración o refrescar.");
    } finally {
      setIsRendering(false);
    }
  };

  const formatTotalTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [finalWavUrl, activeStep]);

  const onVoiceReady = (data: SessionData) => {
    setSession(data);
    if (activeStep === 1) setActiveStep(2);
  };

  const resetSession = () => {
    if (confirm("¿Reiniciar todo? Se perderán los archivos no guardados.")) {
        window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 pb-20 selection:bg-sage-200">
      <header className="sticky top-0 z-50 bg-sage-900 border-b border-sage-800 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveStep(1)}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-sage-900 font-bold shadow-lg">
              <Wind size={20} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-extrabold text-white tracking-tight">ZenMix <span className="text-sage-400">STUDIO</span></h1>
            </div>
          </div>
          
          <nav className="flex items-center gap-1 sm:gap-4">
             {[
               {id: 1, label: 'Captura', icon: Mic},
               {id: 2, label: 'Mezcla', icon: LayoutDashboard},
               {id: 3, label: 'Exportar', icon: Save},
               {id: 4, label: 'Final', icon: CheckCircle2}
             ].map(s => (
               <button 
                 key={s.id}
                 disabled={s.id > 2 && !session.voiceBlob}
                 onClick={() => setActiveStep(s.id)}
                 className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border-2 ${activeStep === s.id ? 'bg-white border-white text-sage-900 shadow-xl scale-105 font-bold' : 'bg-transparent border-sage-700 text-sage-400 hover:border-sage-500 disabled:opacity-20'}`}
               >
                 <s.icon size={16} className={activeStep === s.id ? 'text-sage-800' : ''} />
                 <span className="hidden md:block text-[11px] uppercase tracking-widest font-bold">
                    {s.label}
                 </span>
               </button>
             ))}
          </nav>

          {/* Changed RefreshCw to RefreshCcw to fix compilation error */}
          <button onClick={resetSession} className="p-2 text-sage-400 hover:text-white hover:bg-sage-800 rounded-lg transition-all border border-sage-800">
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10">
        {activeStep === 1 && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="bg-sage-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border border-sage-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-sage-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <h2 className="text-4xl font-extrabold mb-8 text-center sm:text-left">Fuente de <span className="text-sage-400">Narración</span></h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {[
                  { id: 'record', icon: Mic, label: 'Grabar ahora', desc: 'Usa tu micrófono local' },
                  { id: 'ai', icon: Sparkles, label: 'Voz IA', desc: 'Genera con Gemini TTS' },
                  { id: 'upload', icon: UploadCloud, label: 'Subir Archivo', desc: 'WAV, MP3, AAC' }
                ].map(mode => (
                  <button 
                    key={mode.id}
                    onClick={() => setInputMode(mode.id as any)} 
                    className={`flex flex-col items-center text-center gap-4 p-8 rounded-[2rem] transition-all border-2 ${inputMode === mode.id ? 'bg-white text-sage-900 border-white shadow-2xl scale-105' : 'bg-sage-800/50 border-sage-700 hover:bg-sage-800'}`}
                  >
                    <mode.icon size={40} className={inputMode === mode.id ? 'text-sage-700' : 'text-sage-400'} /> 
                    <div>
                      <span className="block font-black text-xs uppercase tracking-[0.2em]">{mode.label}</span>
                      <span className="text-[10px] opacity-60 font-medium">{mode.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="animate-in slide-in-from-bottom-10">
              {inputMode === 'record' && <Recorder onRecordingComplete={onVoiceReady} />}
              {inputMode === 'ai' && <AIVoiceGenerator onGenerationComplete={onVoiceReady} />}
              {inputMode === 'upload' && <AudioUpload onUpload={onVoiceReady} />}
            </div>

            {session.voiceBlob && (
              <div className="flex justify-center pt-8">
                <button onClick={() => setActiveStep(2)} className="flex items-center gap-4 px-12 py-6 bg-sage-900 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:bg-black hover:scale-105 transition-all border-2 border-sage-700">
                  IR AL MEZCLADOR <ChevronRight size={24} />
                </button>
              </div>
            )}
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right-10">
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-8 py-6 rounded-3xl border-2 border-sage-200 shadow-md">
               <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                 <h2 className="text-xl font-black text-sage-900 uppercase tracking-tighter">Control de Masterización</h2>
               </div>
               <div className="flex items-center gap-4 mt-4 sm:mt-0">
                 <button onClick={() => setActiveStep(1)} className="px-4 py-2 bg-sand-100 border-2 border-sand-300 text-[10px] font-black text-sage-700 rounded-xl uppercase hover:bg-white flex items-center gap-2">
                    <Edit3 size={14} /> Re-grabar
                 </button>
                 <div className="h-6 w-px bg-sage-200" />
                 <span className="text-[11px] font-black text-sage-900 uppercase bg-sage-100 px-4 py-2 rounded-xl border border-sage-200">
                    Duración: {formatTotalTime(config.preRollDuration + session.duration + config.postRollDuration)}
                 </span>
               </div>
            </div>
            
            <Mixer config={config} setConfig={setConfig} session={session} />
            
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-6">
               <button onClick={() => setActiveStep(3)} className="w-full py-6 bg-sage-900 text-white rounded-[2rem] font-black text-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:bg-black hover:-translate-y-1 transition-all border-2 border-sage-600">
                  FINALIZAR Y EXPORTAR
               </button>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="bg-white p-12 md:p-20 rounded-[4rem] shadow-xl border-2 border-sage-200 flex flex-col items-center gap-10 animate-in zoom-in">
             {!isRendering ? (
               <div className="space-y-12 w-full max-w-2xl text-center">
                 <h2 className="text-5xl font-black text-sage-900 tracking-tighter uppercase">Configurar Master</h2>
                 <p className="text-sage-500 font-bold uppercase text-xs tracking-widest -mt-8">Selecciona los formatos de salida para tu meditación</p>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <button onClick={() => setExportFormats(prev => ({...prev, wav: !prev.wav}))} className={`p-10 rounded-[2.5rem] border-4 transition-all flex flex-col items-center gap-4 ${exportFormats.wav ? 'border-sage-700 bg-sage-900 text-white shadow-2xl scale-105' : 'border-sage-100 bg-sand-50 text-sage-300'}`}>
                      <FileAudio size={48} /> 
                      <div className="font-black text-xl uppercase italic">WAV Master</div>
                      <span className="text-[10px] font-bold opacity-60">Calidad de Estudio (Lossless)</span>
                    </button>
                    <button onClick={() => setExportFormats(prev => ({...prev, mp3: !prev.mp3}))} className={`p-10 rounded-[2.5rem] border-4 transition-all flex flex-col items-center gap-4 ${exportFormats.mp3 ? 'border-sage-700 bg-sage-900 text-white shadow-2xl scale-105' : 'border-sage-100 bg-sand-50 text-sage-300'}`}>
                      <FileType size={48} /> 
                      <div className="font-black text-xl uppercase italic">MP3 Pro</div>
                      <span className="text-[10px] font-bold opacity-60">Optimizado (192kbps)</span>
                    </button>
                 </div>
                 
                 <div className="flex flex-col gap-4 pt-10">
                    <button onClick={handleExport} className="w-full py-8 bg-sage-900 text-white rounded-[2.5rem] font-black text-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] hover:bg-black transition-all border-4 border-sage-700 active:scale-95">
                      GENERAR ARCHIVOS FINALES
                    </button>
                    <button onClick={() => setActiveStep(2)} className="text-[11px] font-black text-sage-400 hover:text-sage-900 uppercase tracking-[0.3em] transition-all">
                      Volver al Laboratorio
                    </button>
                 </div>
               </div>
             ) : (
               <div className="w-full max-w-lg space-y-12 py-10 text-center">
                 <div className="relative inline-block">
                    <Loader2 size={80} className="text-sage-900 animate-spin mx-auto" />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-sage-900">
                      {renderProgress}%
                    </div>
                 </div>
                 <div className="space-y-4">
                    <h3 className="text-2xl font-black text-sage-900 uppercase">Masterizando...</h3>
                    <div className="w-full h-6 bg-sand-200 rounded-full overflow-hidden p-1 border-2 border-sand-300 shadow-inner">
                      <div className="h-full bg-sage-700 rounded-full transition-all duration-500 shadow-lg" style={{ width: `${renderProgress}%` }} />
                    </div>
                    <p className="text-[10px] font-black text-sage-500 uppercase tracking-widest animate-pulse">Combinando capas y aplicando filtros espaciales</p>
                 </div>
               </div>
             )}
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-10 animate-in fade-in">
             <div className="bg-white p-12 md:p-20 rounded-[5rem] shadow-2xl border-4 border-sage-900 flex flex-col items-center gap-12 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-sage-900"></div>
                
                <div className="w-24 h-24 bg-sage-100 text-sage-900 rounded-[2.5rem] flex items-center justify-center shadow-inner border-2 border-sage-200">
                   <CheckCircle2 size={56} strokeWidth={3} />
                </div>
                
                <div className="space-y-4">
                   <h2 className="text-5xl font-black text-sage-900 tracking-tighter uppercase">Obra Finalizada</h2>
                   <p className="text-sage-400 text-lg font-bold uppercase tracking-widest">Master Studio: {config.name}</p>
                </div>
                
                <div className="w-full max-w-xl bg-sage-900 p-10 rounded-[3rem] shadow-2xl text-white space-y-8 border-4 border-sage-700">
                   <div className="flex justify-between text-[10px] font-black text-sage-400 uppercase tracking-[0.3em]">
                      <span>Monitor de Salida</span> <span>Reference: 0dB</span>
                   </div>
                   
                   <div className="flex items-center gap-8">
                      <button onClick={() => {
                        if (!audioRef.current) return;
                        if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
                        setIsPlaying(!isPlaying);
                      }} className="w-24 h-24 bg-white text-sage-900 rounded-[2rem] flex items-center justify-center hover:scale-110 transition-all active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.3)]">
                        {isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
                      </button>
                      
                      <div className="flex-1 space-y-4">
                         <div className="h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
                           <div className="h-full bg-sage-400 shadow-[0_0_15px_rgba(132,161,131,0.8)]" style={{ width: `${(currentTime/duration)*100}%` }} />
                         </div>
                         <div className="flex justify-between font-mono text-xs font-black text-sage-300">
                           <span>{formatTotalTime(currentTime)}</span> <span>{formatTotalTime(duration)}</span>
                         </div>
                      </div>
                   </div>
                   <audio ref={audioRef} src={finalWavUrl || finalMp3Url || ''} hidden />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl">
                   {finalWavUrl && (
                     <a href={finalWavUrl} download={`${config.name}.wav`} className="py-8 bg-sage-800 text-white rounded-[2rem] font-black text-xl hover:bg-sage-900 shadow-2xl flex items-center justify-center gap-4 transition-all border-2 border-sage-600">
                        <Download size={24} /> WAV MASTER
                     </a>
                   )}
                   {finalMp3Url && (
                     <a href={finalMp3Url} download={`${config.name}.mp3`} className="py-8 bg-white border-4 border-sage-900 text-sage-900 rounded-[2rem] font-black text-xl hover:bg-sand-50 shadow-2xl flex items-center justify-center gap-4 transition-all">
                        <Download size={24} /> MP3 PRO
                     </a>
                   )}
                </div>

                <div className="flex flex-col gap-6 items-center pt-10">
                  <button onClick={() => setActiveStep(2)} className="text-xs font-black text-sage-400 hover:text-sage-900 uppercase tracking-[0.3em] flex items-center gap-3 transition-all">
                    <Edit3 size={18} /> Reajustar Parámetros de Mezcla
                  </button>
                  <button onClick={resetSession} className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-[0.4em] transition-all bg-red-50 px-6 py-2 rounded-full border border-red-100">
                    NUEVA SESIÓN
                  </button>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
