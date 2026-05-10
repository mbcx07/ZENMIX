
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RotateCcw, Save, Trash2 } from 'lucide-react';
import { SessionData } from '../types';
import { createAudioContext, formatAudioError } from '../services/audioUtils';

interface RecorderProps {
  onRecordingComplete: (data: SessionData) => void;
}

const Recorder: React.FC<RecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [vuLevel, setVuLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const audioUrlRef = useRef<string | null>(null);

  // Sync the ref so cleanup always has the latest URL
  useEffect(() => { audioUrlRef.current = audioUrl; }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      // 🔥 Revoke blob URL on unmount (use ref for latest value)
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      const audioCtx = createAudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVU = () => {
        if (!isRecording && !mediaRecorderRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        setVuLevel(average / 128); 
        if (mediaRecorderRef.current?.state === 'recording') {
          requestAnimationFrame(updateVU);
        }
      };

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        onRecordingComplete({
          voiceBlob: blob,
          voiceUrl: url,
          duration: recordingTime
        });
      };

      recorder.start();
      setIsRecording(true);
      updateVU();

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert(formatAudioError(err));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const resetRecording = () => {
    if(confirm("¿Seguro que quieres borrar la toma actual?")) {
      // 🔥 Revoke old blob URL before clearing
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioBlob(null);
      setRecordingTime(0);
      setVuLevel(0);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="studio-card p-10 bg-white rounded-[3rem] border-4 border-sage-700 flex flex-col items-center gap-10 shadow-2xl">
      <div className="text-center space-y-2">
        <h3 className="text-3xl font-black text-sage-900 uppercase tracking-tighter italic">Voice Capture Engine</h3>
        <p className="text-[10px] text-sage-400 font-bold uppercase tracking-[0.3em]">Recording at 48kHz / Linear PCM</p>
      </div>
      
      <div className="relative w-full h-40 bg-sage-900 rounded-[2.5rem] overflow-hidden flex flex-col items-center justify-center p-8 border-4 border-sage-800 shadow-inner">
        {isRecording ? (
          <div className="w-full space-y-6">
             <div className="flex justify-between items-center px-4">
                <span className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2 animate-pulse"><div className="w-2 h-2 rounded-full bg-red-500"></div> Recording...</span>
                <span className="font-mono text-3xl font-black text-white">{formatTime(recordingTime)}</span>
             </div>
             <div className="w-full h-8 bg-white/5 rounded-full overflow-hidden p-1 border border-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-sage-500 via-sage-300 to-white transition-all duration-75 shadow-[0_0_20px_rgba(255,255,255,0.4)]" 
                  style={{ width: `${Math.min(vuLevel * 100, 100)}%` }}
                />
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="font-black text-2xl text-sage-400 uppercase tracking-tighter">
              {audioUrl ? 'Toma Finalizada' : 'Sistema en Espera'}
            </div>
            {audioUrl && <span className="text-xs font-bold text-sage-600 uppercase italic">Duración: {formatTime(recordingTime)}</span>}
          </div>
        )}
      </div>

      <div className="flex gap-6 items-center">
        {!audioUrl ? (
          !isRecording ? (
            <button 
              onClick={startRecording}
              className="flex items-center gap-4 px-12 py-6 bg-red-600 text-white rounded-[2rem] font-black text-xl hover:bg-red-700 transition-all shadow-2xl hover:scale-105 active:scale-95 border-b-8 border-red-800"
            >
              <Mic size={24} fill="currentColor" /> INICIAR CAPTURA
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="flex items-center gap-4 px-12 py-6 bg-sage-900 text-white rounded-[2rem] font-black text-xl hover:bg-black transition-all shadow-2xl border-b-8 border-sage-700"
            >
              <Square size={24} fill="currentColor" /> FINALIZAR
            </button>
          )
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 items-center">
             <div className="bg-sand-100 px-6 py-4 rounded-[1.8rem] border-2 border-sand-200">
               <audio src={audioUrl} controls className="h-10 opacity-80" />
             </div>
             <button 
                onClick={resetRecording}
                className="p-5 bg-white border-4 border-red-600 text-red-600 rounded-[1.5rem] hover:bg-red-50 transition-all shadow-xl group"
                title="Regrabar"
             >
               <RotateCcw size={28} className="group-hover:rotate-[-90deg] transition-transform duration-500" />
             </button>
          </div>
        )}
      </div>

      <div className="bg-sage-50 p-6 rounded-[2rem] border-2 border-sage-100 max-w-lg">
        <p className="text-[10px] text-sage-500 leading-relaxed font-bold uppercase italic text-center tracking-widest">
          Tip: Usa audífonos para evitar el feedback y asegurar una toma limpia de voz.
        </p>
      </div>
    </div>
  );
};

export default Recorder;
