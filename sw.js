// ============================================================
// Service Worker — Biblia en un Año · Asociación San Juan Apóstol
// ============================================================
// Estrategia: cache-first para los archivos propios de la app
// (HTML, CSS, JS, manifest, íconos). Todo lo que vaya hacia otro
// origen (Firebase, fuentes de Google, etc.) se deja pasar sin
// intervenir — el Service Worker NUNCA cachea ni intercepta
// llamadas a Firestore, porque eso rompería la sincronización.

const CACHE_NAME = 'biblia365-v3';

const APP_SHELL = [
  './',
  './index.html',
  './coordinador.html',
  './manifest.webmanifest',
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

// ---- Fetch: cache-first para el propio origen, red directa para todo lo demás ----
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
    caches.match(req).then(function(cached){
      if(cached) {
        // Cache-first: servimos lo guardado de inmediato, y en paralelo
        // intentamos actualizar el caché para la próxima vez (si hay red).
        fetchAndUpdateCache(req);
        return cached;
      }
      // No estaba en caché: intentamos red, y si funciona lo guardamos.
      return fetchAndUpdateCache(req).catch(function(){
        // Sin red y sin caché para esta URL puntual: si es una navegación
        // de página (el usuario abriendo la app), devolvemos al menos
        // el index como fallback para que la app cargue igual.
        if(req.mode === 'navigate'){
          return caches.match('./index.html');
        }
        return new Response('', { status: 503, statusText: 'Sin conexión' });
      });
    })
  );
});

function fetchAndUpdateCache(req){
  return fetch(req).then(function(networkResponse){
    if(networkResponse && networkResponse.ok){
      var copy = networkResponse.clone();
      caches.open(CACHE_NAME).then(function(cache){
        cache.put(req, copy);
      });
    }
    return networkResponse;
  });
}
