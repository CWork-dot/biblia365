// ============================================================
// Service Worker — Biblia en un Año · Asociación San Juan Apóstol
// ============================================================
// Estrategia: NETWORK-FIRST para los archivos propios de la app
// (HTML, CSS, JS, manifest, íconos). Si hay conexión, siempre se
// pide la versión más nueva al servidor y se actualiza el caché.
// Solo si no hay red se usa lo que quedó guardado de la última vez.
// Todo lo que vaya hacia otro origen (Firebase, fuentes de Google,
// etc.) se deja pasar sin intervenir — el Service Worker NUNCA
// cachea ni intercepta llamadas a Firestore.

const CACHE_NAME = 'biblia365-v7';

const APP_SHELL = [
  './',
  './index.html',
  './coordinador.html',
  './diagnostico.html',
  './manifest.webmanifest',
  './app-shell.js',
  './app-firebase.js',
  './coordinador.js',
  './shared.css',
  './icon-logo.png'
];

// ---- Instalación: precachea el "cascarón" de la app ----
self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(
        APP_SHELL.map(function(url){
          return cache.add(url).catch(function(err){
            // si algún archivo individual falla (ej. 404), no abortamos
            // todo el precacheo — solo lo registramos
            console.warn('[SW] No se pudo precachear', url, err);
          });
        })
      );
    })
  );
});

// ---- Activación: limpia versiones viejas del caché ----
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

// ---- Fetch: network-first para el propio origen, red directa para todo lo demás ----
self.addEventListener('fetch', function(event){
  var req = event.request;

  // Solo manejamos peticiones GET
  if(req.method !== 'GET') return;

  var url = new URL(req.url);

  // Si la petición es a otro origen (Firebase, Google Fonts, CDNs, etc.)
  // la dejamos pasar tal cual, sin cachear ni interceptar.
  if(url.origin !== self.location.origin){
    return;
  }

  event.respondWith(
    fetch(req).then(function(networkResponse){
      // Hay red: usamos SIEMPRE la versión del servidor (la más nueva)
      // y de paso actualizamos el caché para la próxima vez sin conexión.
      if(networkResponse && networkResponse.ok){
        var copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
      }
      return networkResponse;
    }).catch(function(){
      // Sin red: recién ahí recurrimos a lo que quedó guardado.
      return caches.match(req).then(function(cached){
        if(cached) return cached;
        if(req.mode === 'navigate'){
          return caches.match('./index.html');
        }
        return new Response('', { status: 503, statusText: 'Sin conexión' });
      });
    })
  );
});
