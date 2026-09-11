// Service Worker de LIVIMA
// Estrategia: el "cascaron" (index + manifest + iconos) se descarga de una vez al instalar.
// Cada simulador se guarda en cache la primera vez que un estudiante lo abre (no se
// fuerza la descarga de los 18 de entrada, para no pesar el primer uso). Una vez
// visitado un simulador, queda disponible sin conexion de ahi en adelante.

const CACHE_NAME = "livima-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
];

// Lista de los 18 simuladores, para que el navegador pueda distinguirlos de
// otro tipo de peticiones (imagenes externas, fuentes, etc.) y aplicarles la
// estrategia de cache-primero-luego-actualiza.
const SIMULADORES = [
  "01-mapa-de-color-colegio-oculto.html",
  "02-lienzo-simetria-espejos-vivos.html",
  "03-mosaico-baldosas-de-mi-tierra.html",
  "04-tejedor-de-pintas-hilo-de-los-zenu.html",
  "05-detector-de-simetrias.html",
  "06-arbol-fractal-bosque-infinito.html",
  "01-a-escala-humana.html",
  "02-el-patio-de-tales.html",
  "03-el-rectangulo-de-oro.html",
  "04-telar-de-la-trenza-exacta.html",
  "05-la-cocina-del-sinu.html",
  "06-el-compas-del-porro.html",
  "01-agrimensor-virtual.html",
  "02-el-roseton-del-giro.html",
  "03-constructor-de-ondas.html",
  "04-el-pulso-del-calor.html",
  "05-la-ciudad-en-colores.html",
  "06-monteria-en-cifras.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

function esCascaron(pathname) {
  return (
    pathname === "/" ||
    pathname.endsWith("/index.html") ||
    pathname.endsWith("/manifest.json") ||
    pathname.endsWith("/icon-192.png") ||
    pathname.endsWith("/icon-512.png") ||
    pathname.endsWith("/icon-maskable-512.png")
  );
}

function esSimulador(pathname) {
  return SIMULADORES.some((f) => pathname.endsWith("/" + f));
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // no tocar peticiones externas
  if (event.request.method !== "GET") return;

  // cascaron de la app: cache primero, sin ir a red si ya esta guardado
  if (esCascaron(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // simuladores: cache-primero-luego-actualiza (stale-while-revalidate).
  // Se sirve al instante lo que ya haya guardado (incluso sin internet), y en
  // paralelo se pide una copia fresca para la proxima vez.
  if (esSimulador(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response && response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached); // sin internet y sin cache previo: no hay nada mas que hacer
          return cached || fetchPromise;
        })
      )
    );
  }
});
