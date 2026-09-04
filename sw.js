/* Service worker del Diario Upper/Lower.
   Strategia: cache-first su tutti gli asset dell'app (sono pochi e statici),
   così dopo la prima apertura l'app funziona completamente senza rete.
   Per pubblicare una versione nuova basta cambiare CACHE. */

var CACHE = "diario-ul-v5";

var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        // addAll fa una scrittura in blocco: e' l'unica forma che si e'
        // dimostrata affidabile qui. Scritture separate sulla stessa cache
        // (in parallelo o in sequenza) falliscono con "Entry already exists"
        // e l'installazione salta, lasciando il worker mai attivato.
        return cache.addAll(ASSETS);
      })
      .then(function () { return self.skipWaiting(); })
  );
});

// richiesta di attivazione immediata da parte della pagina
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // navigazione: sempre l'app shell, anche offline
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then(function (cached) {
        return cached || fetch(req).catch(function () {
          return caches.match("./index.html");
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        // metto in cache anche ciò che non era nel precache
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          // una scrittura concorrente qui puo' fallire: non deve mai
          // compromettere la risposta che stiamo restituendo
          caches.open(CACHE)
            .then(function (c) { return c.put(req, copy); })
            .catch(function () {});
        }
        return res;
      }).catch(function () {
        return cached;
      });
    })
  );
});
