# 🏗️ PWA_ARCHITECTURE.md — ZenMix Studio

> Arquitectura profesional para ZenMix: PWA offline-first, sistema de proyectos con localStorage, polyfills cross-browser, y pipeline de audio robusto.

---

## 📁 Estructura Final del Proyecto

```
zenmix-repo/
├── App.tsx                              ← Shell ligero con tabs + gestión de proyectos
├── index.tsx                            ← Entry con registro de SW programático
├── index.html                           ← Meta tags PWA + manifest link + SW inline fallback
│
├── components/
│   ├── Recorder.tsx                     ← Captura micrófono (usa audioUtils polyfill)
│   ├── Mixer.tsx                        ← Mesa de mezcla con preview en tiempo real
│   ├── AIVoiceGenerator.tsx             ← Gemini TTS con chunking resiliente
│   └── AudioUpload.tsx                  ← Multi-file upload + merge
│
├── hooks/
│   └── useProjects.ts                   ← Gestión de proyectos con sync a localStorage
│
├── services/
│   ├── audioEngine.ts                   ← Motor de renderizado offline (usa polyfill)
│   ├── audioUtils.ts                    ← Polyfills + error handling centralizado  🆕
│   ├── projectStorage.ts               ← CRUD localStorage para proyectos          🆕
│   ├── registerSW.ts                    ← Registro programático de Service Worker  🆕
│   ├── audioWorker.ts                   ← Web Worker para renderizado background
│   ├── zenmix-processor.ts              ← AudioWorklet processor (render thread)
│   └── waveformWorker.ts                ← Waveform generator en worker
│
├── public/
│   ├── sw.js                            ← Service Worker offline-first             🆕
│   ├── manifest.webmanifest             ← PWA manifest con íconos                  🆕
│   ├── icon-192.png                     ← Ícono PWA generado                       🆕
│   └── icon-512.png                     ← Ícono PWA generado                       🆕
│
├── scripts/
│   └── generate-icons.mjs               ← Script Node.js puro para generar PNGs    🆕
│
├── constants.ts, types.ts, vite.config.ts, tsconfig.json, package.json
```

---

## 🧩 1. PWA Completa

### 1.1 Manifest (`public/manifest.webmanifest`)

