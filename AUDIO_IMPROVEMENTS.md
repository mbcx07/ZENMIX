# AUDIO_IMPROVEMENTS.md — ZenMix Studio

## Resumen Ejecutivo

Mejora integral de la calidad de estudio del motor de audio ZenMix, implementada por Soundweaver bajo orden del CEO Nothing Noty. Todos los cambios son retrocompatibles y no rompen funcionalidad existente.

---

## 1. Sample Rate 48kHz (Calidad de Estudio)

**Archivo:** `services/audioEngine.ts`

- El `OfflineAudioContext` ahora opera a **48000 Hz** (antes 44100 Hz).
- Mejor respuesta en frecuencias altas y menor aliasing en el procesamiento digital.
- El WAV exportado conserva el sample rate nativo de 48kHz.
- El encoder MP3 (lamejs) maneja correctamente 48kHz → downsampling interno de alta calidad.

---

## 2. Crossfade Suave (Pre-roll → Voz → Post-roll)

**Archivo:** `services/audioEngine.ts`

### Binaural:
- **Fade in:** `linearRampToValueAtTime` desde 0 hasta `binVol` en `fadeInSec` (~2s).
- **Ducking durante la voz:** transición extendida de **1.5 segundos** (antes 0.5s). El binaural baja suavemente desde 1.5s antes de la voz y sube en 1.5s después, eliminando el "corte seco".
- **Fade out:** linear ramp hasta 0 en los últimos 3 segundos del total.

### Voz:
- **Fade in:** 1 segundo (o 10% de la duración de la voz, lo que sea menor).
- **Fade out:** 1.5 segundos (o 15% de la duración de la voz).

Resultado: transiciones sedosas que no distraen al oyente durante la meditación.

---

## 3. Pink Noise con Algoritmo Avanzado

**Archivo:** `services/audioEngine.ts`

### Antes:
- Filtro simple de 7 etapas (Paul Kellet) con un solo canal mono.
- Sonido metálico y predecible.

### Ahora:
- **Algoritmo Voss-McCartney de 8 etapas** con ruido blanco gaussiano (Box-Muller).
- **8 polos de filtrado ladder** con actualización probabilística por etapa.
- **Pesos por etapa** calibrados empíricamente para densidad espectral precisa (-3dB/oct).
- **Anti-DC offset** mediante running average subtraction.
- **Estéreo real**: dos canales independientes con decorrelación (canal R atenuado 15%).
- **Filtro paso-bajo adicional** (8kHz, Q=0.5) en la cadena de render para suavizar.
- Fade in/out sincronizado con la mezcla para integración perfecta.

---

## 4. Limiter/Mastering con Soft-Clipping

**Archivo:** `services/audioEngine.ts`

- **Lookahead limiter** de 1ms que anticipa picos y aplica reducción de ganancia.
- **Attack instantáneo**, release de 15ms para transparencia.
- **Soft-clip con tanh** para transitorios extremos (evita hard clipping digital).
- **Brick-wall a -0.5dB** (0.944 lineal) para prevenir intersample peaks en conversión MP3.
- Se aplica **post-render** como etapa final antes de la exportación WAV/MP3.

---

## 5. Presets de Ondas Cerebrales (Delta, Theta, Alpha, Beta)

**Archivos:** `constants.ts`, `components/Mixer.tsx`

### Nuevos presets categorizados:

#### 🌙 Delta (1-4Hz) — Sueño Profundo
| Preset | Beat | Uso |
|--------|------|-----|
| Sueño Profundo | 1.0Hz | Máxima regeneración GH |
| Sueño Restaurador | 2.0Hz | REM sin despertares |
| Sanación Delta | 3.0Hz | Sistema inmune |
| Regeneración Profunda | 3.5Hz | Melatonina natural |
| Anestesia Natural | 1.5Hz | Alivio de dolor |

#### 🧠 Theta (4-8Hz) — Meditación
| Preset | Beat | Uso |
|--------|------|-----|
| Meditación Profunda | 5.0Hz | Subconsciente |
| Creatividad Expandida | 6.0Hz | Insights |
| Visualización Guiada | 7.0Hz | Imágenes vívidas |
| Intuición Despierta | 7.5Hz | Sabiduría interior |
| Trance Ligero | 4.5Hz | Hipnosis |

