/**
 * Registers the service worker for PWA offline support.
 * Call once from the app entry point.
 */
export function registerSW(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[ZenMix PWA] SW registered:', reg.scope);

        // Auto-update prompt
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[ZenMix PWA] Update available — reload to apply.');
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[ZenMix PWA] SW registration failed:', err);
      });
  });

  // Auto-reload when new SW takes over
  let refreshing = false;
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