```json
{
  "name": "ZenMix Studio",
  "short_name": "ZenMix",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#1a241a",
  "theme_color": "#2d3d2d",
  "orientation": "portrait-primary",
  "lang": "es-MX",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### 1.2 Service Worker (`public/sw.js`)

Estrategia **stale-while-revalidate**:
- **Install**: Pre-cachea shell estática (/, index.html, manifest, icons)
- **Activate**: Limpia caches viejos, toma control inmediato
- **Fetch**: Sirve de cache primero, actualiza en background. Si no hay red, sirve versión cacheada.

```js
// Flujo simplificado:
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(response => {
        cache.put(request, response.clone());
        return response;
      }).catch(() => cached || offlineResponse)
    )
  );
});
```

### 1.3 Registro programático (`services/registerSW.ts`)

- Detecta `serviceWorker` en navigator
- Registra `/sw.js` al load
- Escucha `updatefound` para notificar nuevas versiones
- Auto-reload cuando nuevo SW toma control (`controllerchange`)

### 1.4 Meta Tags en HTML

```html
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#1a241a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ZenMix">
<link rel="apple-touch-icon" href="/icon-192.png">
```

### 1.5 Íconos PWA

Generados con `scripts/generate-icons.mjs` — Node.js puro, sin dependencias externas. Crea PNGs RGBA 192x192 y 512x512 con gradiente circular sage sobre fondo oscuro.

---

## 💾 2. Sistema de Proyectos con localStorage

### 2.1 `services/projectStorage.ts`

API completa tipo repositorio:

| Método | Descripción |
|--------|-------------|
| `getAll()` | Todos los proyectos guardados |
| `getById(id)` | Proyecto específico |
| `getActive()` | Último proyecto usado |
| `create(name, config?)` | Nuevo proyecto desde defaults |
| `update(id, updates)` | Actualización parcial |
| `delete(id)` | Eliminación segura |
| `duplicate(id)` | Clon con "(copia)" |
| `syncConfig(id, config)` | Sincroniza config activo |
| `setActive(id)` | Marca como activo |

### 2.2 `hooks/useProjects.ts`

Hook React que integra el storage con el ciclo de vida:
- Carga proyecto activo al montar (o crea uno nuevo)
- **Debounce de 800ms** para writes a localStorage (evita thrashing)
- Flush pendiente al desmontar
- Expone: `project`, `projects`, `config`, `setConfig`, `saveNewProject`, `loadProject`, `deleteProject`, `duplicateProject`

### 2.3 UI en `App.tsx`

- Botón 📁 en header abre dropdown de proyectos
- Lista con nombre + fecha + acciones (cargar, duplicar, eliminar)
- Botón "+ Nuevo" para crear proyecto
- Al cargar proyecto: resetea sesión (voz, renders) y vuelve al step 1

---

## 🎛️ 3. Polyfill AudioContext + Error Handling

### 3.1 `services/audioUtils.ts`

**Funciones de polyfill:**

```typescript
createAudioContext()          // AudioContext || webkitAudioContext (Safari)
createOfflineAudioContext()   // OfflineAudioContext || webkitOfflineAudioContext
resumeAudioContext(ctx)       // ctx.resume() con mensaje amigable
safeDecodeAudioData(ctx, buf) // decodeAudioData con try/catch y mensajes
isAudioSupported()            // Feature detection
```

**Clase `AudioError`:**
```typescript
class AudioError extends Error {
  code: 'MICROPHONE_DENIED' | 'DECODE_FAILED' | 'RENDER_FAILED'
      | 'CONTEXT_SUSPENDED' | 'UNSUPPORTED_FORMAT' | 'UNSUPPORTED_BROWSER' | 'GENERIC';
}
```

**`formatAudioError(err)`**: Convierte cualquier error a string amigable en español.

### 3.2 Consistencia aplicada en TODOS los componentes

| Archivo | Cambio |
|---------|--------|
| `App.tsx` (handleExport) | `createAudioContext()` + `safeDecodeAudioData()` + `formatAudioError()` |
| `Recorder.tsx` | `createAudioContext()` en lugar de `new (window.AudioContext \|\| ...)` |
| `Mixer.tsx` (startPreview) | `createAudioContext()` + `safeDecodeAudioData()` + `formatAudioError()` |
| `AudioUpload.tsx` (merge) | `createAudioContext()` + `safeDecodeAudioData()` + `formatAudioError()` |
| `audioEngine.ts` (renderFinalMix) | `createOfflineAudioContext()` en lugar de `new OfflineAudioContext()` |

---

## ⚙️ 4. Workers & Worklets

### 4.1 Web Worker: `services/audioWorker.ts`

Renderizado offline en thread separado:
- Recibe `config` + `voiceBuffer` (ArrayBuffer) vía postMessage
- Reconstruye AudioBuffer, ejecuta `OfflineAudioContext.startRendering()`
- Devuelve buffer interleaved stereo vía **transfer** (zero-copy)
- Reporta progreso (10%, 90%)

### 4.2 AudioWorklet: `services/zenmix-processor.ts`

Procesador que corre en el **Audio Rendering Thread**:
- Cargado vía `audioWorklet.addModule()`
- Procesa 128 frames por callback
- Sirve como punto de sincronización para procesamiento en tiempo real

### 4.3 Waveform Worker: `services/waveformWorker.ts`

Genera visualización de forma de onda en canvas + ImageBitmap offscreen.

---

## ✅ Validación

- **TypeScript**: `tsc --noEmit` → 0 errores
- **Build Vite**: `npm run build` → éxito (765KB bundle, 208KB gzipped)
- **Archivos excluidos de TS**: `public/sw.js`, `audioWorker.ts`, `zenmix-processor.ts`, `waveformWorker.ts` (corren en contextos especializados)

---

## 🔮 Roadmap Futuro

1. **Firebase Auth + Firestore** — Guardar proyectos en la nube con sincronización multi-dispositivo
2. **Undo/Redo** — Sistema de versiones con stack de comandos
3. **AudioWorklet avanzado** — Procesamiento de efectos en tiempo real en el render thread
4. **IndexedDB** — Para archivos de audio grandes (>5MB localStorage limit)
5. **Background Sync** — Sincronizar proyectos cuando vuelve la conexión
