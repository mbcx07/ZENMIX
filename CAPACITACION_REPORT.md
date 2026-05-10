# 🎓 CAPACITACIÓN IRONMIND — Rendimiento de Audio en el Navegador

**Fecha:** 2025-07-10  
**Fuentes:** ClawHub Skills + MDN + Chrome Developers + Papers  

---

## Skills Adquiridos de ClawHub

### 1. React Performance Patterns (wpank/react-performance)
**Instalación:** `npx clawhub@latest install react-performance`
- **7 categorías por prioridad:** Async waterfalls > Bundle Size > Server Components > Re-renders > Rendering > Client Data > JS Perf
- **Patrones críticos:** Parallel `Promise.all()`, Suspense boundaries, dynamic imports con preload on hover, `startTransition` para updates no urgentes
- **Anti-patrones detectados en ZenMix:** AIVoiceGenerator importado eager, múltiples awaits secuenciales en render pipeline

### 2. React Best Practices — Vercel Engineering (wpank/react-best-practices)
**Instalación:** `npx clawhub@latest install react-best-practices`
- **57 reglas en 8 categorías**
- **Reglas clave para ZenMix:**
  - `rerender-derived-state-no-effect` → derivar estado durante render, no en useEffect
  - `rerender-transitions` → usar startTransition para filtros de búsqueda
  - `rendering-content-visibility` → listas largas con CSS containment
  - `bundle-dynamic-imports` → lazy loading para TODOS los componentes pesados
  - `js-set-map-lookups` → O(1) en lugar de O(n)

### 3. Web Performance Audit (elithrar/web-perf)
**Instalación:** `npx clawhub@latest install web-perf`
- **Core Web Vitals:** LCP < 4s, CLS < 0.25, TBT < 600ms, INP < 500ms
- **Network:** Preload de recursos críticos, cache headers, compression
- **Codebase:** Tree-shaking, barrel imports, dead code elimination

---

## Conocimiento Técnico Adquirido (MDN + Chrome Dev)

### 4. Web Audio API Best Practices (MDN)
- `AudioContext` debe crearse dentro de un user gesture (autoplay policy)
- `OfflineAudioContext` es para renderizado no-real-time (nuestro caso)
- `AudioParam` methods (`setValueAtTime`, `linearRampToValueAtTime`) tienen prioridad sobre value directo
- **Principio clave:** NO crear/destruir AudioContext repetidamente — reusar o cerrar

### 5. AudioWorklet Design Patterns (Chrome Developers)
- **AudioWorklet corre en un thread dedicado de audio** (NO es el main thread, NO es un Web Worker)
- Procesa 128 frames por callback — timing budget: ~3ms a 44.1kHz
- **WebAssembly + AudioWorklet** = zero garbage collection, velocidad nativa
- **Ring Buffers** para manejar mismatch de buffer size (ej: 128 → 512 frames)
- **Patrón WASM:** `emcc -s BINARYEN_ASYNC_COMPILATION=0 -s SINGLE_FILE=1 --post-js processor.js`
- Transferencia cross-thread del módulo WASM vía constructor options

### 6. Canvas Performance (Investigación)
- **OffscreenCanvas** permite renderizar waveform en Web Worker
- `requestAnimationFrame` en main thread es aceptable para visualización ligera
- Para análisis pesado (FFT, spectrogram), usar Worker + OffscreenCanvas
- `content-visibility: auto` en CSS para listas de bloques de audio

---

## Diagnóstico ZenMix — Lo que Ya Tenemos vs Lo que Falta

| Aspecto | Ronda 1 (Hecho) | Ronda 2 (Plan) |
|---|---|---|
| Render offline | Web Worker (postMessage) | AudioWorklet + WASM (zero-copy, sin serialización) |
| Memoria audios largos | IndexedDB blob store | LRU buffer cache + streaming decode |
| Cancelación | AbortController → worker.terminate() | Señal de cancelación intra-worklet + cleanup parcial |
| Lazy loading | Solo AIVoiceGenerator | TODOS los componentes pesados + preload on hover |
| Canvas | requestAnimationFrame en Mixer | OffscreenCanvas en Worker para waveform/spectrogram |
| Bundle | Barrel imports de lucide-react | Imports directos (lucide-react/dist/esm/icons/...) o tree-shaking |
| Re-renders | Nada específico | startTransition para filtros, React.memo para Mixer knobs |
| Caché buffers | Nada | LRU Map para buffers de audio reutilizados |
---

🔥 **Capacitación completada. El plan de la Ronda 2 está listo para ejecución, CEO.**
