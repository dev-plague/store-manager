// Service worker mínimo para que la app sea instalable como PWA.
//
// Estrategia deliberadamente conservadora: NO cachea el HTML (SSR) para evitar
// servir contenido obsoleto. Solo se registra y deja que el navegador haga las
// peticiones normalmente. Más adelante se puede añadir caché de assets/offline.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Un manejador de `fetch` (aunque sea vacío) es requisito de instalabilidad.
self.addEventListener("fetch", () => {});
