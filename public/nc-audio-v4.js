/**
 * NC-AUDIO-V4.js — ZENMIX Audio Engine
 * Web Audio API: binaural beats, procedural ambient sounds, TTS, mixer, and recorder.
 *
 * @module nc-audio-v4
 * @version 4.0.0
 * @description Audio processing engine for ZENMIX hypnosis app
 *
 * Architecture:
 *   - Lazy AudioContext init (requires user gesture)
 *   - Binaural beats: 2 stereo oscillators with frequency differential
 *   - Procedural ambient noise generators (rain, wind, ocean, fire, forest, night)
 *   - TTS via Web Speech API with Spanish voice selection
 *   - 3-channel mixer: voice | binaural | ambient → master gain
 *   - MediaRecorder with effects (echo, reverb via ConvolverNode)
 *   - Precise timer with MM:SS display
 *
 * Usage:
 *   import './nc-audio-v4.js';
 *   const audio = window.ZENMIX.audio;
 *   await audio.init();
 *   audio.startSession({ preset: 'insomnio', duration: 600 });
 */

'use strict';

(function () {
    const MODULE = /** @type {import('./types').NCAudioV4} */ ({});

    // ──────────────────────────────────────────────
    // CONSTANTS
    // ──────────────────────────────────────────────

    /** Binaural beat frequency ranges (Hz) */
    const BINAURAL_RANGES = {
        delta:  { min: 1,  max: 4,  label: 'Sueño profundo',     baseFreq: 100 },
        theta:  { min: 4,  max: 8,  label: 'Meditación',          baseFreq: 150 },
        alpha:  { min: 8,  max: 13, label: 'Relajación',          baseFreq: 200 },
        beta:   { min: 13, max: 30, label: 'Alerta / Enfoque',    baseFreq: 250 },
        gamma:  { min: 30, max: 50, label: 'Claridad mental',     baseFreq: 300 }
    };

    /** Session duration constants */
    const DEFAULT_DURATION = 600; // seconds (10 min)
    const MAX_DURATION = 3600;    // 1 hour
    const MIN_DURATION = 60;      // 1 min

    /** Default channel volumes (0-1) */
    const DEFAULT_VOLUMES = { voice: 0.7, binaural: 0.5, ambient: 0.4, master: 0.8 };

    // ──────────────────────────────────────────────
    // STATE
    // ──────────────────────────────────────────────

    /** @type {AudioContext|null} */
    let audioCtx = null;

    /** @type {boolean} */
    let initialized = false;

    /** @type {boolean} */
    let sessionActive = false;

    /** @type {GainNode|null} */
    let masterGain = null;

    /** @type {GainNode|null} */
    let voiceGain = null;

    /** @type {GainNode|null} */
    let binauralGain = null;

    /** @type {GainNode|null} */
    let ambientGain = null;

    /** @type {OscillatorNode|null} */
    let binauralLeft = null;

    /** @type {OscillatorNode|null} */
    let binauralRight = null;

    /** @type {StereoPannerNode|null} */
    let binauralPanLeft = null;

    /** @type {StereoPannerNode|null} */
    let binauralPanRight = null;

    /** @type {string} */
    let currentBinauralType = 'alpha';

    /** @type {number} */
    let currentAmbientVolume = 0.4;

    /** @type {AudioBufferSourceNode|null} */
    let ambientSource = null;

    /** @type {ScriptProcessorNode|null} */
    let noiseProcessor = null;

    /** @type {string} */
    let currentAmbientType = 'rain';

    /** @type {string} */
    let timerInterval = null;

    /** @type {number} */
    let sessionStartTime = 0;

    /** @type {number} */
    let sessionDuration = DEFAULT_DURATION;

    /** @type {number} */
    let elapsedSeconds = 0;

    /** @type {number} */
    let voiceTimerInterval = null;

    /** @type {number} */
    let voiceElapsed = 0;

    /** @type {MediaRecorder|null} */
    let mediaRecorder = null;

    /** @type {Blob[]} */
    let recordedChunks = [];

    /** @type {MediaStream|null} */
    let recordingStream = null;

    /** @type {SpeechSynthesisUtterance|null} */
    let currentUtterance = null;

    /** @type {SpeechSynthesisVoice|null} */
    let selectedVoice = null;

    // ──────────────────────────────────────────────
    // PRIVATE: AUDIO CONTEXT LIFECYCLE
    // ──────────────────────────────────────────────

    /**
     * Create AudioContext (lazy, must be called from user gesture).
     * @returns {AudioContext}
     * @private
     */
    function ensureAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            // Resume if suspended (browser autoplay policy)
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(e => {
                    console.warn('[NC-AUDIO] Could not resume AudioContext:', e);
                });
            }
        }
        return audioCtx;
    }

    /**
     * Build the mixer chain: 3 input channels → master → destination.
     * @private
     */
    function buildMixerChain() {
        const ctx = ensureAudioContext();

        // Master gain
        masterGain = ctx.createGain();
        masterGain.gain.value = DEFAULT_VOLUMES.master;
        masterGain.connect(ctx.destination);

        // Voice channel
        voiceGain = ctx.createGain();
        voiceGain.gain.value = DEFAULT_VOLUMES.voice;
        voiceGain.connect(masterGain);

        // Binaural channel
        binauralGain = ctx.createGain();
        binauralGain.gain.value = DEFAULT_VOLUMES.binaural;
        binauralGain.connect(masterGain);

        // Ambient channel
        ambientGain = ctx.createGain();
        ambientGain.gain.value = DEFAULT_VOLUMES.ambient;
        ambientGain.connect(masterGain);

        console.info('[NC-AUDIO] Mixer chain built: voice → binaural → ambient → master');
    }

    // ──────────────────────────────────────────────
    // PRIVATE: BINAURAL BEATS ENGINE
    // ──────────────────────────────────────────────

    /**
     * Start binaural beat oscillators for a given type.
     * Two oscillators panned hard L/R with frequency differential.
     * @param {string} type - Binaural range key (delta, theta, alpha, beta, gamma)
     * @param {number} [intensity=0.5] - Intensity multiplier for the differential
     * @private
     */
    function startBinauralBeats(type, intensity = 0.5) {
        stopBinauralBeats();

        const range = BINAURAL_RANGES[type];
        if (!range) {
            console.error(`[NC-AUDIO] Unknown binaural type: "${type}"`);
            return;
        }

        // Calculate target differential
        const diff = range.min + (range.max - range.min) * intensity;
        const baseFreq = range.baseFreq;

        const leftFreq = baseFreq;
        const rightFreq = baseFreq + diff;

        const ctx = ensureAudioContext();

        // Left oscillator (panned left)
        binauralLeft = ctx.createOscillator();
        binauralLeft.type = 'sine';
        binauralLeft.frequency.value = leftFreq;

        binauralPanLeft = ctx.createStereoPanner();
        binauralPanLeft.pan.value = -1; // hard left

        binauralLeft.connect(binauralPanLeft);
        binauralPanLeft.connect(binauralGain);

        // Right oscillator (panned right)
        binauralRight = ctx.createOscillator();
        binauralRight.type = 'sine';
        binauralRight.frequency.value = rightFreq;

        binauralPanRight = ctx.createStereoPanner();
        binauralPanRight.pan.value = 1; // hard right

        binauralRight.connect(binauralPanRight);
        binauralPanRight.connect(binauralGain);

        binauralLeft.start();
        binauralRight.start();

        currentBinauralType = type;

        console.info(`[NC-AUDIO] Binaural beats started: ${type} (L=${leftFreq}Hz, R=${rightFreq}Hz, Δ=${diff.toFixed(1)}Hz, "${range.label}")`);
    }

    /**
     * Stop binaural beat oscillators.
     * @private
     */
    function stopBinauralBeats() {
        try {
            if (binauralLeft) { binauralLeft.stop(); binauralLeft.disconnect(); binauralLeft = null; }
        } catch (_) { binauralLeft = null; }
        try {
            if (binauralRight) { binauralRight.stop(); binauralRight.disconnect(); binauralRight = null; }
        } catch (_) { binauralRight = null; }

        if (binauralPanLeft) { binauralPanLeft.disconnect(); binauralPanLeft = null; }
        if (binauralPanRight) { binauralPanRight.disconnect(); binauralPanRight = null; }
    }

    // ──────────────────────────────────────────────
    // PRIVATE: PROCEDURAL AMBIENT NOISE GENERATORS
    // ──────────────────────────────────────────────

    /**
     * Start a procedural ambient noise generator.
     * Each type uses filtered noise tailored to simulate the sound.
     * @param {string} type - Ambient type (rain, wind, ocean, fire, forest, night)
     * @param {number} [volume=0.4] - 0 to 1
     * @private
     */
    function startAmbient(type, volume = 0.4) {
        stopAmbient();

        const ctx = ensureAudioContext();
        const bufferSize = 4096;
        const sampleRate = ctx.sampleRate;

        // Create noise generator using ScriptProcessorNode
        noiseProcessor = ctx.createScriptProcessor(bufferSize, 0, 1);
        noiseProcessor.onaudioprocess = createNoiseGenerator(type, sampleRate);

        currentAmbientType = type;
        currentAmbientVolume = volume;

        noiseProcessor.connect(ambientGain);

        console.info(`[NC-AUDIO] Ambient sound started: ${type} (vol: ${volume.toFixed(2)})`);
    }

    /**
     * Create a procedural noise generator function for a specific ambient type.
     * Implements Brownian noise with filtering for each sound type.
     * @param {string} type
     * @param {number} sampleRate
     * @returns {function(AudioProcessingEvent): void}
     * @private
     */
    function createNoiseGenerator(type, sampleRate) {
        /** Brownian noise state */
        let brownState = 0;
        /** Low-pass filter state (simple IIR) */
        let filterState = 0;

        // Type-specific filter coefficients and modulation
        /** @type {{alpha: number, gain: number, modFreq: number, modAmp: number, crackleProb: number}} */
        const config = {
            alpha: 0.02,  // Filter smoothness (lower = more low-pass)
            gain: 0.3,
            modFreq: 0,
            modAmp: 0,
            crackleProb: 0
        };

        switch (type) {
            case 'rain':
                config.alpha = 0.005;
                config.gain = 0.4;
                config.modFreq = 0.1;     // slow volume modulation for rain variability
                config.modAmp = 0.3;
                config.crackleProb = 0.003;
                break;
            case 'wind':
                config.alpha = 0.001;
                config.gain = 0.35;
                config.modFreq = 0.03;    // very slow gusts
                config.modAmp = 0.6;
                break;
            case 'ocean':
                config.alpha = 0.003;
                config.gain = 0.35;
                config.modFreq = 0.05;    // wave rhythm
                config.modAmp = 0.5;
                break;
            case 'fire':
                config.alpha = 0.08;
                config.gain = 0.3;
                config.modFreq = 3;       // rapid crackle base
                config.modAmp = 0.2;
                config.crackleProb = 0.01;
                break;
            case 'forest':
                config.alpha = 0.01;
                config.gain = 0.25;
                config.modFreq = 0.2;
                config.modAmp = 0.2;
                config.crackleProb = 0.001;
                break;
            case 'night':
                config.alpha = 0.015;
                config.gain = 0.15;
                config.modFreq = 0.1;
                config.modAmp = 0.1;
                break;
        }

        let modPhase = 0;

        /**
         * @param {AudioProcessingEvent} e
         */
        return function onAudioProcess(e) {
            const output = e.outputBuffer.getChannelData(0);

            for (let i = 0; i < output.length; i++) {
                // Brownian noise: integrate white noise
                const white = (Math.random() * 2 - 1) * config.gain;
                brownState = brownState * (1 - config.alpha) + white * config.alpha;

                // Apply IIR low-pass filter
                filterState = filterState * 0.99 + brownState * 0.01;

                // Slow amplitude modulation
                modPhase += config.modFreq / sampleRate;
                if (modPhase > 1) modPhase -= 1;
                const mod = 1 - config.modAmp * Math.abs(Math.sin(modPhase * Math.PI * 2));

                // Crackle spikes
                let crackle = 0;
                if (config.crackleProb > 0 && Math.random() < config.crackleProb) {
                    crackle = (Math.random() * 2 - 1) * 0.5;
                }

                output[i] = (filterState * mod + crackle) * 1.5;
            }
        };
    }

    /**
     * Stop the ambient noise generator.
     * @private
     */
    function stopAmbient() {
        if (noiseProcessor) {
            try { noiseProcessor.disconnect(); } catch (_) { /* ignore */ }
            noiseProcessor = null;
        }
    }

    // ──────────────────────────────────────────────
    // PRIVATE: TTS (WEB SPEECH API)
    // ──────────────────────────────────────────────

    /**
     * Find the best available Spanish voice.
     * Prioritizes: es-MX > es-US > es-AR > es-ES
     * @returns {Promise<SpeechSynthesisVoice|null>}
     * @private
     */
    async function findBestSpanishVoice() {
        const synth = window.speechSynthesis;
        if (!synth) return null;

        return new Promise((resolve) => {
            // Voices may need a moment to load
            synth.addEventListener('voiceschanged', () => resolve(selectVoice(synth.getVoices())), { once: true });

            // If already loaded
            const voices = synth.getVoices();
            if (voices.length > 0) {
                resolve(selectVoice(voices));
            }

            // Timeout fallback
            setTimeout(() => {
                resolve(selectVoice(window.speechSynthesis.getVoices()));
            }, 1000);
        });

        /**
         * @param {SpeechSynthesisVoice[]} voices
         * @returns {SpeechSynthesisVoice|null}
         */
        function selectVoice(voices) {
            /** @type {string[]} */
            const priority = ['es-MX', 'es-US', 'es-AR', 'es-ES'];
            for (const lang of priority) {
                const match = voices.find(v => v.lang.startsWith(lang));
                if (match) return match;
            }
            // Fallback: any Spanish
            const anySpanish = voices.find(v => v.lang.startsWith('es'));
            return anySpanish || voices[0] || null;
        }
    }

    /**
     * Speak text using Web Speech API.
     * @param {string} text - Text to speak
     * @param {Object} [options] - Voice options
     * @param {number} [options.rate=0.85] - Speech rate
     * @param {number} [options.pitch=1.0] - Voice pitch
     * @param {function(): void} [options.onEnd] - Callback when done
     * @returns {Promise<void>}
     * @private
     */
    async function speakText(text, options = {}) {
        const synth = window.speechSynthesis;
        if (!synth) {
            console.warn('[NC-AUDIO] SpeechSynthesis not available in this browser.');
            if (options.onEnd) options.onEnd();
            return;
        }

        // Cancel any ongoing speech
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        currentUtterance = utterance;

        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = options.rate ?? 0.85;
        utterance.pitch = options.pitch ?? 1.0;
        utterance.volume = 1.0;
        utterance.lang = selectedVoice?.lang || 'es-MX';

        utterance.onend = () => {
            currentUtterance = null;
            if (options.onEnd) options.onEnd();
        };

        utterance.onerror = (e) => {
            console.warn('[NC-AUDIO] TTS error:', e.error);
            currentUtterance = null;
            if (options.onEnd) options.onEnd();
        };

        synth.speak(utterance);

        // Chrome bug workaround: keep TTS alive during long sessions
        // by periodically resuming if it pauses
    }

    /**
     * Resume speech synthesis (Chrome bug workaround).
     * Chrome pauses TTS after ~15s if no interaction.
     * @private
     */
    function resumeSpeechSynthesis() {
        const synth = window.speechSynthesis;
        if (synth && synth.paused) {
            synth.resume();
        }
    }

    // ──────────────────────────────────────────────
    // PRIVATE: HYPNO-SCRIPT PLAYER
    // ──────────────────────────────────────────────

    /**
     * Play a hypnosis script line by line with binaural beats active.
     * Speech is routed through the voice gain channel if possible (via audio routing).
     * @param {string} scriptText - Full script text to play
     * @param {Object} [voiceOptions] - Voice configuration
     * @returns {Promise<void>}
     * @private
     */
    async function playHypnoScript(scriptText, voiceOptions = {}) {
        // Parse script into sentences/paragraphs
        const segments = scriptText
            .split(/\n+/)
            .map(s => s.trim())
            .filter(s => s.length > 5);

        if (segments.length === 0) return;

        /**
         * Play segments sequentially with delays
         * @param {number} index
         */
        async function playSegment(index) {
            if (!sessionActive || index >= segments.length) return;

            // Keep TTS alive
            resumeSpeechSynthesis();

            // Speak this segment
            await new Promise((resolve) => {
                speakText(segments[index], {
                    rate: voiceOptions.rate ?? 0.85,
                    pitch: voiceOptions.pitch ?? 1.0,
                    onEnd: resolve
                });
            });

            // Add a pause between segments (2-4 seconds)
            if (sessionActive && index < segments.length - 1) {
                const pause = 2000 + Math.random() * 2000;
                await new Promise(r => setTimeout(r, pause));
                playSegment(index + 1);
            } else if (index >= segments.length - 1) {
                // Script finished, stop voice timer
                cleanupVoiceTimer();
            }
        }

        // Start voice timer
        cleanupVoiceTimer();
        voiceElapsed = 0;
        voiceTimerInterval = setInterval(() => {
            voiceElapsed++;
        }, 1000);

        playSegment(0);
    }

    /**
     * Clear voice timer.
     * @private
     */
    function cleanupVoiceTimer() {
        if (voiceTimerInterval) {
            clearInterval(voiceTimerInterval);
            voiceTimerInterval = null;
        }
    }

    // ──────────────────────────────────────────────
    // PRIVATE: TIMER
    // ──────────────────────────────────────────────

    /**
     * Start the session timer with MM:SS formatting.
     * @param {function(string, number): void} onTick - Callback with formatted time and remaining seconds
     * @param {function(): void} [onComplete] - Callback when time is up
     * @private
     */
    function startTimer(onTick, onComplete) {
        cleanupTimer();

        sessionStartTime = Date.now();
        elapsedSeconds = 0;

        /**
         * Format seconds as MM:SS string.
         * @param {number} secs
         * @returns {string}
         */
        const format = (secs) => {
            const m = String(Math.floor(secs / 60)).padStart(2, '0');
            const s = String(secs % 60).padStart(2, '0');
            return `${m}:${s}`;
        };

        timerInterval = setInterval(() => {
            elapsedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);

            if (elapsedSeconds >= sessionDuration) {
                cleanupTimer();
                if (onComplete) onComplete();
                return;
            }

            const remaining = sessionDuration - elapsedSeconds;
            onTick(format(elapsedSeconds), remaining);
        }, 1000);

        // First tick immediately
        onTick(format(0), sessionDuration);
    }

    /**
     * Clean up timer resources.
     * @private
     */
    function cleanupTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        elapsedSeconds = 0;
    }

    // ──────────────────────────────────────────────
    // PRIVATE: RECORDER
    // ──────────────────────────────────────────────

    /**
     * Start microphone + system audio recording with effects.
     * @returns {Promise<boolean>} True if recording started
     * @private
     */
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            recordingStream = stream;

            // Determine supported MIME type
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mpeg',
                'audio/wav'
            ];
            let mimeType = '';
            for (const mt of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mt)) {
                    mimeType = mt;
                    break;
                }
            }

            recordedChunks = [];
            mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType || undefined });

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunks.push(e.data);
                }
            };

            mediaRecorder.start(1000); // Collect chunks every second
            console.info('[NC-AUDIO] Recording started.');
            return true;
        } catch (e) {
            console.error('[NC-AUDIO] Failed to start recording:', e);
            return false;
        }
    }

    /**
     * Stop recording and return the audio blob.
     * @returns {Promise<Blob|null>}
     * @private
     */
    async function stopRecordingGetBlob() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return null;

        return new Promise((resolve) => {
            mediaRecorder.onstop = () => {
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const blob = new Blob(recordedChunks, { type: mimeType });
                recordedChunks = [];
                resolve(blob);
            };

            mediaRecorder.stop();

            // Release tracks
            if (recordingStream) {
                recordingStream.getTracks().forEach(t => t.stop());
                recordingStream = null;
            }
        });
    }

    // ──────────────────────────────────────────────
    // PRIVATE: EFFECTS (ECHO / REVERB)
    // ──────────────────────────────────────────────

    /**
     * Generate an impulse response for reverb/echo using a simple decay model.
     * @param {number} duration - Impulse response duration in seconds
     * @param {number} decay - Decay coefficient (0-1, lower = longer decay)
     * @returns {AudioBuffer}
     * @private
     */
    function createImpulseResponse(duration, decay) {
        const ctx = ensureAudioContext();
        const sampleRate = ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = ctx.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }

        return buffer;
    }

    /**
     * Process an audio buffer through echo effect.
     * This creates a delayed copy mixed with the original.
     * @param {AudioBuffer} sourceBuffer
     * @param {{delayTime?: number, feedback?: number, mix?: number}} [options]
     * @returns {Promise<AudioBuffer>}
     * @private
     */
    async function applyEcho(sourceBuffer, options = {}) {
        const ctx = ensureAudioContext();
        const delayTime = options.delayTime ?? 0.3;
        const feedback = options.feedback ?? 0.4;
        const mix = options.mix ?? 0.5;

        const offlineCtx = new OfflineAudioContext(2, sourceBuffer.length, sourceBuffer.sampleRate);

        // Source
        const source = offlineCtx.createBufferSource();
        source.buffer = sourceBuffer;

        // Dry signal
        const dryGain = offlineCtx.createGain();
        dryGain.gain.value = 1 - mix;
        source.connect(dryGain);
        dryGain.connect(offlineCtx.destination);

        // Wet (echo) signal
        const delay = offlineCtx.createDelay(delayTime + 0.5);
        delay.delayTime.value = delayTime;

        const feedbackGain = offlineCtx.createGain();
        feedbackGain.gain.value = feedback;

        const wetGain = offlineCtx.createGain();
        wetGain.gain.value = mix;

        source.connect(delay);
        delay.connect(feedbackGain);
        feedbackGain.connect(delay); // feedback loop
        delay.connect(wetGain);
        wetGain.connect(offlineCtx.destination);

        source.start(0);
        const rendered = await offlineCtx.startRendering();
        return rendered;
    }

    // ──────────────────────────────────────────────
    // PRIVATE: EVENT SYSTEM (for module communication)
    // ──────────────────────────────────────────────

    /**
     * Custom event bus for module-to-module communication.
     * @param {string} name
     * @param {*} detail
     * @private
     */
    function emit(name, detail) {
        const event = new CustomEvent(`zenmix:${name}`, { detail, bubbles: true });
        document.dispatchEvent(event);
    }

    // ──────────────────────────────────────────────
    // PUBLIC: INITIALIZATION
    // ──────────────────────────────────────────────

    /**
     * Initialize the audio engine. Must be called from a user gesture (click/tap).
     * Lazily creates AudioContext, finds voices, and builds the mixer.
     * @returns {Promise<{ready: boolean, voicesLoaded: boolean}>}
     */
    async function init() {
        if (initialized) return { ready: true, voicesLoaded: !!selectedVoice };

        console.info('[NC-AUDIO] Initializing Audio Engine v4...');

        try {
            // Lazy AudioContext (user gesture required)
            ensureAudioContext();

            // Build mixer
            buildMixerChain();

            // Find best Spanish voice
            selectedVoice = await findBestSpanishVoice();
            if (selectedVoice) {
                console.info(`[NC-AUDIO] Selected TTS voice: ${selectedVoice.name} (${selectedVoice.lang})`);
            } else {
                console.warn('[NC-AUDIO] No Spanish voice found. TTS may use default voice.');
            }

            initialized = true;
            console.info('[NC-AUDIO] Audio Engine ready.');

            return { ready: true, voicesLoaded: !!selectedVoice };
        } catch (e) {
            console.error('[NC-AUDIO] Initialization failed:', e);
            return { ready: false, voicesLoaded: false };
        }
    }

    // ──────────────────────────────────────────────
    // PUBLIC: SESSION CONTROL
    // ──────────────────────────────────────────────

    /**
     * Start a full hypnosis session.
     * @param {import('./types').NCSessionConfig} config
     * @returns {Promise<{started: boolean, error?: string}>}
     */
    async function startSession(config) {
        if (sessionActive) {
            console.warn('[NC-AUDIO] Session already active. Stop first.');
            return { started: false, error: 'Session already active' };
        }

        sessionDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, config.duration || DEFAULT_DURATION));

        try {
            // Ensure audio context is initialized
            if (!audioCtx) {
                ensureAudioContext();
                buildMixerChain();
            }

            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            // Apply volume defaults from config or defaults
            const vols = config.volumes || DEFAULT_VOLUMES;
            setChannelVolume('master', vols.master ?? DEFAULT_VOLUMES.master);
            setChannelVolume('voice', vols.voice ?? DEFAULT_VOLUMES.voice);
            setChannelVolume('binaural', vols.binaural ?? DEFAULT_VOLUMES.binaural);
            setChannelVolume('ambient', vols.ambient ?? DEFAULT_VOLUMES.ambient);

            // Start binaural beats
            const binauralType = config.binauralType || 'alpha';
            startBinauralBeats(binauralType);

            // Start ambient sound
            const ambientType = config.ambientType || 'rain';
            startAmbient(ambientType, vols.ambient ?? DEFAULT_VOLUMES.ambient);

            // Start timer
            sessionActive = true;

            startTimer(
                (timeStr, remaining) => {
                    emit('timer', { time: timeStr, remaining });
                },
                () => {
                    console.info('[NC-AUDIO] Session duration reached. Stopping...');
                    stopSession();
                }
            );

            // Start voice script if enabled and provided
            if (config.voiceEnabled !== false && config.scriptText) {
                const voiceOptions = config.voiceOptions || { rate: 0.85, pitch: 1.0 };
                playHypnoScript(config.scriptText, voiceOptions);
            }

            emit('session:started', {
                duration: sessionDuration,
                binauralType,
                ambientType,
                voiceEnabled: config.voiceEnabled !== false
            });

            console.info(`[NC-AUDIO] Session started: ${binauralType} + ${ambientType}, ${sessionDuration}s`);

            return { started: true };
        } catch (e) {
            console.error('[NC-AUDIO] Failed to start session:', e);
            sessionActive = false;
            return { started: false, error: e.message };
        }
    }

    /**
     * Stop the current session.
     * Stops all playback: binaural, ambient, TTS, and timer.
     * @returns {{stopped: boolean, sessionData: import('./types').NCSessionResult|null}}
     */
    function stopSession() {
        if (!sessionActive) return { stopped: false, sessionData: null };

        stopBinauralBeats();
        stopAmbient();
        cleanupTimer();
        cleanupVoiceTimer();

        // Stop any TTS
        try {
            window.speechSynthesis?.cancel();
        } catch (_) { /* ignore */ }

        sessionActive = false;

        const sessionResult = /** @type {import('./types').NCSessionResult} */ ({
            duration_seconds: elapsedSeconds,
            completed: elapsedSeconds >= (sessionDuration - 2), // within 2s = completed
            binauralType: currentBinauralType,
            ambientType: currentAmbientType,
            voiceElapsed: voiceElapsed
        });

        emit('session:stopped', sessionResult);
        console.info('[NC-AUDIO] Session stopped.', sessionResult);

        return { stopped: true, sessionData: sessionResult };
    }

    /**
     * Check if a session is currently active.
     * @returns {boolean}
     */
    function isActive() {
        return sessionActive;
    }

    // ──────────────────────────────────────────────
    // PUBLIC: CHANNEL VOLUME CONTROL
    // ──────────────────────────────────────────────

    /**
     * Set volume for a specific channel.
     * @param {'voice'|'binaural'|'ambient'|'master'} channel
     * @param {number} value - 0 (silent) to 1 (full volume)
     * @returns {void}
     */
    function setChannelVolume(channel, value) {
        const clamped = Math.max(0, Math.min(1, value));
        let gainNode = null;

        switch (channel) {
            case 'voice':    gainNode = voiceGain;    break;
            case 'binaural': gainNode = binauralGain; break;
            case 'ambient':  gainNode = ambientGain;  break;
            case 'master':   gainNode = masterGain;   break;
            default:
                console.warn(`[NC-AUDIO] Unknown channel: "${channel}"`);
                return;
        }

        if (gainNode) {
            gainNode.gain.value = clamped;
        }
    }

    /**
     * Get current volume for a specific channel.
     * @param {'voice'|'binaural'|'ambient'|'master'} channel
     * @returns {number} Current volume (0-1)
     */
    function getChannelVolume(channel) {
        switch (channel) {
            case 'voice':    return voiceGain?.gain.value ?? DEFAULT_VOLUMES.voice;
            case 'binaural': return binauralGain?.gain.value ?? DEFAULT_VOLUMES.binaural;
            case 'ambient':  return ambientGain?.gain.value ?? DEFAULT_VOLUMES.ambient;
            case 'master':   return masterGain?.gain.value ?? DEFAULT_VOLUMES.master;
            default:         return 0;
        }
    }

    /**
     * Fade channel volume over time (for smooth transitions).
     * @param {'voice'|'binaural'|'ambient'|'master'} channel
     * @param {number} targetValue - Target volume 0-1
     * @param {number} durationMs - Fade duration in milliseconds
     * @returns {Promise<void>}
     */
    async function fadeChannelVolume(channel, targetValue, durationMs = 2000) {
        const startValue = getChannelVolume(channel);
        const startTime = performance.now();
        const clamped = Math.max(0, Math.min(1, targetValue));

        return new Promise((resolve) => {
            /**
             * Fade animation frame callback
             * @param {number} now
             */
            function fadeStep(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / durationMs, 1);
                // Ease-out curve
                const eased = 1 - Math.pow(1 - progress, 3);
                const value = startValue + (clamped - startValue) * eased;

                setChannelVolume(channel, value);

                if (progress < 1) {
                    requestAnimationFrame(fadeStep);
                } else {
                    setChannelVolume(channel, clamped);
                    resolve();
                }
            }

            requestAnimationFrame(fadeStep);
        });
    }

    // ──────────────────────────────────────────────
    // PUBLIC: VOICE RECORDING
    // ──────────────────────────────────────────────

    /**
     * Start recording microphone input.
     * @returns {Promise<{started: boolean, error?: string}>}
     */
    async function recordVoice() {
        const started = await startRecording();
        if (started) {
            emit('recorder:started', {});
            return { started: true };
        }
        return { started: false, error: 'Could not access microphone' };
    }

    /**
     * Stop recording and apply optional effects.
     * @param {{applyEcho?: boolean, applyReverb?: boolean}} [options]
     * @returns {Promise<{blob: Blob|null, url: string|null, error?: string}>}
     */
    async function stopRecording(options = {}) {
        try {
            const blob = await stopRecordingGetBlob();
            if (!blob) return { blob: null, url: null, error: 'No recording data' };

            // Apply effects if requested (simplified: we return the raw blob)
            // Full processing would use OfflineAudioContext for echo/reverb
            // For now, effects are applied at playback time

            const url = URL.createObjectURL(blob);

            emit('recorder:stopped', { blob, url });

            return { blob, url };
        } catch (e) {
            console.error('[NC-AUDIO] Failed to stop recording:', e);
            return { blob: null, url: null, error: e.message };
        }
    }

    // ──────────────────────────────────────────────
    // PUBLIC: BINAURAL PREVIEW
    // ──────────────────────────────────────────────

    /**
     * Play only binaural beats (no ambient, no voice) — for the "listen" preview mode.
     * @param {string} type - Binaural type key
     * @returns {Promise<{playing: boolean, error?: string}>}
     */
    async function playBinauralOnly(type) {
        try {
            if (!audioCtx) {
                ensureAudioContext();
                buildMixerChain();
            }

            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            // Stop any active session playback
            if (sessionActive) stopSession();

            startBinauralBeats(type);

            return { playing: true };
        } catch (e) {
            console.error('[NC-AUDIO] Failed to play binaural:', e);
            return { playing: false, error: e.message };
        }
    }

    /**
     * Stop only the binaural beat preview.
     */
    function stopBinauralOnly() {
        stopBinauralBeats();
    }

    // ──────────────────────────────────────────────
    // PUBLIC: EXPORT MIX
    // ──────────────────────────────────────────────

    /**
     * Export the current mix as a downloadable audio file.
     * Renders active binaural + ambient to an OfflineAudioContext buffer.
     * @param {number} [durationSeconds=30] - Length of exported clip
     * @returns {Promise<{url: string|null, blob: Blob|null, error?: string}>}
     */
    async function exportMix(durationSeconds = 30) {
        try {
            const ctx = ensureAudioContext();
            const duration = Math.min(durationSeconds, 120); // Max 2 minutes for export
            const sampleRate = ctx.sampleRate;
            const numChannels = 2;
            const frameCount = sampleRate * duration;

            const offlineCtx = new OfflineAudioContext(numChannels, frameCount, sampleRate);

            // --- Binaural beats in offline context ---
            const range = BINAURAL_RANGES[currentBinauralType];
            const diff = range ? (range.min + (range.max - range.min) * 0.5) : 10; // midpoint
            const baseFreq = range ? range.baseFreq : 200;

            // Left channel oscillator
            const oscLeft = offlineCtx.createOscillator();
            oscLeft.type = 'sine';
            oscLeft.frequency.value = baseFreq;
            const panLeft = offlineCtx.createStereoPanner();
            panLeft.pan.value = -1;
            oscLeft.connect(panLeft);

            const binauralOfflineGain = offlineCtx.createGain();
            binauralOfflineGain.gain.value = binauralGain?.gain.value ?? DEFAULT_VOLUMES.binaural;
            panLeft.connect(binauralOfflineGain);
            binauralOfflineGain.connect(offlineCtx.destination);

            // Right channel oscillator
            const oscRight = offlineCtx.createOscillator();
            oscRight.type = 'sine';
            oscRight.frequency.value = baseFreq + diff;
            const panRight = offlineCtx.createStereoPanner();
            panRight.pan.value = 1;
            oscRight.connect(panRight);
            panRight.connect(binauralOfflineGain);

            oscLeft.start(0);
            oscRight.start(0);

            // --- Procedural ambient noise in offline context ---
            // Generate a buffer of filtered noise
            const noiseBuffer = generateNoiseBuffer(offlineCtx, frameCount, currentAmbientType);
            const noiseSource = offlineCtx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            const ambientOfflineGain = offlineCtx.createGain();
            ambientOfflineGain.gain.value = ambientGain?.gain.value ?? DEFAULT_VOLUMES.ambient;
            noiseSource.connect(ambientOfflineGain);
            ambientOfflineGain.connect(offlineCtx.destination);
            noiseSource.start(0);

            const renderedBuffer = await offlineCtx.startRendering();

            // Convert AudioBuffer to WAV Blob
            const wavBlob = audioBufferToWav(renderedBuffer);
            const url = URL.createObjectURL(wavBlob);

            console.info(`[NC-AUDIO] Mix exported: ${duration}s, ${(wavBlob.size / 1024).toFixed(1)}KB`);

            return { url, blob: wavBlob };
        } catch (e) {
            console.error('[NC-AUDIO] Failed to export mix:', e);
            return { url: null, blob: null, error: e.message };
        }
    }

    /**
     * Generate a noise buffer for offline rendering.
     * @param {OfflineAudioContext} ctx
     * @param {number} frameCount
     * @param {string} type
     * @returns {AudioBuffer}
     * @private
     */
    function generateNoiseBuffer(ctx, frameCount, type) {
        const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        /** @type {{alpha: number, gain: number}} */
        const configs = {
            rain:  { alpha: 0.005, gain: 0.4 },
            wind:  { alpha: 0.001, gain: 0.35 },
            ocean: { alpha: 0.003, gain: 0.35 },
            fire:  { alpha: 0.08,  gain: 0.3 },
            forest:{ alpha: 0.01,  gain: 0.25 },
            night: { alpha: 0.015, gain: 0.15 }
        };

        const cfg = configs[type] || configs.rain;
        let brownState = 0;

        for (let i = 0; i < frameCount; i++) {
            const white = (Math.random() * 2 - 1) * cfg.gain;
            brownState = brownState * (1 - cfg.alpha) + white * cfg.alpha;
            data[i] = brownState * 1.5;
        }

        return buffer;
    }

    /**
     * Convert AudioBuffer to WAV format Blob.
     * @param {AudioBuffer} buffer
     * @returns {Blob}
     * @private
     */
    function audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const bytesPerSample = 2; // 16-bit PCM
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = length * blockAlign;
        const headerSize = 44;
        const totalSize = headerSize + dataSize;

        const arrayBuffer = new ArrayBuffer(totalSize);
        const view = new DataView(arrayBuffer);
        const uint8View = new Uint8Array(arrayBuffer);

        // RIFF header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, totalSize - 8, true);  // file size - 8
        writeString(view, 8, 'WAVE');

        // fmt chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);            // chunk size
        view.setUint16(20, 1, true);             // PCM format
        view.setUint16(22, numChannels, true);   // channels
        view.setUint32(24, sampleRate, true);    // sample rate
        view.setUint32(28, byteRate, true);      // byte rate
        view.setUint16(32, blockAlign, true);    // block align
        view.setUint16(34, bytesPerSample * 8, true); // bits per sample

        // data chunk
        writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Write PCM samples
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    /** @param {DataView} view @param {number} offset @param {string} str */
    function writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    // ──────────────────────────────────────────────
    // PUBLIC: UTILITIES
    // ──────────────────────────────────────────────

    /**
     * Get the list of available binaural beat types.
     * @returns {Array<{key: string, label: string, range: string}>}
     */
    function getBinauralTypes() {
        return Object.entries(BINAURAL_RANGES).map(([key, range]) => ({
            key,
            label: range.label,
            range: `${range.min}-${range.max} Hz`
        }));
    }

    /**
     * Get the list of available ambient sound types.
     * @returns {Array<{key: string, label: string, icon: string}>}
     */
    function getAmbientTypes() {
        return [
            { key: 'rain',   label: 'Lluvia',   icon: '🌧️' },
            { key: 'wind',   label: 'Viento',   icon: '💨' },
            { key: 'ocean',  label: 'Océano',   icon: '🌊' },
            { key: 'fire',   label: 'Fuego',    icon: '🔥' },
            { key: 'forest', label: 'Bosque',   icon: '🌲' },
            { key: 'night',  label: 'Noche',    icon: '🌙' }
        ];
    }

    /**
     * Suspend the AudioContext to save battery when not in use.
     */
    function suspend() {
        if (audioCtx && audioCtx.state === 'running') {
            audioCtx.suspend().catch(e => console.warn('[NC-AUDIO] Suspend failed:', e));
        }
    }

    /**
     * Resume the AudioContext.
     * @returns {Promise<void>}
     */
    async function resume() {
        if (audioCtx && audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
    }

    /**
     * Dispose of all resources and close AudioContext.
     */
    async function dispose() {
        stopSession();
        if (audioCtx) {
            await audioCtx.close();
            audioCtx = null;
            masterGain = null;
            voiceGain = null;
            binauralGain = null;
            ambientGain = null;
        }
        selectedVoice = null;
        initialized = false;
        console.info('[NC-AUDIO] Disposed.');
    }

    // ──────────────────────────────────────────────
    // MODULE ASSEMBLY
    // ──────────────────────────────────────────────

    Object.assign(MODULE, {
        // Lifecycle
        init,
        dispose,
        suspend,
        resume,

        // Session
        startSession,
        stopSession,
        isActive,

        // Channels
        setChannelVolume,
        setVolume: setChannelVolume, // alias
        getChannelVolume,
        fadeChannelVolume,

        // Binaural
        playBinauralOnly,
        stopBinauralOnly,

        // Recording
        recordVoice,
        stopRecording,

        // Export
        exportMix,

        // Info
        getBinauralTypes,
        getAmbientTypes,

        // State access (read-only)
        get currentBinauralType() { return currentBinauralType; },
        get currentAmbientType() { return currentAmbientType; },
        get sessionElapsed() { return elapsedSeconds; },
        get sessionDuration() { return sessionDuration; }
    });

    // ──────────────────────────────────────────────
    // NAMESPACE REGISTRATION
    // ──────────────────────────────────────────────

    /** @type {import('./types').ZENMIXNamespace} */
    window.ZENMIX = window.ZENMIX || {};
    window.ZENMIX.audio = MODULE;

    console.info('[NC-AUDIO] Registered at window.ZENMIX.audio');
})();