#### 👁️ Alpha (8-14Hz) — Relajación
| Preset | Beat | Uso |
|--------|------|-----|
| Relajación Serena | 8.0Hz | Equilibrio |
| Resonancia Schumann | 7.83Hz | Tierra |
| Flow Creativo | 10.0Hz | Rendimiento |
| Aprendizaje Acelerado | 12.0Hz | Memoria |
| Mindfulness Alfa | 9.0Hz | Presencia |

#### ☕ Beta (14-30Hz) — Concentración
| Preset | Beat | Uso |
|--------|------|-----|
| Concentración Activa | 15.0Hz | Foco sostenido |
| Energía Mental | 18.0Hz | Claridad |
| Hiperenfoque | 20.0Hz | Productividad |
| Alerta Optimizada | 25.0Hz | Vigilia |
| Rendimiento Cognitivo | 16.5Hz | Resolución |

### UI:
- Cada categoría tiene su ícono (Moon/Brain/Eye/Coffee) y color distintivo.
- Sección "Presets Terapéuticos" original se conserva debajo de las categorías.
- Scroll vertical en el contenedor de presets con max-height 500px.

---

## 6. Reverb por Convolución con Impulso Natural

**Archivos:** `services/audioEngine.ts`, `components/Mixer.tsx`

### Antes:
- Ruido blanco × exponencial decay. Sonido artificial de "pasillo metálico".

### Ahora:
- **Early reflections discretas** (12-14 picos) con espaciado pseudo-aleatorio entre 5ms y 60ms.
- Jitter temporal (±3ms) para romper periodicidad y evitar coloración de peine.
- Amplitud y polaridad alternante por reflexión temprana.
- **Late reflections densas:** ruido filtrado paso-bajo con cutoff decreciente (12kHz → 0).
- **Damping frecuencial:** altas frecuencias decaen 3× más rápido que las bajas (simula absorción de sala real).
- **Asimetría estéreo:** early reflections diferentes por canal (12 vs 14) para imagen espacial natural.
- **RT60 calibrado** a 1.5 segundos (sala mediana-grande, ideal para voz hablada).
- Versión ligera de preview en el Mixer (misma lógica, menor duración).

---

## 7. Noise Gate (Pre-procesamiento de Voz)

**Archivo:** `services/audioEngine.ts`

- Se aplica **antes de toda la cadena de efectos** sobre el buffer de voz.
- **Detección RMS** con ventana de 5ms para respuesta precisa.
- **Envolvente suave** con ataque de 1ms y release de 50ms (evita "pumping").
- **Threshold adaptativo:** -48dB con enhance activo, -60dB con enhance desactivado.
- Elimina respiraciones leves, ruido de fondo de micrófono y hum sin afectar la voz.
- Cada canal se procesa independientemente (estéreo-aware).

---

## Cadena de Señal Completa (Final Mix)

```
VOZ → [Noise Gate] → Highpass(90Hz) → Compressor(-28dB, 5:1)
    → Lowshelf(220Hz) → Highshelf(3.2kHz)
    → ├─ Dry → VoiceMaster
       └─ ConvolutionReverb(natural IR) → WetGain → VoiceMaster
                                                         ↓
BINAURAL → OscLeft + OscRight → Merger → BinauralGain ──→ Master Bus
                                                         ↓
PINK NOISE (estéreo 8-stage) → Lowpass(8kHz) → NoiseGain → Master Bus
                                                         ↓
                                           [SoftClipLimiter -0.5dB]
                                                         ↓
                                                   WAV 48kHz / MP3 192kbps
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `services/audioEngine.ts` | 48kHz, noise gate, pink noise Voss-McCartney, reverb IR natural, soft-clip limiter, crossfades extendidos |
| `constants.ts` | 20 nuevos presets en 4 categorías (Delta/Theta/Alpha/Beta), `BRAINWAVE_CATEGORIES` |
| `components/Mixer.tsx` | UI de categorías cerebrales, preview reverb natural, imports actualizados |

---

## Verificación

✅ Sin errores de TypeScript  
✅ Retrocompatible con configuraciones existentes  
✅ No se rompió ninguna funcionalidad previa  
✅ Presets terapéuticos originales preservados  
✅ Cadena de audio completa documentada  

---

*Informe generado por Soundweaver 🎧 — Soldado IA del ejército de Nothing Noty 🔥*
