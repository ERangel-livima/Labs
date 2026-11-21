// La guía de cada estación: un libro abierto sobre un atril a la orilla del río.
// Las páginas vienen en un <template id="paginas"> de la página; lo escrito se guarda en este equipo.
// En computador se ven dos páginas, en celular una; sin 3D (o con ?ligera=1) todas van seguidas, y al imprimir corren en hojas carta.
import { THREE, hayWebGL, almacen, crearMundo, construirRonda, pisoDeParada, ALTO_PISO_PARADA } from "./livima3d.js";

const $ = id => document.getElementById(id);

/*
  abrirLibro({ clave, slot, piso })
    clave: dónde se guarda lo escrito (livima_<estación>_guia)
    slot: la parada de la ronda (el mismo terreno de la estación)
    piso: { color, tinta } del piso de la parada
  La página trae #velo, #mundo, #volver, #libro (con #caraIzq, #caraDer y #todas), los mandos y el template.
*/
export function abrirLibro({ clave, slot = 1, piso = { color: "#8BD46A", tinta: "#2F6E1C" } }) {
  const libro = $("libro");

  /* ---------- las páginas ---------- */
  // cada página vive una sola vez: se mueve entre las caras del libro, así lo escrito no se pierde al pasar la hoja
  const PAGINAS = [...$("paginas").content.querySelectorAll(".pagina")].map(p => document.importNode(p, true));
  const TOTAL = PAGINAS.length;

  // lo que la pareja escribe se guarda en este equipo
  const notas = almacen(clave);
  const campos = PAGINAS.flatMap(p => [...p.querySelectorAll("input")]);
  const guardadas = notas.leer() || {};
  campos.forEach((c, i) => {
    if (c.type === "checkbox") c.checked = !!guardadas[i]; else c.value = guardadas[i] || "";
    c.addEventListener(c.type === "checkbox" ? "change" : "input", () => {
      guardadas[i] = c.type === "checkbox" ? c.checked : c.value;
      if (!notas.guardar(guardadas)) console.warn("LIVIMA: este navegador no deja guardar lo escrito en la guía");
    });
  });

  let dosPaginas = innerWidth >= 760, actual = 0, pasando = false;   // actual: la primera página visible
  // copia de una página para la hoja que gira o para imprimir, con lo que la pareja ya escribió
  function clonar(p) {
    const copia = p.cloneNode(true), originales = p.querySelectorAll("input");
    copia.querySelectorAll("input").forEach((c, i) => { c.value = originales[i].value; c.checked = originales[i].checked; c.tabIndex = -1; });
    return copia;
  }
  const vacia = () => { const v = document.createElement("article"); v.className = "pagina vacia"; return v; };
  function mostrar() {
    libro.classList.toggle("solo", !dosPaginas);
    $("caraIzq").hidden = !dosPaginas;
    if (dosPaginas) {
      // la portada va sola a la derecha, como en un libro de verdad
      const izq = actual === 0 ? null : PAGINAS[actual], der = actual === 0 ? PAGINAS[0] : PAGINAS[actual + 1];
      $("caraIzq").replaceChildren(izq || vacia());
      $("caraDer").replaceChildren(der || vacia());
      $("folio").textContent = actual === 0 ? "Portada" : der ? `Páginas ${actual} y ${actual + 1} de ${TOTAL - 1}` : `Página ${actual} de ${TOTAL - 1}`;
    } else {
      $("caraDer").replaceChildren(PAGINAS[actual]);
      $("folio").textContent = actual === 0 ? "Portada" : `Página ${actual} de ${TOTAL - 1}`;
    }
    marcarLargas();
    $("atras").disabled = actual === 0;
    $("adelante").disabled = siguiente(actual) >= TOTAL;
  }
  function marcarLargas() {
    requestAnimationFrame(() => document.querySelectorAll(".cara .pagina").forEach(p => {
      const revisar = () => p.classList.toggle("sigue", p.scrollHeight - p.clientHeight - p.scrollTop > 8);
      revisar(); if (!p.dataset.vigila) { p.dataset.vigila = "1"; p.addEventListener("scroll", revisar, { passive: true }); }
    }));
  }
  const siguiente = n => !dosPaginas ? n + 1 : n === 0 ? 1 : n + 2;
  const anterior = n => !dosPaginas ? n - 1 : n <= 1 ? 0 : n - 2;
  function normalizar() { if (dosPaginas && actual > 0 && actual % 2 === 0) actual -= 1; }

  // pasar la hoja: una hoja con su frente y su reverso gira sobre el lomo
  async function pasar(adelante) {
    if (pasando) return;
    const destino = adelante ? siguiente(actual) : anterior(actual);
    if (destino < 0 || destino >= TOTAL || destino === actual) return;
    pasando = true;
    const der = $("caraDer"), izq = $("caraIzq"), ancho = der.offsetWidth;
    const hoja = document.createElement("div"); hoja.className = "hoja";
    // la hoja lleva por delante la página que se va y por detrás la que llega a ese lado del libro
    let frenteNodo, reversoNodo = null;
    if (dosPaginas) {
      frenteNodo = adelante ? der.firstElementChild : izq.firstElementChild;
      reversoNodo = adelante ? PAGINAS[destino] : (destino === 0 ? PAGINAS[0] : PAGINAS[destino + 1]);
    } else frenteNodo = adelante ? der.firstElementChild : PAGINAS[destino];
    const frente = clonar(frenteNodo), reverso = reversoNodo ? clonar(reversoNodo) : vacia();
    reverso.classList.add("reverso");
    const anteriorIdx = actual; actual = destino;
    hoja.append(frente, reverso);
    const lomo = dosPaginas ? izq.offsetWidth : 0;
    Object.assign(hoja.style, { left: (adelante ? lomo : (dosPaginas ? 0 : lomo)) + "px", width: ancho + "px", transformOrigin: adelante || !dosPaginas ? "left center" : "right center" });
    if (!adelante && !dosPaginas) hoja.style.transform = "rotateY(-180deg)";
    libro.append(hoja);
    if (adelante || dosPaginas) mostrarDebajo(adelante, anteriorIdx);
    requestAnimationFrame(() => requestAnimationFrame(() => { hoja.style.transform = adelante ? "rotateY(-180deg)" : (dosPaginas ? "rotateY(180deg)" : "rotateY(0deg)"); }));
    await new Promise(r => setTimeout(r, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 680));
    hoja.remove(); mostrar(); pasando = false;
  }
  // mientras gira la hoja, debajo se ve la página que sigue y arriba sigue la que se va
  function mostrarDebajo(adelante, previo) {
    if (!dosPaginas) { $("caraDer").replaceChildren(PAGINAS[actual]); return; }
    if (adelante) { $("caraDer").replaceChildren(PAGINAS[actual + 1] || vacia()); }
    else { $("caraIzq").replaceChildren(actual === 0 ? vacia() : PAGINAS[actual]); }
  }
  $("adelante").onclick = () => pasar(true);
  $("atras").onclick = () => pasar(false);
  addEventListener("keydown", e => {
    if (e.target.closest("input")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") pasar(true);
    if (e.key === "ArrowLeft" || e.key === "PageUp") pasar(false);
  });
  // deslizar con el dedo sobre la página también pasa la hoja
  let toque = null;
  libro.addEventListener("touchstart", e => { toque = e.touches[0].clientX; }, { passive: true });
  libro.addEventListener("touchend", e => {
    if (toque === null) return; const dx = e.changedTouches[0].clientX - toque; toque = null;
    if (Math.abs(dx) > 60) pasar(dx < 0);
  });

  /* ---------- PDF: todas las páginas, una por hoja ---------- */
  function prepararImpresion() { $("todas").replaceChildren(...PAGINAS.map(clonar)); }
  addEventListener("beforeprint", prepararImpresion);
  addEventListener("afterprint", () => { if (!document.body.classList.contains("plano")) $("todas").replaceChildren(); });
  $("pdf").onclick = () => { prepararImpresion(); window.print(); };

  /* ---------- el libro ocupa la ventana; el atril 3D se arma a su medida ---------- */
  const PROPORCION_PAGINA = 0.72;   // ancho sobre alto, como una hoja carta un poco más ancha
  const PROPORCION_MINIMA_CEL = 0.56;
  function medirLibro() {
    const W = innerWidth, H = innerHeight, cel = W < 600;
    const arriba = cel ? 62 : 70, abajo = cel ? 124 : 80, lados = dosPaginas ? 24 : (cel ? 10 : 40);
    const alto = H - arriba - abajo;
    // en el celular la hoja usa todo el ancho y se alarga hacia abajo, hasta una proporción que todavía parece página
    if (!dosPaginas) { const w = W - 2 * lados, h = Math.max(260, Math.min(alto, w / PROPORCION_MINIMA_CEL)); return { x: lados, y: arriba + (alto - h) / 2, w, h }; }
    const h = Math.max(260, Math.min(alto, (W - 2 * lados) / (2 * PROPORCION_PAGINA), 900)), w = h * PROPORCION_PAGINA * 2;
    return { x: (W - w) / 2, y: arriba + (alto - h) / 2, w, h };
  }
  let caja = null;
  function ubicarLibro() {
    dosPaginas = innerWidth >= 760; normalizar();
    caja = medirLibro();
    Object.assign(libro.style, { left: caja.x + "px", top: caja.y + "px", width: caja.w + "px", height: caja.h + "px" });
    mostrar();
  }

  /* ---------- la escena: el atril junto al río ---------- */
  let mundo = null, atril = null;
  const INCLINACION = THREE.MathUtils.degToRad(18);   // el atril se echa un poco hacia atrás
  const ALTO_PAGINA = 0.36, CENTRO_LIBRO = new THREE.Vector3(0, 1.3, 0);
  const normal = new THREE.Vector3(0, Math.sin(INCLINACION), Math.cos(INCLINACION));
  const arribaLibro = new THREE.Vector3(0, Math.cos(INCLINACION), -Math.sin(INCLINACION));
  function armarAtril() {
    if (atril) { atril.traverse(o => { if (o.geometry) o.geometry.dispose(); }); mundo.escena.remove(atril); }
    const { M, malla } = mundo, madera = M("#7A5230"), tapa = M("#1B3A6B", { roughness: 0.6 }), papel = M("#F4EEDC");
    const ancho = ALTO_PAGINA * caja.w / caja.h;
    atril = new THREE.Group(); mundo.escena.add(atril);
    // patas y travesaño
    for (const s of [-1, 1]) {
      const pata = malla(new THREE.CylinderGeometry(0.03, 0.04, CENTRO_LIBRO.y + 0.05, 10), madera, s * (ancho / 2 - 0.05), (CENTRO_LIBRO.y + 0.05) / 2 + ALTO_PISO_PARADA - 0.1, -0.12, atril);
      pata.rotation.x = 0.12;
    }
    malla(new THREE.BoxGeometry(ancho, 0.04, 0.04), madera, 0, 0.45, -0.1, atril);
    // tablero inclinado con el libro: tapas azules, bloque de páginas y repisa
    const tablero = new THREE.Group(); tablero.position.copy(CENTRO_LIBRO); tablero.rotation.x = -INCLINACION; atril.add(tablero);
    malla(new THREE.BoxGeometry(ancho + 0.12, ALTO_PAGINA + 0.12, 0.03), madera, 0, 0, -0.045, tablero);
    malla(new THREE.BoxGeometry(ancho + 0.03, ALTO_PAGINA + 0.025, 0.012), tapa, 0, 0, -0.022, tablero);
    malla(new THREE.BoxGeometry(ancho, ALTO_PAGINA, 0.016), papel, 0, 0, -0.008, tablero);
    malla(new THREE.BoxGeometry(ancho + 0.14, 0.035, 0.07), madera, 0, -ALTO_PAGINA / 2 - 0.05, 0.02, tablero);
  }
  // la cámara mira el libro de frente: así sus páginas caen justo debajo de las páginas de la guía
  function encuadreDelLibro() {
    const tanMedio = Math.tan(THREE.MathUtils.degToRad(mundo.camara.fov / 2));
    const distancia = ALTO_PAGINA * innerHeight / (2 * tanMedio * caja.h);
    const metroPorPixel = (2 * distancia * tanMedio) / innerHeight;
    const dx = (caja.x + caja.w / 2 - innerWidth / 2) * metroPorPixel, dy = (caja.y + caja.h / 2 - innerHeight / 2) * metroPorPixel;
    const centro = CENTRO_LIBRO.clone().addScaledVector(new THREE.Vector3(1, 0, 0), -dx).addScaledVector(arribaLibro, dy);
    return { pos: centro.clone().addScaledVector(normal, distancia), mira: centro };
  }
  const LEJOS = { pos: new THREE.Vector3(-3.5, 2.6, 7.5), mira: new THREE.Vector3(0, 1.2, 0) };

  /* ---------- llegar y volver ---------- */
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  async function salir(destino) {
    libro.classList.remove("abierto");
    if (mundo) await mundo.viajar(LEJOS.pos.clone(), LEJOS.mira.clone(), 900);
    $("velo").classList.add("on"); await esperar(650);
    location.href = destino;
  }
  $("volver").addEventListener("click", e => { e.preventDefault(); salir(e.currentTarget.getAttribute("href")); });
  addEventListener("pageshow", e => { if (e.persisted) { $("velo").classList.remove("on"); libro.classList.add("abierto"); if (mundo) { const f = encuadreDelLibro(); mundo.colocar(f.pos, f.mira); } } });

  let esperaTamano = 0;
  addEventListener("resize", () => {
    ubicarLibro();
    clearTimeout(esperaTamano);
    esperaTamano = setTimeout(() => { if (mundo) { armarAtril(); const f = encuadreDelLibro(); mundo.colocar(f.pos, f.mira); } }, 120);
  });

  /* ---------- arranque ---------- */
  ubicarLibro();
  let pidePdf = false;
  try {
    const entrada = JSON.parse(sessionStorage.getItem("livima_entrada") || "null");
    if (entrada && entrada.destino === "guia-pdf") { pidePdf = true; sessionStorage.removeItem("livima_entrada"); }
  } catch (error) { console.warn("LIVIMA: no se pudo leer la llegada desde el atril", error); }

  if (new URLSearchParams(location.search).has("ligera") || !hayWebGL()) {
    document.body.classList.add("plano"); $("mundo").hidden = true; $("velo").classList.remove("on");
    document.querySelector(".mandos").replaceChildren($("pdf"));
    prepararImpresion();
  } else {
    mundo = crearMundo($("mundo"), { slot });
    construirRonda(mundo, {});
    pisoDeParada(mundo, { radio: 6, color: piso.color, tinta: piso.tinta });
    armarAtril();
    mundo.colocar(LEJOS.pos.clone(), LEJOS.mira.clone());
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      $("velo").classList.remove("on");
      const f = encuadreDelLibro();
      await mundo.viajar(f.pos, f.mira, 1600);
      libro.classList.add("abierto");
      if (pidePdf) setTimeout(() => $("pdf").click(), 400);
    }));
  }
  return { get mundo() { return mundo; }, pasar };
}
