// Service Worker de LIVIMA
// Estrategia: el "cascaron" (index + manifest + iconos) se descarga de una vez al instalar.
// Cada simulador se guarda en cache la primera vez que un estudiante lo abre (no se
// fuerza la descarga de los 18 de entrada, para no pesar el primer uso). Con internet
// siempre se descarga la version mas reciente; sin internet se usa la copia guardada.

const CACHE_NAME = "livima-v14";

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

  // cascaron de la app: red primero (asi el index siempre llega actualizado)
  // y, si no hay internet, se usa la copia guardada.
  if (esCascaron(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((response) => {
            if (response && response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cache.match(event.request, { ignoreSearch: true }))
      )
    );
    return;
  }

  // simuladores: red primero, para que siempre se vea la version mas reciente
  // que se haya subido. La copia guardada solo se usa si no hay internet.
  if (esSimulador(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((response) => {
            if (response && response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cache.match(event.request, { ignoreSearch: true }))
      )
    );
  }
});

// Mensajes desde el index:
//  "estado"        responde cuantos simuladores ya estan guardados en este equipo
//  "descargar-todo" descarga los que falten y va avisando el progreso
self.addEventListener("message", (event) => {
  const data = event.data || {};
  const cliente = event.source;
  const avisar = (msg) => { if (cliente) cliente.postMessage(msg); };
  if (data.tipo === "estado") {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.all(SIMULADORES.map((f) => cache.match(new URL(f, self.registration.scope).href)))
      ).then((r) => avisar({ tipo: "estado", guardados: r.filter(Boolean).length, total: SIMULADORES.length }))
    );
  }
  if (data.tipo === "descargar-todo") {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL).catch(() => {});
      let listos = 0, fallos = 0;
      for (const f of SIMULADORES) {
        const url = new URL(f, self.registration.scope).href;
        try {
          const resp = await fetch(url, { cache: "reload" });
          if (!resp.ok) throw new Error(resp.status);
          await cache.put(url, resp);
          listos++;
        } catch (e) { fallos++; }
        avisar({ tipo: "progreso", listos, fallos, total: SIMULADORES.length });
      }
      avisar({ tipo: "fin", listos, fallos, total: SIMULADORES.length });
    })());
  }
});
